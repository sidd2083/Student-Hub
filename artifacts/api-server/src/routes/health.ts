import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import { stats } from "../lib/stats";

const router: IRouter = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ── Live server stats — no auth needed (aggregate counts, no PII) ─────────────
// Mounted under /api in routes/index.ts, so this resolves to GET /api/stats.
router.get("/stats", (_req: Request, res: Response) => {
  res.json(stats.get());
});

router.get("/status", (_req: Request, res: Response) => {
  const aiReady = !!(
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY
  );
  res.json({
    status: aiReady ? "ok" : "degraded",
    ai: aiReady,
  });
});

export default router;
