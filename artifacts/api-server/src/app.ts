import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import router from "./routes";
import sitemapRouter from "./routes/sitemap";

const app: Express = express();

app.set("trust proxy", 1);

// ── www → non-www canonical redirect ─────────────────────────────────────────
// Runs before everything else so crawlers never index the www version.
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host ?? "";
  if (host.startsWith("www.")) {
    const canonical = `https://${host.slice(4)}${req.originalUrl}`;
    return res.redirect(301, canonical);
  }
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
}));

const serverLogger = pino({ level: process.env.LOG_LEVEL ?? "info" });
app.use(pinoHttp({
  logger: serverLogger,
  // Never log Authorization headers — they contain Firebase ID tokens
  redact: ["req.headers.authorization", "req.headers.cookie"],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please wait a minute." },
});

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? true,
  credentials: true,
}));
// 1 MB is sufficient for all API payloads (AI chat history, task lists, etc.)
// File uploads use multer (memory buffer) which is separate from this limit.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Sitemap — served at top-level /sitemap.xml (not under /api) ───────────────
app.use(sitemapRouter);

app.use("/api/ai", aiLimiter);
app.use("/api", limiter, router);

app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  serverLogger.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
