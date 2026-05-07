import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

type UserRow = typeof usersTable.$inferSelect;

function parseBadges(raw: string | null | undefined): unknown[] {
  try { return JSON.parse(raw ?? "[]"); } catch { return []; }
}

const toUser = (u: UserRow) => ({
  id:             u.id,
  uid:            u.uid,
  name:           u.name,
  email:          u.email,
  grade:          u.grade,
  role:           u.role,
  createdAt:      u.createdAt.toISOString(),
  streak:         u.streak,
  totalStudyTime: u.totalStudyTime,
  todayStudyTime: u.todayStudyTime,
  lastActiveDate: u.lastActiveDate,
  badges:         parseBadges(u.badges),
});

router.get("/users", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    return res.json(users.map(toUser));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { uid, name, email, grade, role } = req.body as { uid?: string; name?: string; email?: string; grade?: string | number; role?: "user" | "admin" };
    if (!uid || !name || !email || !grade) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const roleVal: "user" | "admin" = role === "admin" ? "admin" : "user";
    const existing = await db.select().from(usersTable).where(eq(usersTable.uid, uid));
    if (existing.length > 0) {
      const updated = await db.update(usersTable)
        .set({ name, email, grade: Number(grade), role: roleVal })
        .where(eq(usersTable.uid, uid))
        .returning();
      return res.json(toUser(updated[0]));
    }
    const inserted = await db.insert(usersTable).values({ uid, name, email, grade: Number(grade), role: roleVal }).returning();
    return res.status(201).json(toUser(inserted[0]));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/stats/summary", async (req, res) => {
  try {
    const users = await db.select().from(usersTable);
    const byGrade: Record<string, number> = {};
    let admins = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let newToday = 0;
    for (const u of users) {
      byGrade[String(u.grade)] = (byGrade[String(u.grade)] ?? 0) + 1;
      if (u.role === "admin") admins++;
      if (u.createdAt >= today) newToday++;
    }
    return res.json({ total: users.length, byGrade, admins, newToday });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:uid", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.uid, req.params.uid));
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    return res.json(toUser(users[0]));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/users/:uid/badges", async (req, res) => {
  try {
    const { badges } = req.body as { badges?: unknown };
    if (!Array.isArray(badges)) return res.status(400).json({ error: "badges must be an array" });
    const updated = await db.update(usersTable)
      .set({ badges: JSON.stringify(badges) })
      .where(eq(usersTable.uid, req.params.uid))
      .returning();
    if (updated.length === 0) return res.status(404).json({ error: "User not found" });
    return res.json({ badges: parseBadges(updated[0].badges) });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:uid", async (req, res) => {
  try {
    const { name, grade, role } = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (name  !== undefined) updates.name  = name;
    if (grade !== undefined) updates.grade = grade;
    if (role  !== undefined) updates.role  = role;
    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.uid, req.params.uid)).returning();
    if (updated.length === 0) return res.status(404).json({ error: "User not found" });
    return res.json(toUser(updated[0]));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:uid", async (req, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.uid, req.params.uid));
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
