import type { Response } from "express";
import { logger } from "./logger";

export function serverError(res: Response, err: unknown): Response {
  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
