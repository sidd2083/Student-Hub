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
      const { uid, minutes } = req.body as { uid?: string; minutes?: number };

      // uid in body must match the verified token uid — prevents forging other users' stats
      if (!uid || uid !== req.uid) {
        logger.warn({ bodyUid: uid, tokenUid: req.uid }, "[Study] uid mismatch");
        return res.status(403).json({ error: "Forbidden: uid does not match authenticated user." });
      }

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

router.post("/study/session",  (_req: Request, res: Response) => res.status(501).json({ error: "Use /study/save" }));
router.post("/study/log-task", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.post("/study/log-note", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.get("/study/logs/:uid", (_req: Request, res: Response) => res.json([]));
router.get("/study/stats/:uid",(_req: Request, res: Response) => res.json({ streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null }));

export default router;
