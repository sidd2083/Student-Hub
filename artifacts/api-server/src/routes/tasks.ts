import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/tasks", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid is required" });
    const tasks = await db.select().from(tasksTable)
      .where(eq(tasksTable.uid, String(uid)))
      .orderBy(tasksTable.createdAt);
    res.json(tasks.map(t => ({
      id: t.id, uid: t.uid, text: t.text, completed: t.completed,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const { uid, text } = req.body;
    if (!uid || !text) return res.status(400).json({ error: "Missing required fields" });
    const inserted = await db.insert(tasksTable).values({ uid, text, completed: false }).returning();
    const t = inserted[0];
    res.status(201).json({ id: t.id, uid: t.uid, text: t.text, completed: t.completed, createdAt: t.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { text, completed } = req.body;
    const updates: Record<string, unknown> = {};
    if (text !== undefined) updates.text = text;
    if (completed !== undefined) updates.completed = completed;
    const updated = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, Number(id))).returning();
    if (updated.length === 0) return res.status(404).json({ error: "Task not found" });
    const t = updated[0];
    res.json({ id: t.id, uid: t.uid, text: t.text, completed: t.completed, createdAt: t.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    await db.delete(tasksTable).where(eq(tasksTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
