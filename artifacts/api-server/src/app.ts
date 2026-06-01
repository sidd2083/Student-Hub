import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import router from "./routes";
import sitemapRouter from "./routes/sitemap";
import ssrRouter, { BUILD_EXISTS } from "./routes/ssr";

const app: Express = express();

app.set("trust proxy", 1);

// Gzip/deflate all responses — reduces payload 40-60%, speeds crawling + LCP
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  // Improve security headers for SEO and trust signals
  contentSecurityPolicy: false, // Managed by Vite/Vercel
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: true,
  xFrameOptions: { action: "deny" },
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
// 5 MB to accommodate base64-encoded creator images stored inline in Firestore.
// File uploads use multer (memory buffer) which is separate from this limit.
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api/ai", aiLimiter);
app.use("/api", limiter, router);

// Sitemap, robots.txt — served at root, no auth, no rate-limit
app.use(sitemapRouter);

// SSR meta-injection for /notes/* and /pyq/* + static frontend serving.
// When the frontend is built (production), this also catches all unmatched
// routes and serves index.html so the React SPA handles them.
app.use(ssrRouter);

// API 404 — only reached in dev mode (no frontend build) for unmatched paths.
// In production the ssrRouter catch-all above handles everything.
if (!BUILD_EXISTS) {
  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({ error: "Not found" });
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  serverLogger.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
