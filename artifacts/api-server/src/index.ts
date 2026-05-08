import app from "./app";
import { logger } from "./lib/logger";
import { validateEnv } from "./lib/env";

validateEnv();

const rawPort = process.env["PORT"];
const port = Number(rawPort);

async function start() {
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
