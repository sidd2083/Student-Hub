import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { announcements } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

type AnnouncementRow = typeof announcements.$inferSelect;

const toAnnouncement = (r: AnnouncementRow) => ({
  id:        r.id,
  title:     r.title,
  body:      r.body,
  createdAt: r.createdAt.toISOString(),
});

router.get("/announcements", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(50);
    return res.json(rows.map(toAnnouncement));
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post("/announcements", async (req: Request, res: Response) => {
  try {
    const { title, body } = req.body as { title?: string; body?: string };
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "title and body are required" });
    }
    const [row] = await db
      .insert(announcements)
      .values({ title: title.trim(), body: body.trim() })
      .returning();
    return res.status(201).json(toAnnouncement(row));
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.delete("/announcements/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid id" });
    }
    await db.delete(announcements).where(eq(announcements.id, id));
    return res.status(204).end();
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
