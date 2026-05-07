import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export default router;
