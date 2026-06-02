import { Router, type Request, type Response, type NextFunction } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getAdminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_KEY      = process.env.ADMIN_KEY ?? "siddhant2078";
const CREATORS_FILE  = resolve(process.cwd(), "creators.json");

interface Creator {
  id: string;
  name: string;
  image: string;
  description: string;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  featured: boolean;
  visible: boolean;
  order: number;
  createdAt: string;
}

// ── JSON file storage (used when Firestore Admin SDK is unavailable) ──────────
function fileRead(): Creator[] {
  try {
    if (!existsSync(CREATORS_FILE)) return [];
    return JSON.parse(readFileSync(CREATORS_FILE, "utf8")) as Creator[];
  } catch { return []; }
}

function fileWrite(list: Creator[]): void {
  try { writeFileSync(CREATORS_FILE, JSON.stringify(list, null, 2), "utf8"); }
  catch (e) { logger.error(e, "[Creators] Failed to write creators.json"); }
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized: invalid admin key." });
    return;
  }
  next();
}

// ── Public: visible creators ordered by display order ────────────────────────
router.get("/creators", async (_req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (db) {
      const snap = await db.collection("creators")
        .where("visible", "==", true)
        .orderBy("order", "asc")
        .get();
      return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    // ── Fallback: local JSON file ─────────────────────────────────────────────
    const all = fileRead();
    return res.json(all.filter(c => c.visible).sort((a, b) => a.order - b.order));
  } catch (err) {
    logger.error(err, "[Creators] GET /creators");
    return res.status(500).json({ error: "Failed to fetch creators." });
  }
});

// ── Admin: all creators including hidden ─────────────────────────────────────
router.get("/creators/all", requireAdminKey, async (_req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (db) {
      const snap = await db.collection("creators").orderBy("order", "asc").get();
      return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    return res.json(fileRead().sort((a, b) => a.order - b.order));
  } catch (err) {
    logger.error(err, "[Creators] GET /creators/all");
    return res.status(500).json({ error: "Failed to fetch creators." });
  }
});

// ── Admin: create creator ─────────────────────────────────────────────────────
router.post("/creators", requireAdminKey, async (req: Request, res: Response) => {
  try {
    const db   = getAdminDb();
    const data = { ...req.body, createdAt: req.body.createdAt ?? new Date().toISOString().slice(0, 10) };
    if (db) {
      const ref = await db.collection("creators").add(data);
      return res.json({ id: ref.id });
    }
    const list = fileRead();
    const id   = newId();
    list.push({ ...data, id });
    fileWrite(list);
    return res.json({ id });
  } catch (err) {
    logger.error(err, "[Creators] POST /creators");
    return res.status(500).json({ error: "Failed to create creator." });
  }
});

// ── Admin: update creator ─────────────────────────────────────────────────────
router.put("/creators/:id", requireAdminKey, async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (db) {
      await db.collection("creators").doc(req.params.id).update(req.body);
      return res.json({ ok: true });
    }
    const list = fileRead();
    const idx  = list.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Creator not found." });
    list[idx] = { ...list[idx], ...req.body };
    fileWrite(list);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "[Creators] PUT /creators/:id");
    return res.status(500).json({ error: "Failed to update creator." });
  }
});

// ── Admin: delete creator ─────────────────────────────────────────────────────
router.delete("/creators/:id", requireAdminKey, async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (db) {
      await db.collection("creators").doc(req.params.id).delete();
      return res.json({ ok: true });
    }
    const list = fileRead().filter(c => c.id !== req.params.id);
    fileWrite(list);
    return res.json({ ok: true });
  } catch (err) {
    logger.error(err, "[Creators] DELETE /creators/:id");
    return res.status(500).json({ error: "Failed to delete creator." });
  }
});

export default router;
