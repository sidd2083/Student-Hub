import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function toPyq(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    grade:     data.grade ?? null,
    subject:   data.subject ?? "",
    title:     data.title ?? "",
    year:      data.year ?? null,
    pdfUrl:    data.pdfUrl ?? "",
    fileType:  data.fileType ?? "pdf",
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

router.get("/pyqs", async (req: Request, res: Response) => {
  try {
    const { grade, subject } = req.query;
    let query: FirebaseFirestore.Query = adminDb.collection("pyqs");
    if (grade)   query = query.where("grade",   "==", Number(grade));
    if (subject) query = query.where("subject", "==", String(subject));
    query = query.orderBy("createdAt", "desc");
    const snap = await query.get();
    return res.json(snap.docs.map((d) => toPyq(d.id, d.data())));
  } catch (err) {
    logger.error(err, "GET /pyqs");
    return res.status(500).json({ error: "Failed to fetch PYQs" });
  }
});

router.post("/pyqs", async (req: Request, res: Response) => {
  try {
    const { grade, subject, title, year, pdfUrl, fileType } = req.body as Record<string, unknown>;
    if (!grade || !subject || !title || !year || !pdfUrl) {
      return res.status(400).json({ error: "Missing required fields: grade, subject, title, year, pdfUrl" });
    }
    const data = { grade, subject, title, year, pdfUrl, fileType: fileType ?? "pdf", createdAt: new Date().toISOString() };
    const ref = await adminDb.collection("pyqs").add(data);
    return res.status(201).json(toPyq(ref.id, data));
  } catch (err) {
    logger.error(err, "POST /pyqs");
    return res.status(500).json({ error: "Failed to create PYQ" });
  }
});

router.delete("/pyqs/:id", async (req: Request, res: Response) => {
  try {
    await adminDb.collection("pyqs").doc(req.params.id).delete();
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "DELETE /pyqs/:id");
    return res.status(500).json({ error: "Failed to delete PYQ" });
  }
});

export default router;
