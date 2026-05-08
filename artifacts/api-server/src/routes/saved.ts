import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/saved",        (_req: Request, res: Response) => res.json([]));
router.post("/saved",       (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/saved/:id", (_req: Request, res: Response) => res.json({ success: true }));
router.get("/saved/check",  (_req: Request, res: Response) => res.json({ saved: false, id: null }));

export default router;
