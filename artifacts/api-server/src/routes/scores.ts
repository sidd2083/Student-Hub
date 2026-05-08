import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/scores",        (_req: Request, res: Response) => res.json([]));
router.post("/scores",       (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.post("/scores/reset", (_req: Request, res: Response) => res.json({ success: true }));

export default router;
