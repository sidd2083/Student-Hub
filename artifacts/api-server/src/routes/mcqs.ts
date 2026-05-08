import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/mcqs",        (_req: Request, res: Response) => res.json([]));
router.post("/mcqs",       (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.patch("/mcqs/:id",  (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/mcqs/:id", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));

export default router;
