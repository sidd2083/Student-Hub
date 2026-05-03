import { Router } from "express";
import { db } from "@workspace/db";
import { notesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/notes", async (req, res) => {
  try {
    const { grade, subject, chapter } = req.query;
    let query = db.select().from(notesTable);
    const conditions = [];
    if (grade) conditions.push(eq(notesTable.grade, Number(grade)));
    if (subject) conditions.push(eq(notesTable.subject, String(subject)));
    if (chapter) conditions.push(eq(notesTable.chapter, String(chapter)));
    const notes = conditions.length > 0
      ? await db.select().from(notesTable).where(and(...conditions)).orderBy(notesTable.createdAt)
      : await db.select().from(notesTable).orderBy(notesTable.createdAt);
    res.json(notes.map(n => ({
      id: n.id, grade: n.grade, subject: n.subject, chapter: n.chapter,
      title: n.title, contentType: n.contentType, content: n.content,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notes/subjects", async (req, res) => {
  try {
    const { grade } = req.query;
    let notes;
    if (grade) {
      notes = await db.select({ subject: notesTable.subject })
        .from(notesTable).where(eq(notesTable.grade, Number(grade)));
    } else {
      notes = await db.select({ subject: notesTable.subject }).from(notesTable);
    }
    const subjects = [...new Set(notes.map(n => n.subject))].sort();
    res.json(subjects);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const notes = await db.select().from(notesTable).where(eq(notesTable.id, Number(id)));
    if (notes.length === 0) return res.status(404).json({ error: "Note not found" });
    const n = notes[0];
    res.json({ id: n.id, grade: n.grade, subject: n.subject, chapter: n.chapter, title: n.title, contentType: n.contentType, content: n.content, createdAt: n.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notes", async (req, res) => {
  try {
    const { grade, subject, chapter, title, contentType, content } = req.body;
    if (!grade || !subject || !chapter || !title || !contentType || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const inserted = await db.insert(notesTable).values({ grade, subject, chapter, title, contentType, content }).returning();
    const n = inserted[0];
    res.status(201).json({ id: n.id, grade: n.grade, subject: n.subject, chapter: n.chapter, title: n.title, contentType: n.contentType, content: n.content, createdAt: n.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { grade, subject, chapter, title, contentType, content } = req.body;
    const updates: Record<string, unknown> = {};
    if (grade !== undefined) updates.grade = grade;
    if (subject !== undefined) updates.subject = subject;
    if (chapter !== undefined) updates.chapter = chapter;
    if (title !== undefined) updates.title = title;
    if (contentType !== undefined) updates.contentType = contentType;
    if (content !== undefined) updates.content = content;
    const updated = await db.update(notesTable).set(updates).where(eq(notesTable.id, Number(id))).returning();
    if (updated.length === 0) return res.status(404).json({ error: "Note not found" });
    const n = updated[0];
    res.json({ id: n.id, grade: n.grade, subject: n.subject, chapter: n.chapter, title: n.title, contentType: n.contentType, content: n.content, createdAt: n.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/notes/:id", async (req, res) => {
  try {
    await db.delete(notesTable).where(eq(notesTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
