import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/pyqs",        (_req: Request, res: Response) => res.json([]));
router.post("/pyqs",       (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/pyqs/:id", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));

export default router;
