import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Diagnostic endpoint — returns which required env vars are present/missing.
// Useful for debugging serverless deployments (Vercel, etc.).
router.get("/status", async (_req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    AI_INTEGRATIONS_OPENAI_BASE_URL: !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    AI_INTEGRATIONS_OPENAI_API_KEY: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  };

  let dbConnected = false;
  let dbError: string | null = null;
  if (checks.DATABASE_URL) {
    try {
      const { pool } = await import("@workspace/db");
      const client = await (pool as import("pg").Pool).connect();
      await client.query("SELECT 1");
      client.release();
      dbConnected = true;
    } catch (err: unknown) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  const allOk = Object.values(checks).every(Boolean) && dbConnected;

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    env: checks,
    database: { connected: dbConnected, error: dbError },
  });
});

export default router;
