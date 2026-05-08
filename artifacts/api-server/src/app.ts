import express, { type Express } from "express";
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

// Use a plain pino instance with no transport — safe for serverless (no worker threads)
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

export default app;
