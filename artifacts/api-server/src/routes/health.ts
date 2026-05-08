import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

router.get("/status", async (_req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    FIREBASE_SERVICE_ACCOUNT_JSON:   !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    FIREBASE_PROJECT_ID:             !!(process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID),
    AI_INTEGRATIONS_OPENAI_API_KEY:  !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    OPENAI_API_KEY:                  !!process.env.OPENAI_API_KEY,
  };

  let firestoreConnected = false;
  let firestoreError: string | null = null;
  try {
    const { adminDb } = await import("../lib/firestore-admin");
    await adminDb.collection("_health").limit(1).get();
    firestoreConnected = true;
  } catch (err: unknown) {
    firestoreError = err instanceof Error ? err.message : String(err);
  }

  const aiReady = checks.AI_INTEGRATIONS_OPENAI_API_KEY || checks.OPENAI_API_KEY;
  const allOk = firestoreConnected && aiReady;

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    env: checks,
    firestore: { connected: firestoreConnected, error: firestoreError },
  });
});

export default router;
