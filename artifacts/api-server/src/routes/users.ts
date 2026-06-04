import { Router } from "express";
import type { Request, Response } from "express";
import { getAdminDb, getAdminAuth } from "../lib/firebase-admin";

const router = Router();

// ── Admin verification ────────────────────────────────────────────────────────
// Accepts a Firebase ID token (from signed-in admin users) or an env-based
// ADMIN_KEY header (for server-to-server / CLI access). Never expose ADMIN_KEY
// in frontend code — use Firebase token auth instead.
async function isAdmin(req: Request): Promise<boolean> {
  // Primary: Firebase ID token with role === "admin" in Firestore
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const adminAuth = getAdminAuth();
      if (!adminAuth) return false;
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      const db = getAdminDb();
      if (!db) return false;
      const snap = await db.collection("users").doc(decoded.uid).get();
      return snap.data()?.role === "admin";
    } catch { return false; }
  }
  // Fallback: env-based key for CLI/cron access only — never put this in frontend
  const envKey = process.env.ADMIN_KEY;
  if (envKey && req.headers["x-admin-key"] === envKey) return true;
  return false;
}

// ── Admin: search users ───────────────────────────────────────────────────────
router.get("/users", async (req: Request, res: Response) => {
  if (!(await isAdmin(req))) return res.json([]);
  try {
    const db = getAdminDb();
    if (!db) return res.json([]);
    const q = ((req.query.q as string) ?? "").toLowerCase().trim();
    const snap = await db.collection("users").orderBy("name").limit(60).get();
    const users = snap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        name: (data.name as string) ?? "",
        grade: (data.grade as number) ?? 0,
        photoURL: (data.photoURL as string | null) ?? null,
      };
    });
    return res.json(q ? users.filter(u => u.name.toLowerCase().includes(q)) : users);
  } catch { return res.json([]); }
});

// ── Public: safe profile for creator cards ────────────────────────────────────
router.get("/users/stats/summary", (_req: Request, res: Response) =>
  res.json({ total: 0, byGrade: {}, admins: 0, newToday: 0 }),
);

router.get("/users/:uid/profile", async (req: Request, res: Response) => {
  try {
    const db = getAdminDb();
    if (!db) return res.status(503).json({ error: "Database unavailable." });
    const doc = await db.collection("users").doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found." });
    const d = doc.data()!;
    return res.json({
      uid: doc.id,
      name: d.name ?? null,
      grade: d.grade ?? null,
      photoURL: d.photoURL ?? null,
      streak: d.streak ?? 0,
      totalStudyTime: d.totalStudyTime ?? 0,
      badges: d.badges ?? [],
      missionCompletedDays: d.missionCompletedDays ?? 0,
    });
  } catch { return res.status(500).json({ error: "Failed to fetch profile." }); }
});

router.get("/users/:uid", (_req: Request, res: Response) =>
  res.status(404).json({ error: "User not found" }),
);

router.post("/users",           (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.put("/users/:uid/badges",(_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.patch("/users/:uid",     (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/users/:uid",    (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));

export default router;
