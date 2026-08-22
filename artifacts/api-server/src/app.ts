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

// Vercel's TypeScript resolver can expose these CommonJS-compatible packages
// as module objects even though their runtime default exports are callable.
// Keep the runtime imports unchanged and give the middleware factories the
// callable shape Express expects.
const helmetMiddleware = helmet as unknown as (
  options?: Record<string, unknown>,
) => import("express").RequestHandler;
const pinoHttpMiddleware = pinoHttp as unknown as (
  options?: Record<string, unknown>,
) => import("express").RequestHandler;

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

app.use(helmetMiddleware({
  crossOriginResourcePolicy: { policy: "same-site" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      [
        "'self'", "'unsafe-inline'",
        "https://www.googletagmanager.com", "https://www.google-analytics.com",
        "https://tagmanager.google.com",
        "https://apis.google.com", "https://www.gstatic.com",
      ],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://tagmanager.google.com"],
      fontSrc:        ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc:         [
        "'self'", "data:", "blob:", "https:",
        "https://lh3.googleusercontent.com", "https://firebasestorage.googleapis.com",
        "https://www.googletagmanager.com",
      ],
      connectSrc:     [
        "'self'",
        "https://*.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com",
        "https://firestore.googleapis.com", "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.google-analytics.com", "https://analytics.google.com",
        "https://region1.google-analytics.com",
      ],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
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
app.use(pinoHttpMiddleware({
  logger: serverLogger,
  // Never log Authorization headers — they contain Firebase ID tokens
  redact: ["req.headers.authorization", "req.headers.cookie"],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
  skip: (req) => req.path === "/health",
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please wait a minute." },
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server / curl / Postman (no Origin header)
    if (!origin) return callback(null, true);
    // Allow all Replit dev and deployment domains
    if (origin.endsWith(".replit.dev") || origin.endsWith(".replit.app")) return callback(null, true);
    // Allow explicit override (e.g. custom production domain)
    const configured = process.env.CORS_ORIGIN;
    if (configured) {
      const allowed = configured.split(",").map(s => s.trim());
      if (allowed.includes(origin)) return callback(null, true);
    }
    // Allow localhost in non-production environments only
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));
// 5 MB to accommodate base64-encoded creator images stored inline in Firestore.
// File uploads use multer (memory buffer) which is separate from this limit.
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ── Health / keepalive ────────────────────────────────────────────────────────
// Lightweight endpoint polled every 10 min by the frontend to prevent
// Render's free-tier from spinning down when users are active on the site.
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

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
