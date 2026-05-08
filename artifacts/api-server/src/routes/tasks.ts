import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { dbError } from "../lib/errors";

const router = Router();

type TaskRow = typeof tasksTable.$inferSelect;

const toTask = (t: TaskRow) => ({
  id:        t.id,
  uid:       t.uid,
  text:      t.text,
  completed: t.completed,
  createdAt: t.createdAt.toISOString(),
});

router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid is required" });
    const tasks = await db.select().from(tasksTable)
      .where(eq(tasksTable.uid, String(uid)))
      .orderBy(tasksTable.createdAt);
    return res.json(tasks.map(toTask));
  } catch (err) {
    return dbError(res, err);
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const { uid, text } = req.body as Record<string, string>;
    if (!uid || !text) return res.status(400).json({ error: "Missing required fields: uid, text" });
    const inserted = await db.insert(tasksTable).values({ uid, text, completed: false }).returning();
    return res.status(201).json(toTask(inserted[0]));
  } catch (err) {
    return dbError(res, err);
  }
});

router.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const { text, completed } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (text      !== undefined) updates.text      = text;
    if (completed !== undefined) updates.completed = completed;
    const updated = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, Number(req.params.id))).returning();
    if (updated.length === 0) return res.status(404).json({ error: "Task not found" });
    return res.json(toTask(updated[0]));
  } catch (err) {
    return dbError(res, err);
  }
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(tasksTable).where(eq(tasksTable.id, Number(req.params.id)));
    return res.json({ success: true });
  } catch (err) {
    return dbError(res, err);
  }
});

export default router;
