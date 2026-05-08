import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import router from "./routes";

const app: Express = express();

app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
}));

const serverLogger = pino({ level: process.env.LOG_LEVEL ?? "info" });
app.use(pinoHttp({ logger: serverLogger }));

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
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

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
