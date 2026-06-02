import { createServer } from "http";
import app from "./app";
import { initSocketServer } from "./lib/socket";
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

async function start() {
  if (process.env["SKIP_LISTEN"] === "true") {
    logger.info({ port }, "Server listen skipped");
    return;
  }

  // Create an explicit HTTP server so Socket.io can attach to it.
  // (app.listen() creates one internally, but we can't get a reference to it.)
  const httpServer = createServer(app);

  httpServer.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });

  // Attach Socket.io — must happen before httpServer.listen()
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
