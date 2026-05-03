import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map(u => ({
      id: u.id,
      uid: u.uid,
      name: u.name,
      email: u.email,
      grade: u.grade,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { uid, name, email, grade, role } = req.body;
    if (!uid || !name || !email || !grade) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.uid, uid));
    if (existing.length > 0) {
      const updated = await db.update(usersTable)
        .set({ name, email, grade, ...(role ? { role } : {}) })
        .where(eq(usersTable.uid, uid))
        .returning();
      const u = updated[0];
      return res.json({ id: u.id, uid: u.uid, name: u.name, email: u.email, grade: u.grade, role: u.role, createdAt: u.createdAt.toISOString() });
    }
    const inserted = await db.insert(usersTable).values({ uid, name, email, grade, role: role || "user" }).returning();
    const u = inserted[0];
    res.json({ id: u.id, uid: u.uid, name: u.name, email: u.email, grade: u.grade, role: u.role, createdAt: u.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
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
      byGrade[String(u.grade)] = (byGrade[String(u.grade)] || 0) + 1;
      if (u.role === "admin") admins++;
      if (u.createdAt >= today) newToday++;
    }
    res.json({ total: users.length, byGrade, admins, newToday });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const users = await db.select().from(usersTable).where(eq(usersTable.uid, uid));
    if (users.length === 0) return res.status(404).json({ error: "User not found" });
    const u = users[0];
    res.json({ id: u.id, uid: u.uid, name: u.name, email: u.email, grade: u.grade, role: u.role, createdAt: u.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, grade, role } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (grade !== undefined) updates.grade = grade;
    if (role !== undefined) updates.role = role;
    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.uid, uid)).returning();
    if (updated.length === 0) return res.status(404).json({ error: "User not found" });
    const u = updated[0];
    res.json({ id: u.id, uid: u.uid, name: u.name, email: u.email, grade: u.grade, role: u.role, createdAt: u.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    await db.delete(usersTable).where(eq(usersTable.uid, uid));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
