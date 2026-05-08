import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function toScore(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    uid:            data.uid ?? "",
    userName:       data.userName ?? "",
    grade:          data.grade ?? null,
    score:          data.score ?? 0,
    totalQuestions: data.totalQuestions ?? 0,
    subject:        data.subject ?? "",
    createdAt:      data.createdAt ?? new Date().toISOString(),
  };
}

router.get("/scores", async (req: Request, res: Response) => {
  try {
    const { period } = req.query;
    let query: FirebaseFirestore.Query = adminDb.collection("scores");
    if (period === "daily") {
      const todayStr = new Date().toISOString().slice(0, 10);
      query = query.where("createdAt", ">=", todayStr);
    }
    const snap = await query.orderBy("createdAt", "desc").get();
    const docs = snap.docs.map((d) => toScore(d.id, d.data()));
    docs.sort((a, b) => b.score - a.score);
    return res.json(docs);
  } catch (err) {
    logger.error(err, "GET /scores");
    return res.status(500).json({ error: "Failed to fetch scores" });
  }
});

router.post("/scores", async (req: Request, res: Response) => {
  try {
    const { uid, userName, grade, score, totalQuestions, subject } = req.body as Record<string, unknown>;
    if (!uid || !userName || !grade || score === undefined || !totalQuestions || !subject) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const data = { uid, userName, grade, score, totalQuestions, subject, createdAt: new Date().toISOString() };
    const ref = await adminDb.collection("scores").add(data);
    return res.status(201).json(toScore(ref.id, data));
  } catch (err) {
    logger.error(err, "POST /scores");
    return res.status(500).json({ error: "Failed to save score" });
  }
});

router.post("/scores/reset", async (_req: Request, res: Response) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const snap = await adminDb.collection("scores").where("createdAt", ">=", todayStr).get();
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "POST /scores/reset");
    return res.status(500).json({ error: "Failed to reset scores" });
  }
});

export default router;
