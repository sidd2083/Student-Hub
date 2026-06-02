import { Router } from "express";
import type { Request, Response } from "express";
import { getAdminDb } from "../lib/firebase-admin";

const router = Router();

const ADMIN_KEY = process.env.ADMIN_KEY ?? "siddhant2078";

function isAdmin(req: Request): boolean {
  return req.headers["x-admin-key"] === ADMIN_KEY;
}

// ── Admin: search users ───────────────────────────────────────────────────────
router.get("/users", async (req: Request, res: Response) => {
  if (!isAdmin(req)) return res.json([]);
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
