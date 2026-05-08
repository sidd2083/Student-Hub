import { Router } from "express";
import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function getNepalDate(): string {
  const now = new Date();
  const nepalOffset = 5 * 60 + 45;
  const nepalTime = new Date(now.getTime() + nepalOffset * 60 * 1000);
  return nepalTime.toISOString().slice(0, 10);
}

function getNepalYesterday(): string {
  const now = new Date();
  const nepalOffset = 5 * 60 + 45;
  const nepalTime = new Date(now.getTime() + nepalOffset * 60 * 1000 - 86400000);
  return nepalTime.toISOString().slice(0, 10);
}

router.post("/study/session", async (req: Request, res: Response) => {
  try {
    const { uid, minutes } = req.body as { uid?: string; minutes?: number };
    if (!uid || typeof minutes !== "number" || minutes < 1) {
      return res.status(400).json({ error: "uid and minutes (>=1) required" });
    }

    const today     = getNepalDate();
    const yesterday = getNepalYesterday();

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });
    const user = userSnap.data()!;

    const lastActive = user.lastActiveDate ?? null;
    let newStreak: number;
    let newTodayStudyTime: number;

    if (lastActive === today) {
      newStreak = user.streak ?? 0;
      newTodayStudyTime = (user.todayStudyTime ?? 0) + minutes;
    } else if (lastActive === yesterday) {
      newStreak = (user.streak ?? 0) + 1;
      newTodayStudyTime = minutes;
    } else {
      newStreak = 1;
      newTodayStudyTime = minutes;
    }

    await userRef.update({
      totalStudyTime: FieldValue.increment(minutes),
      todayStudyTime: newTodayStudyTime,
      streak:         newStreak,
      lastActiveDate: today,
    });

    const logDocId = `${uid}_${today}`;
    const logRef = adminDb.collection("study_logs").doc(logDocId);
    const logSnap = await logRef.get();
    if (logSnap.exists) {
      await logRef.update({ studyMinutes: FieldValue.increment(minutes) });
    } else {
      await logRef.set({ uid, date: today, studyMinutes: minutes, tasksCompleted: 0, notesViewed: 0 });
    }

    const updatedUser = (await userRef.get()).data()!;
    logger.info({ uid, minutes, newStreak, newTodayStudyTime }, "Study session saved");
    return res.json({
      uid,
      streak:         updatedUser.streak,
      totalStudyTime: updatedUser.totalStudyTime,
      todayStudyTime: updatedUser.todayStudyTime,
      lastActiveDate: updatedUser.lastActiveDate,
    });
  } catch (err) {
    logger.error(err, "POST /study/session");
    return res.status(500).json({ error: "Failed to save study session" });
  }
});

router.post("/study/log-task", async (req: Request, res: Response) => {
  try {
    const { uid } = req.body as { uid?: string };
    if (!uid) return res.status(400).json({ error: "uid required" });
    const today = getNepalDate();
    const logDocId = `${uid}_${today}`;
    const logRef = adminDb.collection("study_logs").doc(logDocId);
    const logSnap = await logRef.get();
    if (logSnap.exists) {
      await logRef.update({ tasksCompleted: FieldValue.increment(1) });
    } else {
      await logRef.set({ uid, date: today, studyMinutes: 0, tasksCompleted: 1, notesViewed: 0 });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "POST /study/log-task");
    return res.status(500).json({ error: "Failed to log task" });
  }
});

router.post("/study/log-note", async (req: Request, res: Response) => {
  try {
    const { uid } = req.body as { uid?: string };
    if (!uid) return res.status(400).json({ error: "uid required" });
    const today = getNepalDate();
    const logDocId = `${uid}_${today}`;
    const logRef = adminDb.collection("study_logs").doc(logDocId);
    const logSnap = await logRef.get();
    if (logSnap.exists) {
      await logRef.update({ notesViewed: FieldValue.increment(1) });
    } else {
      await logRef.set({ uid, date: today, studyMinutes: 0, tasksCompleted: 0, notesViewed: 1 });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "POST /study/log-note");
    return res.status(500).json({ error: "Failed to log note view" });
  }
});

router.get("/study/logs/:uid", async (req: Request, res: Response) => {
  try {
    const uid = String(req.params.uid);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const snap = await adminDb.collection("study_logs")
      .where("uid", "==", uid)
      .where("date", ">=", cutoff)
      .orderBy("date")
      .get();

    return res.json(snap.docs.map((d) => {
      const data = d.data();
      return {
        date:           data.date,
        studyMinutes:   data.studyMinutes ?? 0,
        tasksCompleted: data.tasksCompleted ?? 0,
        notesViewed:    data.notesViewed ?? 0,
      };
    }));
  } catch (err) {
    logger.error(err, "GET /study/logs/:uid");
    return res.status(500).json({ error: "Failed to fetch study logs" });
  }
});

router.get("/study/stats/:uid", async (req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection("users").doc(req.params.uid).get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    const u = snap.data()!;
    return res.json({
      streak:         u.streak ?? 0,
      totalStudyTime: u.totalStudyTime ?? 0,
      todayStudyTime: u.todayStudyTime ?? 0,
      lastActiveDate: u.lastActiveDate ?? null,
    });
  } catch (err) {
    logger.error(err, "GET /study/stats/:uid");
    return res.status(500).json({ error: "Failed to fetch study stats" });
  }
});

export default router;
