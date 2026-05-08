import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/users",              (_req: Request, res: Response) => res.json([]));
router.post("/users",             (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.get("/users/stats/summary",(_req: Request, res: Response) => res.json({ total: 0, byGrade: {}, admins: 0, newToday: 0 }));
router.get("/users/:uid",         (_req: Request, res: Response) => res.status(404).json({ error: "User not found" }));
router.put("/users/:uid/badges",  (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.patch("/users/:uid",       (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/users/:uid",      (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));

export default router;
