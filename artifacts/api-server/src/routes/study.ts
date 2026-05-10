import { Router } from "express";
import type { Request, Response } from "express";
import { getAdminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

const router = Router();

router.post("/study/save", async (req: Request, res: Response) => {
  try {
    const { uid, minutes } = req.body as { uid?: string; minutes?: number };

    if (!uid || typeof minutes !== "number" || minutes < 1) {
      return res.status(400).json({ error: "uid and minutes (>=1) are required" });
    }

    const db = getAdminDb();
    if (!db) {
      return res.status(503).json({ error: "Firestore Admin not available — set FIREBASE_SERVICE_ACCOUNT_JSON" });
    }

    const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
    const today = new Date(Date.now() + NPT_OFFSET_MS).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000 + NPT_OFFSET_MS).toISOString().slice(0, 10);
    const userRef = db.collection("users").doc(uid);

    const newTodayMinutes = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? snap.data()! : {};

      const lastActive: string = data.lastActiveDate ?? "";
      const prevToday: number = data.todayStudyTime ?? 0;
      const prevTotal: number = data.totalStudyTime ?? 0;
      const prevStreak: number = data.streak ?? 0;

      let newStreak = prevStreak;
      let newToday = prevToday;

      if (lastActive === today) {
        newToday = prevToday + minutes;
        // First time crossing 5-minute threshold today — qualify for streak
        if (prevToday < 5 && newToday >= 5) {
          newStreak = prevStreak + 1;
        }
      } else {
        newToday = minutes;
        if (lastActive === yesterday) {
          // Only maintain/extend streak if today reaches 5+ minutes
          if (newToday >= 5) {
            newStreak = prevStreak + 1;
          }
          // else: streak stays unchanged until user hits 5 min today
        } else {
          // Missed days — start fresh only if 5+ min today
          newStreak = newToday >= 5 ? 1 : 0;
        }
      }

      const updates = {
        totalStudyTime: prevTotal + minutes,
        todayStudyTime: newToday,
        streak: newStreak,
        lastActiveDate: today,
      };

      if (snap.exists) {
        tx.update(userRef, updates);
      } else {
        tx.set(userRef, { uid, ...updates, badges: [] }, { merge: true });
      }

      return newToday;
    });

    const logId = `${uid}_${today}`;

    const logRef = db.collection("study_logs").doc(logId);
    const logSnap = await logRef.get();

    if (logSnap.exists) {
      await logRef.update({ studyMinutes: (logSnap.data()?.studyMinutes ?? 0) + minutes });
    } else {
      await logRef.set({ uid, date: today, studyMinutes: minutes, tasksCompleted: 0, notesViewed: 0 });
    }

    logger.info({ uid, minutes, newTodayMinutes }, "[Study] Saved study session");
    return res.json({ ok: true, todayMinutes: newTodayMinutes });
  } catch (err) {
    logger.error(err, "[Study] Save failed");
    return res.status(500).json({ error: "Failed to save study session" });
  }
});

router.post("/study/session",  (_req: Request, res: Response) => res.status(501).json({ error: "Use /study/save" }));
router.post("/study/log-task", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.post("/study/log-note", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.get("/study/logs/:uid", (_req: Request, res: Response) => res.json([]));
router.get("/study/stats/:uid",(_req: Request, res: Response) => res.json({ streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null }));

export default router;
