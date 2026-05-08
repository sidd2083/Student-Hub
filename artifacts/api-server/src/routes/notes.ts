import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function toNote(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    grade:       data.grade ?? null,
    subject:     data.subject ?? "",
    chapter:     data.chapter ?? "",
    title:       data.title ?? "",
    contentType: data.contentType ?? "text",
    content:     data.content ?? "",
    createdAt:   data.createdAt ?? new Date().toISOString(),
  };
}

router.get("/notes", async (req: Request, res: Response) => {
  try {
    const { grade, subject, chapter } = req.query;
    let query: FirebaseFirestore.Query = adminDb.collection("notes");
    if (grade)   query = query.where("grade",   "==", Number(grade));
    if (subject) query = query.where("subject", "==", String(subject));
    if (chapter) query = query.where("chapter", "==", String(chapter));
    query = query.orderBy("createdAt", "desc");
    const snap = await query.get();
    return res.json(snap.docs.map((d) => toNote(d.id, d.data())));
  } catch (err) {
    logger.error(err, "GET /notes");
    return res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.get("/notes/subjects", async (req: Request, res: Response) => {
  try {
    const { grade } = req.query;
    let query: FirebaseFirestore.Query = adminDb.collection("notes");
    if (grade) query = query.where("grade", "==", Number(grade));
    const snap = await query.get();
    const subjects = [...new Set(snap.docs.map((d) => d.data().subject as string))].sort();
    return res.json(subjects);
  } catch (err) {
    logger.error(err, "GET /notes/subjects");
    return res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

router.get("/notes/:id", async (req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection("notes").doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: "Note not found" });
    return res.json(toNote(snap.id, snap.data()!));
  } catch (err) {
    logger.error(err, "GET /notes/:id");
    return res.status(500).json({ error: "Failed to fetch note" });
  }
});

router.post("/notes", async (req: Request, res: Response) => {
  try {
    const { grade, subject, chapter, title, contentType, content } = req.body as Record<string, unknown>;
    if (!grade || !subject || !chapter || !title || !contentType || !content) {
      return res.status(400).json({ error: "Missing required fields: grade, subject, chapter, title, contentType, content" });
    }
    const data = { grade, subject, chapter, title, contentType, content, createdAt: new Date().toISOString() };
    const ref = await adminDb.collection("notes").add(data);
    return res.status(201).json(toNote(ref.id, data));
  } catch (err) {
    logger.error(err, "POST /notes");
    return res.status(500).json({ error: "Failed to create note" });
  }
});

router.patch("/notes/:id", async (req: Request, res: Response) => {
  try {
    const { grade, subject, chapter, title, contentType, content } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (grade       !== undefined) updates.grade       = grade;
    if (subject     !== undefined) updates.subject     = subject;
    if (chapter     !== undefined) updates.chapter     = chapter;
    if (title       !== undefined) updates.title       = title;
    if (contentType !== undefined) updates.contentType = contentType;
    if (content     !== undefined) updates.content     = content;
    const docRef = adminDb.collection("notes").doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Note not found" });
    await docRef.update(updates);
    const updated = await docRef.get();
    return res.json(toNote(updated.id, updated.data()!));
  } catch (err) {
    logger.error(err, "PATCH /notes/:id");
    return res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/notes/:id", async (req: Request, res: Response) => {
  try {
    await adminDb.collection("notes").doc(req.params.id).delete();
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "DELETE /notes/:id");
    return res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
