import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function toAnnouncement(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    title:     data.title ?? "",
    body:      data.body ?? "",
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

router.get("/announcements", async (_req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection("announcements")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return res.json(snap.docs.map((d) => toAnnouncement(d.id, d.data())));
  } catch (err) {
    logger.error(err, "GET /announcements");
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post("/announcements", async (req: Request, res: Response) => {
  try {
    const { title, body } = req.body as { title?: string; body?: string };
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "title and body are required" });
    }
    const data = { title: title.trim(), body: body.trim(), createdAt: new Date().toISOString() };
    const ref = await adminDb.collection("announcements").add(data);
    return res.status(201).json(toAnnouncement(ref.id, data));
  } catch (err) {
    logger.error(err, "POST /announcements");
    return res.status(500).json({ error: "Failed to create announcement" });
  }
});

router.delete("/announcements/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Invalid id" });
    await adminDb.collection("announcements").doc(id).delete();
    return res.status(204).end();
  } catch (err) {
    logger.error(err, "DELETE /announcements/:id");
    return res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
