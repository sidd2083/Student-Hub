import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function toTask(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    uid:       data.uid ?? "",
    text:      data.text ?? "",
    completed: data.completed ?? false,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid is required" });
    const snap = await adminDb.collection("tasks")
      .where("uid", "==", String(uid))
      .orderBy("createdAt")
      .get();
    return res.json(snap.docs.map((d) => toTask(d.id, d.data())));
  } catch (err) {
    logger.error(err, "GET /tasks");
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const { uid, text } = req.body as Record<string, string>;
    if (!uid || !text) return res.status(400).json({ error: "Missing required fields: uid, text" });
    const data = { uid, text, completed: false, createdAt: new Date().toISOString() };
    const ref = await adminDb.collection("tasks").add(data);
    return res.status(201).json(toTask(ref.id, data));
  } catch (err) {
    logger.error(err, "POST /tasks");
    return res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const { text, completed } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (text      !== undefined) updates.text      = text;
    if (completed !== undefined) updates.completed = completed;
    const docRef = adminDb.collection("tasks").doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Task not found" });
    await docRef.update(updates);
    const updated = await docRef.get();
    return res.json(toTask(updated.id, updated.data()!));
  } catch (err) {
    logger.error(err, "PATCH /tasks/:id");
    return res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    await adminDb.collection("tasks").doc(req.params.id).delete();
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "DELETE /tasks/:id");
    return res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
