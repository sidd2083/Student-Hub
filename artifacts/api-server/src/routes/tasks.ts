import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/tasks",         (_req: Request, res: Response) => res.json([]));
router.post("/tasks",        (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.patch("/tasks/:id",   (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/tasks/:id",  (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));

export default router;
