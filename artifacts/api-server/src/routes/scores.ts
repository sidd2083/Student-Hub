import { Router } from "express";
import { db } from "@workspace/db";
import { scoresTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";

const router = Router();

router.get("/scores", async (req, res) => {
  try {
    const { period } = req.query;
    let scores;
    if (period === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      scores = await db.select().from(scoresTable)
        .where(sql`${scoresTable.createdAt} >= ${today}`)
        .orderBy(desc(scoresTable.score));
    } else {
      scores = await db.select().from(scoresTable).orderBy(desc(scoresTable.score));
    }
    res.json(scores.map(s => ({
      id: s.id, uid: s.uid, userName: s.userName, grade: s.grade,
      score: s.score, totalQuestions: s.totalQuestions, subject: s.subject,
      createdAt: s.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/scores", async (req, res) => {
  try {
    const { uid, userName, grade, score, totalQuestions, subject } = req.body;
    if (!uid || !userName || !grade || score === undefined || !totalQuestions || !subject) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const inserted = await db.insert(scoresTable).values({ uid, userName, grade, score, totalQuestions, subject }).returning();
    const s = inserted[0];
    res.status(201).json({ id: s.id, uid: s.uid, userName: s.userName, grade: s.grade, score: s.score, totalQuestions: s.totalQuestions, subject: s.subject, createdAt: s.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/scores/reset", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await db.delete(scoresTable).where(sql`${scoresTable.createdAt} >= ${today}`);
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
