import type { Response } from "express";
import { logger } from "./logger";

const DB_ERROR_PATTERNS = [
  "DATABASE_URL",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "Connection terminated",
  "connection refused",
  "SSL connection",
  "password authentication failed",
  "relation does not exist",
  "column does not exist",
];

export function dbError(res: Response, err: unknown): Response {
  const msg = err instanceof Error ? err.message : String(err);
  logger.error(err);

  const isDbConfig = DB_ERROR_PATTERNS.some(p => msg.includes(p));
  if (isDbConfig) {
    return res.status(503).json({
      error: "Database unavailable. Make sure DATABASE_URL is set in your environment variables and the database is reachable.",
    });
  }

  return res.status(500).json({ error: "Internal server error" });
}
