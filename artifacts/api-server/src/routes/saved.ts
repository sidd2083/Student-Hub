import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { savedItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/saved?uid=xxx — list saved items with full item details
router.get("/saved", async (req: Request, res: Response) => {
  try {
    const uid = String(req.query.uid || "");
    if (!uid) return res.status(400).json({ error: "uid required" });

    const rows = await db.select().from(savedItemsTable)
      .where(eq(savedItemsTable.uid, uid))
      .orderBy(savedItemsTable.createdAt);

    // Enrich with item details
    const enriched = await Promise.all(rows.map(async (row) => {
      try {
        const endpoint = row.itemType === "note" ? `/api/notes/${row.itemId}` : null;
        if (row.itemType === "note") {
          const { notesTable } = await import("@workspace/db");
          const notes = await db.select().from(notesTable)
            .where(eq(notesTable.id, row.itemId));
          if (notes.length > 0) {
            const n = notes[0];
            return { ...row, title: n.title, subject: n.subject, grade: n.grade, contentType: n.contentType, content: n.content };
          }
        } else if (row.itemType === "pyq") {
          const { pyqsTable } = await import("@workspace/db");
          const pyqs = await db.select().from(pyqsTable)
            .where(eq(pyqsTable.id, row.itemId));
          if (pyqs.length > 0) {
            const p = pyqs[0];
            return { ...row, title: p.title, subject: p.subject, grade: p.grade, year: p.year, fileType: p.fileType, pdfUrl: p.pdfUrl };
          }
        }
      } catch (e) {
        logger.error(e, "Error enriching saved item");
      }
      return row;
    }));

    return res.json(enriched);
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/saved — save an item
router.post("/saved", async (req: Request, res: Response) => {
  try {
    const { uid, itemType, itemId } = req.body as { uid?: string; itemType?: string; itemId?: number };
    if (!uid || !itemType || !itemId) return res.status(400).json({ error: "uid, itemType, itemId required" });
    if (itemType !== "note" && itemType !== "pyq") return res.status(400).json({ error: "itemType must be note or pyq" });

    // Check if already saved
    const existing = await db.select().from(savedItemsTable)
      .where(and(eq(savedItemsTable.uid, uid), eq(savedItemsTable.itemType, itemType), eq(savedItemsTable.itemId, itemId)));

    if (existing.length > 0) {
      return res.json({ id: existing[0].id, alreadySaved: true });
    }

    const inserted = await db.insert(savedItemsTable)
      .values({ uid, itemType, itemId })
      .returning();

    return res.status(201).json(inserted[0]);
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/saved/:id?uid=xxx — unsave
router.delete("/saved/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const uid = String(req.query.uid || "");
    if (!uid) return res.status(400).json({ error: "uid required" });

    await db.delete(savedItemsTable)
      .where(and(eq(savedItemsTable.id, id), eq(savedItemsTable.uid, uid)));

    return res.json({ success: true });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/saved/check?uid=xxx&itemType=note&itemId=1 — check if saved
router.get("/saved/check", async (req: Request, res: Response) => {
  try {
    const uid = String(req.query.uid || "");
    const itemType = String(req.query.itemType || "");
    const itemId = Number(req.query.itemId);
    if (!uid || !itemType || !itemId) return res.status(400).json({ error: "uid, itemType, itemId required" });

    const existing = await db.select().from(savedItemsTable)
      .where(and(eq(savedItemsTable.uid, uid), eq(savedItemsTable.itemType, itemType as "note" | "pyq"), eq(savedItemsTable.itemId, itemId)));

    return res.json({ saved: existing.length > 0, id: existing[0]?.id ?? null });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
