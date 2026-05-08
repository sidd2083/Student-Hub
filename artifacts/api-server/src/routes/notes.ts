import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/notes",          (_req: Request, res: Response) => res.json([]));
router.get("/notes/subjects", (_req: Request, res: Response) => res.json([]));
router.get("/notes/:id",      (_req: Request, res: Response) => res.status(404).json({ error: "Note not found" }));
router.post("/notes",         (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.patch("/notes/:id",    (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.delete("/notes/:id",   (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));

export default router;
