import { Router } from "express";
import type { Request, Response } from "express";
import { getAdminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { requireAuth, perUserWriteLimit } from "../lib/auth-middleware";

const router = Router();

// Max minutes accepted per single study-save call (4 hours)
const MAX_MINUTES_PER_CALL = 240;

router.post(
  "/study/save",
  requireAuth,
  perUserWriteLimit(30),
  async (req: Request, res: Response) => {
    try {
      // Always derive the uid from the verified Firebase token — never trust client-provided uid
      const uid = req.uid!;
      const { minutes } = req.body as { minutes?: number };

      if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 1) {
        return res.status(400).json({ error: "minutes must be a positive number." });
      }

      // Clamp to prevent inflated study time (max 4 hours per session)
      const clampedMinutes = Math.min(Math.floor(minutes), MAX_MINUTES_PER_CALL);

      const db = getAdminDb();
      if (!db) {
        return res.status(503).json({
          error: "Firestore Admin not available — set FIREBASE_SERVICE_ACCOUNT_JSON.",
        });
      }

      // Nepal Time offset (UTC+5:45)
      const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
      const now = Date.now();
      const today = new Date(now + NPT_OFFSET_MS).toISOString().slice(0, 10);
      const yesterday = new Date(now - 86_400_000 + NPT_OFFSET_MS).toISOString().slice(0, 10);
      const userRef = db.collection("users").doc(uid);

      const newTodayMinutes = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists ? snap.data()! : {};

        const lastActive: string = data.lastActiveDate ?? "";
        const prevToday: number = typeof data.todayStudyTime === "number" ? data.todayStudyTime : 0;
        const prevTotal: number = typeof data.totalStudyTime === "number" ? data.totalStudyTime : 0;
        const prevStreak: number = typeof data.streak === "number" ? data.streak : 0;
        const earnedToday: boolean = data.hasEarnedStreakToday === true;

        let newStreak = prevStreak;
        let newToday = prevToday;
        let earnedStreakToday = earnedToday;

        if (lastActive === today) {
          newToday = prevToday + clampedMinutes;
          // Award streak only the FIRST time user crosses 5-min threshold today
          if (!earnedToday && prevToday < 5 && newToday >= 5) {
            newStreak = prevStreak + 1;
            earnedStreakToday = true;
          }
        } else {
          // Day changed — reset today counter
          newToday = clampedMinutes;
          earnedStreakToday = false;

          if (lastActive === yesterday) {
            // Consecutive day: streak maintained/extended when hitting 5 min
            if (newToday >= 5) {
              newStreak = prevStreak + 1;
              earnedStreakToday = true;
            }
          } else if (lastActive !== "") {
            // Missed at least one day — reset streak
            newStreak = newToday >= 5 ? 1 : 0;
            if (newToday >= 5) earnedStreakToday = true;
          } else {
            // First ever study session
            newStreak = newToday >= 5 ? 1 : 0;
            if (newToday >= 5) earnedStreakToday = true;
          }
        }

        const updates = {
          totalStudyTime: prevTotal + clampedMinutes,
          todayStudyTime: newToday,
          streak: newStreak,
          hasEarnedStreakToday: earnedStreakToday,
          lastActiveDate: today,
        };

        if (snap.exists) {
          tx.update(userRef, updates);
        } else {
          tx.set(userRef, { uid, ...updates, badges: [] }, { merge: true });
        }

        return newToday;
      });

      // ── Update study log (per-day aggregate) ────────────────────────────────
      const logId = `${uid}_${today}`;
      const logRef = db.collection("study_logs").doc(logId);
      const logSnap = await logRef.get();

      if (logSnap.exists) {
        await logRef.update({
          studyMinutes: (logSnap.data()?.studyMinutes ?? 0) + clampedMinutes,
        });
      } else {
        await logRef.set({
          uid,
          date: today,
          studyMinutes: clampedMinutes,
          tasksCompleted: 0,
          notesViewed: 0,
        });
      }

      logger.info({ uid, minutes: clampedMinutes, newTodayMinutes }, "[Study] Session saved");
      return res.json({ ok: true, todayMinutes: newTodayMinutes });
    } catch (err) {
      logger.error(err, "[Study] Save failed");
      return res.status(500).json({ error: "Failed to save study session." });
    }
  },
);

// ── Participant leave cleanup ─────────────────────────────────────────────────
// Called via `fetch(..., { keepalive: true })` when the user closes their tab
// so ghost avatars are removed immediately without waiting for the 90 s heartbeat.
router.post("/study/leave", async (req: Request, res: Response) => {
  try {
    const { roomId, uid } = req.body as { roomId?: string; uid?: string };
    if (!roomId || !uid || typeof roomId !== "string" || typeof uid !== "string") {
      return res.status(400).json({ ok: false, error: "roomId and uid required" });
    }

    const db = getAdminDb();
    if (!db) return res.json({ ok: false });

    const roomRef = db.collection("studyRooms").doc(roomId);

    // Read room doc BEFORE deleting participant so we can check if the
    // leaving user is the host and transfer host rights if needed.
    const roomSnap = await roomRef.get();
    const roomData = roomSnap.exists ? roomSnap.data()! : null;
    const leaverIsHost = roomData?.hostUid === uid;

    // Delete the participant doc (scoped to the sender's uid — cannot abuse)
    const pRef = roomRef.collection("participants").doc(uid);
    await pRef.delete();

    // Correct participantCount to match the real remaining participants
    const snap = await roomRef.collection("participants").get();
    const activeCount = snap.size;

    if (activeCount === 0) {
      await roomRef.update({
        participantCount: 0,
        status:           "finished",
        timerStartedAt:   null,
      }).catch(() => {});
    } else {
      await roomRef.update({ participantCount: activeCount }).catch(() => {});

      // ── Host transfer ──────────────────────────────────────────────────────
      // If the leaving user was the host and the room is still active,
      // immediately promote the longest-standing remaining participant.
      // This prevents the 30-second gap that existed with the claim-host
      // polling approach when a host closes their tab.
      if (leaverIsHost && roomData?.status !== "finished") {
        const remaining = snap.docs
          .map(d => ({
            uid:      d.id,
            name:     (d.data().name as string | undefined) ?? "Unknown",
            joinedAt: d.data().joinedAt as { toMillis(): number } | undefined,
          }))
          .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0));

        const next = remaining[0];
        if (next) {
          const { FieldValue } = await import("firebase-admin/firestore");
          const batch = db.batch();
          batch.update(roomRef, { hostUid: next.uid, hostName: next.name });
          batch.update(roomRef.collection("participants").doc(next.uid), { isHost: true });
          await batch.commit().catch(() => {});

          // Post system message
          await roomRef.collection("messages").add({
            uid: "system", name: "System",
            text: `${next.name} is now the host (previous host disconnected).`,
            type: "system",
            createdAt: FieldValue.serverTimestamp(),
          }).catch(() => {});

          logger.info(
            { roomId, prevHost: uid, newHost: next.uid },
            "[Study] Host transferred on leave",
          );
        }
      }
    }

    logger.info({ roomId, uid, remaining: activeCount }, "[Study] Participant left");
    return res.json({ ok: true, remaining: activeCount });
  } catch (err) {
    logger.warn(err, "[Study] leave cleanup non-fatal");
    return res.json({ ok: false }); // always 200 — beacon doesn't retry on error
  }
});

// ── Anonymous beacon sync — called via sendBeacon on tab close ────────────────
// Cannot carry auth headers so uid comes from the body.
// No streak update — just persists study time. Strict caps prevent abuse.
const ANON_SYNC_LIMIT_MS = 60_000; // max one beacon per user per minute
const anonSyncLastCall = new Map<string, number>();

router.post("/study/sync-anon", async (req: Request, res: Response) => {
  try {
    const { uid, mins } = req.body as { uid?: string; mins?: number };
    if (!uid || typeof uid !== "string" || uid.length < 10 || uid.length > 128) {
      return res.status(400).json({ ok: false });
    }
    const cappedMins = typeof mins === "number" && Number.isFinite(mins)
      ? Math.max(0, Math.min(Math.floor(mins), 5)) // max 5 min per beacon call
      : 0;
    if (cappedMins === 0) return res.json({ ok: true });

    // Rate-limit: one beacon per uid per minute
    const now = Date.now();
    const last = anonSyncLastCall.get(uid) ?? 0;
    if (now - last < ANON_SYNC_LIMIT_MS) return res.json({ ok: true });
    anonSyncLastCall.set(uid, now);

    const db = getAdminDb();
    if (!db) return res.json({ ok: false });

    const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
    const today = new Date(now + NPT_OFFSET_MS).toISOString().slice(0, 10);
    const userRef = db.collection("users").doc(uid);
    const FieldValue = (await import("firebase-admin/firestore")).FieldValue;

    // Only increment totals — do NOT update streak (requires verified token)
    await userRef.set({
      totalStudyTime:  FieldValue.increment(cappedMins),
      weeklyStudyTime: FieldValue.increment(cappedMins),
      todayStudyTime:  FieldValue.increment(cappedMins),
      lastActiveDate:  today,
    }, { merge: true }).catch(() => {});

    return res.json({ ok: true });
  } catch (err) {
    logger.warn(err, "[Study] sync-anon non-fatal");
    return res.json({ ok: false });
  }
});

// ── Claim host when current host is stale ─────────────────────────────────────
// Called by the oldest active non-host participant every 30 s when they detect
// the current host's lastSeen is > 90 s old (i.e. host crashed/closed tab).
// Uses Firebase Admin SDK so it bypasses Firestore rules that only allow the
// current host to update room.hostUid.
router.post("/study/claim-host", requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.body as { roomId?: string };
    if (!roomId || typeof roomId !== "string") {
      return res.status(400).json({ error: "roomId required" });
    }

    const claimerUid = req.uid!;
    const db = getAdminDb();
    if (!db) return res.status(503).json({ error: "Admin DB unavailable" });

    const roomRef  = db.collection("studyRooms").doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return res.status(404).json({ error: "Room not found" });

    const room = roomSnap.data()!;
    if (room.status === "finished") return res.status(409).json({ error: "Room already finished" });

    // Claimer must be a current participant
    const claimerRef  = roomRef.collection("participants").doc(claimerUid);
    const claimerSnap = await claimerRef.get();
    if (!claimerSnap.exists) return res.status(403).json({ error: "Not a participant" });

    const currentHostUid: string = room.hostUid;
    if (currentHostUid === claimerUid) return res.json({ ok: true, message: "Already host" });

    // Check if current host is stale (lastSeen > 90 s ago or participant doc missing)
    const STALE_MS = 90_000;
    const hostRef  = roomRef.collection("participants").doc(currentHostUid);
    const hostSnap = await hostRef.get();

    let isHostStale = !hostSnap.exists;
    if (!isHostStale && hostSnap.exists) {
      const lastSeen = hostSnap.data()?.lastSeen?.toMillis() ?? 0;
      isHostStale = Date.now() - lastSeen > STALE_MS;
    }

    if (!isHostStale) {
      return res.status(409).json({ error: "Current host is still active" });
    }

    // Transfer host to claimer
    const claimerName: string = claimerSnap.data()?.name ?? "Unknown";
    const batch = db.batch();
    batch.update(roomRef, { hostUid: claimerUid, hostName: claimerName });
    batch.update(claimerRef, { isHost: true });
    if (hostSnap.exists) {
      batch.update(hostRef, { isHost: false });
    }
    await batch.commit();

    // Post system message
    await roomRef.collection("messages").add({
      uid: "system", name: "System",
      text: `${claimerName} is now the host (previous host disconnected).`,
      type: "system",
      createdAt: (await import("firebase-admin/firestore")).FieldValue.serverTimestamp(),
    }).catch(() => {});

    logger.info({ roomId, claimerUid, prevHostUid: currentHostUid }, "[Study] Host claimed after stale");
    return res.json({ ok: true, newHostUid: claimerUid });
  } catch (err) {
    logger.error(err, "[Study] claim-host failed");
    return res.status(500).json({ error: "Failed to claim host" });
  }
});

router.post("/study/session",  (_req: Request, res: Response) => res.status(501).json({ error: "Use /study/save" }));
router.post("/study/log-task", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.post("/study/log-note", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.get("/study/logs/:uid", (_req: Request, res: Response) => res.json([]));
router.get("/study/stats/:uid",(_req: Request, res: Response) => res.json({ streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null }));

export default router;
