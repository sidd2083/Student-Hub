import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

router.get("/saved", async (req: Request, res: Response) => {
  try {
    const uid = String(req.query.uid || "");
    if (!uid) return res.status(400).json({ error: "uid required" });

    const snap = await adminDb.collection("saved_items")
      .where("uid", "==", uid)
      .orderBy("createdAt")
      .get();

    const enriched = await Promise.all(snap.docs.map(async (d) => {
      const row = { id: d.id, ...d.data() } as Record<string, unknown>;
      try {
        if (row.itemType === "note" && row.itemId) {
          const noteSnap = await adminDb.collection("notes").doc(String(row.itemId)).get();
          if (noteSnap.exists) {
            const n = noteSnap.data()!;
            return { ...row, title: n.title, subject: n.subject, grade: n.grade, contentType: n.contentType, content: n.content };
          }
        } else if (row.itemType === "pyq" && row.itemId) {
          const pyqSnap = await adminDb.collection("pyqs").doc(String(row.itemId)).get();
          if (pyqSnap.exists) {
            const p = pyqSnap.data()!;
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
    logger.error(err, "GET /saved");
    return res.status(500).json({ error: "Failed to fetch saved items" });
  }
});

router.post("/saved", async (req: Request, res: Response) => {
  try {
    const { uid, itemType, itemId } = req.body as { uid?: string; itemType?: string; itemId?: string };
    if (!uid || !itemType || !itemId) return res.status(400).json({ error: "uid, itemType, itemId required" });
    if (itemType !== "note" && itemType !== "pyq") return res.status(400).json({ error: "itemType must be note or pyq" });

    const existing = await adminDb.collection("saved_items")
      .where("uid", "==", uid)
      .where("itemType", "==", itemType)
      .where("itemId", "==", itemId)
      .get();

    if (!existing.empty) {
      return res.json({ id: existing.docs[0].id, alreadySaved: true });
    }

    const data = { uid, itemType, itemId, createdAt: new Date().toISOString() };
    const ref = await adminDb.collection("saved_items").add(data);
    return res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    logger.error(err, "POST /saved");
    return res.status(500).json({ error: "Failed to save item" });
  }
});

router.delete("/saved/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const uid = String(req.query.uid || "");
    if (!uid) return res.status(400).json({ error: "uid required" });

    const docRef = adminDb.collection("saved_items").doc(id);
    const snap = await docRef.get();
    if (snap.exists && snap.data()!.uid === uid) {
      await docRef.delete();
    }

    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "DELETE /saved/:id");
    return res.status(500).json({ error: "Failed to delete saved item" });
  }
});

router.get("/saved/check", async (req: Request, res: Response) => {
  try {
    const uid = String(req.query.uid || "");
    const itemType = String(req.query.itemType || "");
    const itemId = String(req.query.itemId || "");
    if (!uid || !itemType || !itemId) return res.status(400).json({ error: "uid, itemType, itemId required" });

    const snap = await adminDb.collection("saved_items")
      .where("uid", "==", uid)
      .where("itemType", "==", itemType)
      .where("itemId", "==", itemId)
      .get();

    return res.json({ saved: !snap.empty, id: snap.empty ? null : snap.docs[0].id });
  } catch (err) {
    logger.error(err, "GET /saved/check");
    return res.status(500).json({ error: "Failed to check saved status" });
  }
});

export default router;
