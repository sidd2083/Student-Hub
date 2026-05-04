import { Router } from "express";
import { db } from "@workspace/db";
import { pyqsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const toPyq = (p: typeof pyqsTable.$inferSelect) => ({
  id: p.id,
  grade: p.grade,
  subject: p.subject,
  title: p.title,
  year: p.year,
  pdfUrl: p.pdfUrl,
  fileType: p.fileType ?? "pdf",
  createdAt: p.createdAt.toISOString(),
});

router.get("/pyqs", async (req, res) => {
  try {
    const { grade, subject } = req.query;
    const conditions = [];
    if (grade) conditions.push(eq(pyqsTable.grade, Number(grade)));
    if (subject) conditions.push(eq(pyqsTable.subject, String(subject)));
    const pyqs = conditions.length > 0
      ? await db.select().from(pyqsTable).where(and(...conditions)).orderBy(pyqsTable.year)
      : await db.select().from(pyqsTable).orderBy(pyqsTable.year);
    res.json(pyqs.map(toPyq));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/pyqs", async (req, res) => {
  try {
    const { grade, subject, title, year, pdfUrl, fileType } = req.body;
    if (!grade || !subject || !title || !year || !pdfUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const inserted = await db.insert(pyqsTable).values({
      grade, subject, title, year, pdfUrl,
      fileType: fileType || "pdf",
    }).returning();
    res.status(201).json(toPyq(inserted[0]));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/pyqs/:id", async (req, res) => {
  try {
    await db.delete(pyqsTable).where(eq(pyqsTable.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
