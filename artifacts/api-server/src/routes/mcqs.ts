import { Router } from "express";
import { db } from "@workspace/db";
import { mcqsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

const toMcq = (m: typeof mcqsTable.$inferSelect) => ({
  id: m.id,
  grade: m.grade,
  subject: m.subject,
  chapter: m.chapter,
  question: m.question,
  optionA: m.optionA,
  optionB: m.optionB,
  optionC: m.optionC,
  optionD: m.optionD,
  correctAnswer: m.correctAnswer,
  difficulty: m.difficulty,
  explanation: m.explanation ?? null,
  createdAt: m.createdAt.toISOString(),
});

router.get("/mcqs", async (req, res) => {
  try {
    const { grade, subject, chapter, difficulty, limit } = req.query;
    const conditions = [];
    if (grade) conditions.push(eq(mcqsTable.grade, Number(grade)));
    if (subject) conditions.push(eq(mcqsTable.subject, String(subject)));
    if (chapter) conditions.push(eq(mcqsTable.chapter, String(chapter)));
    if (difficulty) conditions.push(eq(mcqsTable.difficulty, String(difficulty) as "easy" | "medium" | "hard"));
    let mcqs = conditions.length > 0
      ? await db.select().from(mcqsTable).where(and(...conditions)).orderBy(sql`RANDOM()`)
      : await db.select().from(mcqsTable).orderBy(sql`RANDOM()`);
    if (limit) mcqs = mcqs.slice(0, Number(limit));
    res.json(mcqs.map(toMcq));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/mcqs", async (req, res) => {
  try {
    const { grade, subject, chapter, question, optionA, optionB, optionC, optionD, correctAnswer, difficulty, explanation } = req.body;
    const inserted = await db.insert(mcqsTable).values({
      grade, subject, chapter, question, optionA, optionB, optionC, optionD,
      correctAnswer, difficulty: difficulty || "medium",
      explanation: explanation || null,
    }).returning();
    res.status(201).json(toMcq(inserted[0]));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/mcqs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { grade, subject, chapter, question, optionA, optionB, optionC, optionD, correctAnswer, difficulty, explanation } = req.body;
    const updates: Record<string, unknown> = {};
    if (grade !== undefined) updates.grade = grade;
    if (subject !== undefined) updates.subject = subject;
    if (chapter !== undefined) updates.chapter = chapter;
    if (question !== undefined) updates.question = question;
    if (optionA !== undefined) updates.optionA = optionA;
    if (optionB !== undefined) updates.optionB = optionB;
    if (optionC !== undefined) updates.optionC = optionC;
    if (optionD !== undefined) updates.optionD = optionD;
    if (correctAnswer !== undefined) updates.correctAnswer = correctAnswer;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (explanation !== undefined) updates.explanation = explanation;
    const updated = await db.update(mcqsTable).set(updates).where(eq(mcqsTable.id, Number(id))).returning();
    if (updated.length === 0) return res.status(404).json({ error: "MCQ not found" });
    res.json(toMcq(updated[0]));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/mcqs/:id", async (req, res) => {
  try {
    await db.delete(mcqsTable).where(eq(mcqsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
