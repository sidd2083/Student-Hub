import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.post("/study/session",  (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.post("/study/log-task", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.post("/study/log-note", (_req: Request, res: Response) => res.status(501).json({ error: "Use Firestore directly" }));
router.get("/study/logs/:uid", (_req: Request, res: Response) => res.json([]));
router.get("/study/stats/:uid",(_req: Request, res: Response) => res.json({ streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null }));

export default router;
