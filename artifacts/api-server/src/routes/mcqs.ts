import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function toMcq(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    grade:         data.grade ?? null,
    subject:       data.subject ?? "",
    chapter:       data.chapter ?? "",
    question:      data.question ?? "",
    optionA:       data.optionA ?? "",
    optionB:       data.optionB ?? "",
    optionC:       data.optionC ?? "",
    optionD:       data.optionD ?? "",
    correctAnswer: data.correctAnswer ?? "",
    difficulty:    data.difficulty ?? "medium",
    explanation:   data.explanation ?? null,
    createdAt:     data.createdAt ?? new Date().toISOString(),
  };
}

router.get("/mcqs", async (req: Request, res: Response) => {
  try {
    const { grade, subject, chapter, difficulty, limit } = req.query;
    let query: FirebaseFirestore.Query = adminDb.collection("mcqs");
    if (grade)      query = query.where("grade",      "==", Number(grade));
    if (subject)    query = query.where("subject",    "==", String(subject));
    if (chapter)    query = query.where("chapter",    "==", String(chapter));
    if (difficulty) query = query.where("difficulty", "==", String(difficulty));
    const snap = await query.get();
    let docs = snap.docs;
    docs = docs.sort(() => Math.random() - 0.5);
    if (limit) docs = docs.slice(0, Number(limit));
    return res.json(docs.map((d) => toMcq(d.id, d.data())));
  } catch (err) {
    logger.error(err, "GET /mcqs");
    return res.status(500).json({ error: "Failed to fetch MCQs" });
  }
});

router.post("/mcqs", async (req: Request, res: Response) => {
  try {
    const {
      grade, subject, chapter, question,
      optionA, optionB, optionC, optionD,
      correctAnswer, difficulty, explanation,
    } = req.body as Record<string, unknown>;
    const data = {
      grade, subject, chapter, question,
      optionA, optionB, optionC, optionD,
      correctAnswer,
      difficulty:  difficulty ?? "medium",
      explanation: explanation ?? null,
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb.collection("mcqs").add(data);
    return res.status(201).json(toMcq(ref.id, data));
  } catch (err) {
    logger.error(err, "POST /mcqs");
    return res.status(500).json({ error: "Failed to create MCQ" });
  }
});

router.patch("/mcqs/:id", async (req: Request, res: Response) => {
  try {
    const {
      grade, subject, chapter, question,
      optionA, optionB, optionC, optionD,
      correctAnswer, difficulty, explanation,
    } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (grade         !== undefined) updates.grade         = grade;
    if (subject       !== undefined) updates.subject       = subject;
    if (chapter       !== undefined) updates.chapter       = chapter;
    if (question      !== undefined) updates.question      = question;
    if (optionA       !== undefined) updates.optionA       = optionA;
    if (optionB       !== undefined) updates.optionB       = optionB;
    if (optionC       !== undefined) updates.optionC       = optionC;
    if (optionD       !== undefined) updates.optionD       = optionD;
    if (correctAnswer !== undefined) updates.correctAnswer = correctAnswer;
    if (difficulty    !== undefined) updates.difficulty    = difficulty;
    if (explanation   !== undefined) updates.explanation   = explanation;
    const docRef = adminDb.collection("mcqs").doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "MCQ not found" });
    await docRef.update(updates);
    const updated = await docRef.get();
    return res.json(toMcq(updated.id, updated.data()!));
  } catch (err) {
    logger.error(err, "PATCH /mcqs/:id");
    return res.status(500).json({ error: "Failed to update MCQ" });
  }
});

router.delete("/mcqs/:id", async (req: Request, res: Response) => {
  try {
    await adminDb.collection("mcqs").doc(req.params.id).delete();
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "DELETE /mcqs/:id");
    return res.status(500).json({ error: "Failed to delete MCQ" });
  }
});

export default router;
