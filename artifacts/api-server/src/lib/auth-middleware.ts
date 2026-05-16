import type { Request, Response, NextFunction } from "express";
import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { logger } from "./logger";

// Extend Express Request to carry the verified Firebase UID
declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

/**
 * requireAuth — verifies the Firebase ID token in the Authorization header.
 *
 * On success:  sets req.uid to the verified Firebase UID and calls next().
 * On failure:  responds 401 / 503 and does NOT call next().
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON to be set (Firebase Admin SDK).
 * Without it the endpoint is locked with 503 — never open.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Bearer token required." });
    return;
  }

  const token = authHeader.slice(7);

  if (getApps().length === 0) {
    logger.error("[Auth] Firebase Admin not initialized — FIREBASE_SERVICE_ACCOUNT_JSON not set.");
    res.status(503).json({
      error: "Server authentication unavailable. Set FIREBASE_SERVICE_ACCOUNT_JSON.",
    });
    return;
  }

  try {
    const decoded = await getAuth().verifyIdToken(token, true /* check revocation */);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    logger.warn({ err }, "[Auth] Token verification failed");
    res.status(401).json({ error: "Unauthorized: invalid or expired token." });
  }
}

// ── Per-user write rate limiter ──────────────────────────────────────────────
// Simple in-memory sliding window. Applied AFTER requireAuth so req.uid is set.

interface RateBucket { count: number; resetAt: number }
const writeBuckets = new Map<string, RateBucket>();

// Evict stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [uid, bucket] of writeBuckets) {
    if (bucket.resetAt < now) writeBuckets.delete(uid);
  }
}, 5 * 60_000);

/**
 * perUserWriteLimit(maxPerMinute) — rate-limits write endpoints per authenticated user.
 * Must be used after requireAuth (relies on req.uid).
 */
export function perUserWriteLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const uid = req.uid;
    if (!uid) { next(); return; }

    const now = Date.now();
    const bucket = writeBuckets.get(uid);

    if (!bucket || bucket.resetAt < now) {
      writeBuckets.set(uid, { count: 1, resetAt: now + 60_000 });
      next();
      return;
    }

    if (bucket.count >= maxPerMinute) {
      logger.warn({ uid, count: bucket.count }, "[RateLimit] Per-user write limit exceeded");
      res.status(429).json({ error: "Too many requests — please slow down." });
      return;
    }

    bucket.count++;
    next();
  };
}
