import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/announcements",        (_req: Request, res: Response) => res.json([]));
router.post("/announcements",       (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/announcements/:id", (_req: Request, res: Response) => res.status(204).end());

export default router;
