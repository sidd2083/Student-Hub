import { Router, type Request, type Response, type NextFunction } from "express";
import { getAdminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_KEY = process.env.ADMIN_KEY ?? "siddhant2078";

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized: invalid admin key." });
    return;
  }
  next();
}

function noDb(res: Response): boolean {
  const db = getAdminDb();
  if (!db) {
    res.status(503).json({
      error: "Database unavailable. Set FIREBASE_SERVICE_ACCOUNT_JSON in your environment secrets.",
    });
    return true;
  }
  return false;
}

// ── Public: list visible creators ordered by display order ────────────────────
router.get("/creators", async (_req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (!db) { noDb(res); return; }
    const snap = await db.collection("creators")
      .where("visible", "==", true)
      .orderBy("order", "asc")
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    logger.error(err, "[Creators] GET /creators failed");
    res.status(500).json({ error: "Failed to fetch creators." });
  }
});

// ── Admin: list ALL creators (including hidden) ───────────────────────────────
router.get("/creators/all", requireAdminKey, async (_req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (noDb(res)) return;
    const snap = await db!.collection("creators").orderBy("order", "asc").get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    logger.error(err, "[Creators] GET /creators/all failed");
    res.status(500).json({ error: "Failed to fetch creators." });
  }
});

// ── Admin: create creator ─────────────────────────────────────────────────────
router.post("/creators", requireAdminKey, async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (noDb(res)) return;
    const data = { ...req.body, createdAt: req.body.createdAt ?? new Date().toISOString().slice(0, 10) };
    const ref = await db!.collection("creators").add(data);
    res.json({ id: ref.id });
  } catch (err) {
    logger.error(err, "[Creators] POST /creators failed");
    res.status(500).json({ error: "Failed to create creator." });
  }
});

// ── Admin: update creator ─────────────────────────────────────────────────────
router.put("/creators/:id", requireAdminKey, async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (noDb(res)) return;
    await db!.collection("creators").doc(req.params.id).update(req.body);
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "[Creators] PUT /creators/:id failed");
    res.status(500).json({ error: "Failed to update creator." });
  }
});

// ── Admin: delete creator ─────────────────────────────────────────────────────
router.delete("/creators/:id", requireAdminKey, async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (noDb(res)) return;
    await db!.collection("creators").doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "[Creators] DELETE /creators/:id failed");
    res.status(500).json({ error: "Failed to delete creator." });
  }
});

export default router;
