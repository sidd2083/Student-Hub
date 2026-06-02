import { Router, type Request, type Response, type NextFunction } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getAdminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_KEY      = process.env.ADMIN_KEY ?? "siddhant2078";
const CREATORS_FILE  = resolve(process.cwd(), "creators.json");
const PROJECT_ID     = process.env.VITE_FIREBASE_PROJECT_ID ?? "studenthub-6bcc5";
const API_KEY        = process.env.VITE_FIREBASE_API_KEY ?? "";

interface Creator {
  id: string;
  name: string;
  image: string;
  description: string;
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  uid?: string | null;
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

// ── Firestore REST API fetch (no Admin SDK needed) ────────────────────────────
type FSField = { stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number; nullValue?: string };
type FSFields = Record<string, FSField>;
interface FSDoc { name: string; fields: FSFields; }

function parseCreatorDoc(d: FSDoc): Creator {
  const f = d.fields;
  const id = d.name.split("/").pop() ?? "";
  return {
    id,
    name:        f.name?.stringValue        ?? "",
    image:       f.image?.stringValue       ?? "",
    description: f.description?.stringValue ?? "",
    instagram:   f.instagram?.stringValue   ?? null,
    tiktok:      f.tiktok?.stringValue      ?? null,
    youtube:     f.youtube?.stringValue     ?? null,
    uid:         f.uid?.stringValue         ?? null,
    featured:    f.featured?.booleanValue   ?? false,
    visible:     f.visible?.booleanValue    ?? true,
    order:       Number(f.order?.integerValue ?? f.order?.doubleValue ?? 0),
    createdAt:   f.createdAt?.stringValue   ?? "",
  };
}

async function fetchCreatorsRest(): Promise<Creator[]> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/creators` +
    `?pageSize=300` +
    (API_KEY ? `&key=${encodeURIComponent(API_KEY)}` : "");
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Firestore REST error: ${res.status}`);
  const data = await res.json() as { documents?: FSDoc[] };
  return (data.documents ?? []).map(parseCreatorDoc);
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
    // ── Fallback 1: Firestore REST API ────────────────────────────────────────
    try {
      const all = await fetchCreatorsRest();
      return res.json(all.filter(c => c.visible).sort((a, b) => a.order - b.order));
    } catch (restErr) {
      logger.warn(restErr, "[Creators] REST API fallback failed, using local file");
    }
    // ── Fallback 2: local JSON file ───────────────────────────────────────────
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
    // ── Fallback 1: Firestore REST API ────────────────────────────────────────
    try {
      const all = await fetchCreatorsRest();
      return res.json(all.sort((a, b) => a.order - b.order));
    } catch (restErr) {
      logger.warn(restErr, "[Creators] REST API fallback failed, using local file");
    }
    // ── Fallback 2: local JSON file ───────────────────────────────────────────
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
