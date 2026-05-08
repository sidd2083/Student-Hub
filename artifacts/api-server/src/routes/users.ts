import { Router } from "express";
import type { Request, Response } from "express";
import { adminDb } from "../lib/firestore-admin";
import { logger } from "../lib/logger";

const router = Router();

function toUser(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    uid:            data.uid ?? id,
    name:           data.name ?? "",
    email:          data.email ?? "",
    grade:          data.grade ?? null,
    role:           data.role ?? "user",
    createdAt:      data.createdAt ?? new Date().toISOString(),
    streak:         data.streak ?? 0,
    totalStudyTime: data.totalStudyTime ?? 0,
    todayStudyTime: data.todayStudyTime ?? 0,
    lastActiveDate: data.lastActiveDate ?? null,
    badges:         Array.isArray(data.badges) ? data.badges : [],
  };
}

router.get("/users", async (_req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection("users").orderBy("createdAt").get();
    return res.json(snap.docs.map((d) => toUser(d.id, d.data())));
  } catch (err) {
    logger.error(err, "GET /users");
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/users", async (req: Request, res: Response) => {
  try {
    const { uid, name, email, grade, role } = req.body as {
      uid?: string; name?: string; email?: string;
      grade?: string | number; role?: "user" | "admin";
    };
    if (!uid || !name || !email || !grade) {
      return res.status(400).json({ error: "Missing required fields: uid, name, email, grade" });
    }
    const roleVal: "user" | "admin" = role === "admin" ? "admin" : "user";
    const docRef = adminDb.collection("users").doc(uid);
    const existing = await docRef.get();
    const data = {
      uid, name, email,
      grade: Number(grade),
      role: roleVal,
      createdAt: existing.exists ? existing.data()!.createdAt : new Date().toISOString(),
      streak:         existing.exists ? (existing.data()!.streak ?? 0) : 0,
      totalStudyTime: existing.exists ? (existing.data()!.totalStudyTime ?? 0) : 0,
      todayStudyTime: existing.exists ? (existing.data()!.todayStudyTime ?? 0) : 0,
      lastActiveDate: existing.exists ? (existing.data()!.lastActiveDate ?? null) : null,
      badges:         existing.exists ? (existing.data()!.badges ?? []) : [],
    };
    await docRef.set(data, { merge: true });
    const status = existing.exists ? 200 : 201;
    return res.status(status).json(toUser(uid, data));
  } catch (err) {
    logger.error(err, "POST /users");
    return res.status(500).json({ error: "Failed to save user" });
  }
});

router.get("/users/stats/summary", async (_req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection("users").get();
    const byGrade: Record<string, number> = {};
    let admins = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    let newToday = 0;
    for (const d of snap.docs) {
      const data = d.data();
      const g = String(data.grade ?? "unknown");
      byGrade[g] = (byGrade[g] ?? 0) + 1;
      if (data.role === "admin") admins++;
      if (typeof data.createdAt === "string" && data.createdAt.startsWith(todayStr)) newToday++;
    }
    return res.json({ total: snap.size, byGrade, admins, newToday });
  } catch (err) {
    logger.error(err, "GET /users/stats/summary");
    return res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

router.get("/users/:uid", async (req: Request, res: Response) => {
  try {
    const docRef = adminDb.collection("users").doc(req.params.uid);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    return res.json(toUser(snap.id, snap.data()!));
  } catch (err) {
    logger.error(err, "GET /users/:uid");
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.put("/users/:uid/badges", async (req: Request, res: Response) => {
  try {
    const { badges } = req.body as { badges?: unknown };
    if (!Array.isArray(badges)) return res.status(400).json({ error: "badges must be an array" });
    const docRef = adminDb.collection("users").doc(req.params.uid);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    await docRef.update({ badges });
    return res.json({ badges });
  } catch (err) {
    logger.error(err, "PUT /users/:uid/badges");
    return res.status(500).json({ error: "Failed to update badges" });
  }
});

router.patch("/users/:uid", async (req: Request, res: Response) => {
  try {
    const { name, grade, role, email } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (name  !== undefined) updates.name  = name;
    if (email !== undefined) updates.email = email;
    if (grade !== undefined) updates.grade = grade;
    if (role  !== undefined) updates.role  = role;
    const docRef = adminDb.collection("users").doc(req.params.uid);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "User not found" });
    await docRef.update(updates);
    const updated = await docRef.get();
    return res.json(toUser(updated.id, updated.data()!));
  } catch (err) {
    logger.error(err, "PATCH /users/:uid");
    return res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:uid", async (req: Request, res: Response) => {
  try {
    await adminDb.collection("users").doc(req.params.uid).delete();
    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "DELETE /users/:uid");
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
