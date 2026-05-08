import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { scoresTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { dbError } from "../lib/errors";

const router = Router();

type ScoreRow = typeof scoresTable.$inferSelect;

const toScore = (s: ScoreRow) => ({
  id:             s.id,
  uid:            s.uid,
  userName:       s.userName,
  grade:          s.grade,
  score:          s.score,
  totalQuestions: s.totalQuestions,
  subject:        s.subject,
  createdAt:      s.createdAt.toISOString(),
});

router.get("/scores", async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    let scores: ScoreRow[];
    if (period === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      scores = await db.select().from(scoresTable)
        .where(sql`${scoresTable.createdAt} >= ${today}`)
        .orderBy(desc(scoresTable.score));
    } else {
      scores = await db.select().from(scoresTable).orderBy(desc(scoresTable.score));
    }
    return res.json(scores.map(toScore));
  } catch (err) {
    return dbError(res, err);
  }
});

router.post("/scores", async (req: Request, res: Response) => {
  try {
    const { uid, userName, grade, score, totalQuestions, subject } = req.body as Record<string, unknown>;
    if (!uid || !userName || !grade || score === undefined || !totalQuestions || !subject) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const inserted = await db.insert(scoresTable).values({ uid, userName, grade, score, totalQuestions, subject } as ScoreRow).returning();
    return res.status(201).json(toScore(inserted[0]));
  } catch (err) {
    return dbError(res, err);
  }
});

router.post("/scores/reset", async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await db.delete(scoresTable).where(sql`${scoresTable.createdAt} >= ${today}`);
    return res.json({ success: true });
  } catch (err) {
    return dbError(res, err);
  }
});

export default router;
