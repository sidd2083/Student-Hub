import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { pyqsTable } from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

type PyqRow = typeof pyqsTable.$inferSelect;

const toPyq = (p: PyqRow) => ({
  id:        p.id,
  grade:     p.grade,
  subject:   p.subject,
  title:     p.title,
  year:      p.year,
  pdfUrl:    p.pdfUrl,
  fileType:  p.fileType ?? "pdf",
  createdAt: p.createdAt.toISOString(),
});

router.get("/pyqs", async (req: Request, res: Response) => {
  try {
    const { grade, subject } = req.query;
    const conditions: SQL<unknown>[] = [];
    if (grade)   conditions.push(eq(pyqsTable.grade,   Number(grade)));
    if (subject) conditions.push(eq(pyqsTable.subject, String(subject)));
    const pyqs = conditions.length > 0
      ? await db.select().from(pyqsTable).where(and(...conditions)).orderBy(pyqsTable.year)
      : await db.select().from(pyqsTable).orderBy(pyqsTable.year);
    return res.json(pyqs.map(toPyq));
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/pyqs", async (req: Request, res: Response) => {
  try {
    const { grade, subject, title, year, pdfUrl, fileType } = req.body as Record<string, unknown>;
    if (!grade || !subject || !title || !year || !pdfUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const inserted = await db.insert(pyqsTable).values({
      grade, subject, title, year, pdfUrl,
      fileType: (fileType as string) || "pdf",
    } as PyqRow).returning();
    return res.status(201).json(toPyq(inserted[0]));
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/pyqs/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(pyqsTable).where(eq(pyqsTable.id, Number(req.params.id)));
    return res.json({ success: true });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
