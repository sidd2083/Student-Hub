import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, studyLogsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

type StudyLogRow = typeof studyLogsTable.$inferSelect;

function getToday(): string    { return new Date().toISOString().slice(0, 10); }
function getYesterday(): string { return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }

const toLog = (l: StudyLogRow) => ({
  date:           l.date,
  studyMinutes:   l.studyMinutes,
  tasksCompleted: l.tasksCompleted,
  notesViewed:    l.notesViewed,
});

router.post("/study/session", async (req, res) => {
  try {
    const { uid, minutes } = req.body as { uid?: string; minutes?: number };
    if (!uid || typeof minutes !== "number" || minutes < 1) {
      return res.status(400).json({ error: "uid and minutes (>=1) required" });
    }

    const today     = getToday();
    const yesterday = getYesterday();

    const users = await db.select().from(usersTable).where(eq(usersTable.uid, uid));
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    const user = users[0];

    const lastActive = user.lastActiveDate ?? null;
    let newStreak: number;
    let newTodayStudyTime: number;

    if (lastActive === today) {
      newStreak = user.streak;
      newTodayStudyTime = user.todayStudyTime + minutes;
    } else if (lastActive === yesterday) {
      newStreak = user.streak + 1;
      newTodayStudyTime = minutes;
    } else {
      newStreak = 1;
      newTodayStudyTime = minutes;
    }

    const updated = await db.update(usersTable)
      .set({
        totalStudyTime: sql`${usersTable.totalStudyTime} + ${minutes}`,
        todayStudyTime: newTodayStudyTime,
        streak:         newStreak,
        lastActiveDate: today,
      })
      .where(eq(usersTable.uid, uid))
      .returning();

    const existing = await db.select().from(studyLogsTable)
      .where(and(eq(studyLogsTable.uid, uid), eq(studyLogsTable.date, today)));

    if (existing.length > 0) {
      await db.update(studyLogsTable)
        .set({ studyMinutes: sql`${studyLogsTable.studyMinutes} + ${minutes}` })
        .where(and(eq(studyLogsTable.uid, uid), eq(studyLogsTable.date, today)));
    } else {
      await db.insert(studyLogsTable).values({ uid, date: today, studyMinutes: minutes, tasksCompleted: 0, notesViewed: 0 });
    }

    const u = updated[0];
    logger.info({ uid, minutes, newStreak, newTodayStudyTime }, "Study session saved");
    return res.json({
      uid:            u.uid,
      streak:         u.streak,
      totalStudyTime: u.totalStudyTime,
      todayStudyTime: u.todayStudyTime,
      lastActiveDate: u.lastActiveDate,
    });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/study/log-task", async (req, res) => {
  try {
    const { uid } = req.body as { uid?: string };
    if (!uid) return res.status(400).json({ error: "uid required" });
    const today = getToday();

    const existing = await db.select().from(studyLogsTable)
      .where(and(eq(studyLogsTable.uid, uid), eq(studyLogsTable.date, today)));

    if (existing.length > 0) {
      await db.update(studyLogsTable)
        .set({ tasksCompleted: sql`${studyLogsTable.tasksCompleted} + 1` })
        .where(and(eq(studyLogsTable.uid, uid), eq(studyLogsTable.date, today)));
    } else {
      await db.insert(studyLogsTable).values({ uid, date: today, studyMinutes: 0, tasksCompleted: 1, notesViewed: 0 });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/study/log-note", async (req, res) => {
  try {
    const { uid } = req.body as { uid?: string };
    if (!uid) return res.status(400).json({ error: "uid required" });
    const today = getToday();

    const existing = await db.select().from(studyLogsTable)
      .where(and(eq(studyLogsTable.uid, uid), eq(studyLogsTable.date, today)));

    if (existing.length > 0) {
      await db.update(studyLogsTable)
        .set({ notesViewed: sql`${studyLogsTable.notesViewed} + 1` })
        .where(and(eq(studyLogsTable.uid, uid), eq(studyLogsTable.date, today)));
    } else {
      await db.insert(studyLogsTable).values({ uid, date: today, studyMinutes: 0, tasksCompleted: 0, notesViewed: 1 });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/study/logs/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const logs = await db.select().from(studyLogsTable)
      .where(and(eq(studyLogsTable.uid, uid), sql`${studyLogsTable.date} >= ${cutoff}`))
      .orderBy(studyLogsTable.date);

    return res.json(logs.map(toLog));
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/study/stats/:uid", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.uid, req.params.uid));
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    const u = users[0];
    return res.json({
      streak:         u.streak,
      totalStudyTime: u.totalStudyTime,
      todayStudyTime: u.todayStudyTime,
      lastActiveDate: u.lastActiveDate,
    });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
