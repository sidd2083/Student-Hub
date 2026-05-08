import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function waitForDb(retries = 10, delayMs = 1500): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      const { pool } = await import("@workspace/db");
      const client = await (pool as import("pg").Pool).connect();
      await client.query("SELECT 1");
      client.release();
      logger.info("Database connection verified");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ attempt: i, retries, err: msg }, "DB not ready, retrying…");
      if (i === retries) {
        logger.error("Could not connect to database after all retries — starting anyway");
        return;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function start() {
  await waitForDb();

  if (process.env["SKIP_LISTEN"] === "true") {
    logger.info({ port }, "Server listen skipped");
    return;
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
