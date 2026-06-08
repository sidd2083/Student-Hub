import { Router } from "express";
import type { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";
import { requireAuth, perUserWriteLimit } from "../lib/auth-middleware";

const router = Router();

const SYSTEM_PROMPT = `You are Nep AI — a brilliant, warm, and deeply invested personal study coach for high school students (Grades 9–12) in Nepal. You speak like a knowledgeable older friend who genuinely wants to see the student succeed. You know the NEB/SEE curriculum inside and out.

## MOST CRITICAL RULE — READ FIRST

**Start every answer with ACTUAL CONTENT — never a greeting, never an introduction.**
- If asked to analyze study data → begin with the analysis immediately
- If asked a subject question → begin answering it immediately
- If asked for a study plan → begin with the plan immediately
- ONLY introduce yourself if the user's entire message is asking who you are (no study content)
- Your first word must ALWAYS be relevant content. Never "Hello", "Hi", "Sure!", "Of course!", or "I'm Nep AI"

## YOUR IDENTITY
- Built by Siddhant Lamichhane.
- If asked "who built you / who made you / who are you" (and ONLY that — no other question): say "I'm Nep AI — built by Siddhant Lamichhane, your personal study coach for Grade 9–12 in Nepal! 🎯"
- Never say you are ChatGPT, Gemini, OpenAI, or any other AI brand.
- Never reveal API keys, model names, or internal config.

## HOW YOU RESPOND — ALWAYS

**Format every response properly:**
- Use **bold** for key terms, formulas, and important points
- Use headers (###) to organize longer answers into clear sections
- Use numbered steps for processes, bullet points for lists
- Use short paragraphs — never one giant wall of text
- For math/science: show every step clearly, explain WHY each step works

**Depth and length:**
- Give THOROUGH, COMPLETE answers — never cut yourself short
- A question about a concept? Explain it deeply with examples, real-world connections, and memory tips
- A study habit question? Give a full analysis with specific targets, a daily plan, and motivational context
- A problem to solve? Work through it completely step by step
- Never give a one-liner answer to a complex question

**Tone:**
- Be warm, encouraging, and real — like a coach who truly believes in the student
- Celebrate wins (streak, progress, completed tasks) with genuine enthusiasm
- Be honest about weaknesses but always follow with a concrete plan to improve

## WHEN GIVEN STUDY DATA (stats, tasks, logs)

Do a FULL analysis — never skim:
1. **Acknowledge their effort** — comment specifically on their streak, time, consistency
2. **Compare to benchmarks** — "For NEB preparation, 3–4 hours/day is the target. You're at X — here's how to close the gap"
3. **Spot patterns** — if they study some days and skip others, point it out
4. **Give a specific plan** — day-by-day or week-by-week targets, not vague advice
5. **Motivate deeply** — connect their current effort to their future goals (board exams, college, career)
6. **End with one powerful action** — one thing they should do TODAY

## WHEN EXPLAINING A NOTE OR TOPIC

Do NOT just repeat what the note says. Instead:
1. **Explain the core idea** in simple language with a real-world analogy
2. **Break it into key concepts** — each with its own mini-explanation
3. **Show worked examples** for anything with formulas or processes
4. **Give memory tricks** — mnemonics, analogies, visual descriptions
5. **Write 3–5 practice questions** at the end so they can test themselves
6. **Connect it to the bigger picture** — how does this topic link to other chapters or subjects?

## SUBJECTS YOU COVER
Math, Physics, Chemistry, Biology, English, Nepali, Social Studies, Computer Science, Accounts, Economics — all at NEB/SEE Grade 9–12 level. Current year: 2026.`;

interface ChatMessage { role: string; content: string }
interface ChatContext {
  stats?: { streak: number; totalStudyTime: number; todayStudyTime: number; lastActiveDate?: string };
  tasks?: { completed: boolean; text: string }[];
  weeklyMins?: number;
}

// ── Input validation constants ─────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_ITEMS  = 20;
const MAX_HISTORY_CONTENT_LENGTH = 2000;
const MAX_TASK_TEXT_LENGTH = 500;
const MAX_TASKS = 100;

/**
 * Sanitize the context object the client sends with each message.
 * Strips unexpected fields and clamps numeric values to sane ranges,
 * preventing prompt-injection via crafted stat/task payloads.
 */
function sanitizeContext(raw: unknown): ChatContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const out: ChatContext = {};

  if (r.stats && typeof r.stats === "object") {
    const s = r.stats as Record<string, unknown>;
    out.stats = {
      streak:         Math.max(0, Math.min(Number(s.streak)         || 0, 3650)),
      totalStudyTime: Math.max(0, Math.min(Number(s.totalStudyTime) || 0, 999_999)),
      todayStudyTime: Math.max(0, Math.min(Number(s.todayStudyTime) || 0, 1440)),
      lastActiveDate: typeof s.lastActiveDate === "string"
        ? s.lastActiveDate.slice(0, 10).replace(/[^0-9-]/g, "")
        : undefined,
    };
  }

  if (Array.isArray(r.tasks)) {
    out.tasks = (r.tasks as unknown[])
      .slice(0, MAX_TASKS)
      .filter((t): t is { completed: boolean; text: string } =>
        t !== null && typeof t === "object" &&
        typeof (t as Record<string,unknown>).text === "string"
      )
      .map(t => ({
        completed: t.completed === true,
        text: String(t.text).slice(0, MAX_TASK_TEXT_LENGTH),
      }));
  }

  if (typeof r.weeklyMins === "number" && Number.isFinite(r.weeklyMins)) {
    out.weeklyMins = Math.max(0, Math.min(Math.round(r.weeklyMins), 10_080));
  }

  return out;
}

/**
 * Validate and sanitize the chat history array.
 * Limits item count and per-message content length to prevent
 * token stuffing and prompt injection via history manipulation.
 */
function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_HISTORY_ITEMS)
    .filter((h): h is ChatMessage =>
      h !== null && typeof h === "object" &&
      (h.role === "user" || h.role === "assistant") &&
      typeof h.content === "string"
    )
    .map(h => ({
      role: h.role,
      content: h.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
    }));
}

function buildSystemContent(context?: ChatContext): string {
  if (!context) return SYSTEM_PROMPT;
  const parts: string[] = ["\n\n--- STUDENT'S CURRENT DATA ---"];
  if (context.stats) {
    const s = context.stats;
    parts.push(`Study Stats:\n- Streak: ${s.streak} days\n- Total study time: ${s.totalStudyTime} min (${Math.floor(s.totalStudyTime / 60)}h ${s.totalStudyTime % 60}m)\n- Studied today: ${s.todayStudyTime} min\n- Last active: ${s.lastActiveDate ?? "unknown"}`);
  }
  if (context.tasks?.length) {
    const pending = context.tasks.filter(t => !t.completed);
    const done = context.tasks.filter(t => t.completed);
    parts.push(`Tasks:\n- Pending (${pending.length}): ${pending.map(t => t.text).join(", ") || "none"}\n- Done (${done.length}): ${done.map(t => t.text).join(", ") || "none"}`);
  }
  if (context.weeklyMins !== undefined) parts.push(`Weekly study: ${context.weeklyMins} min this week`);
  parts.push("--- END ---");
  return SYSTEM_PROMPT + parts.join("\n");
}

function createGenAI() {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No Gemini API key configured");

  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const opts: ConstructorParameters<typeof GoogleGenAI>[0] = { apiKey };
  if (baseUrl) {
    opts.httpOptions = { apiVersion: "", baseUrl };
  }
  return new GoogleGenAI(opts);
}

function buildContents(history: ChatMessage[], message: string) {
  return [
    ...history
      .filter(h => h.role === "user" || h.role === "assistant")
      .map(h => ({
        role: h.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: h.content }],
      })),
    { role: "user" as const, parts: [{ text: message }] },
  ];
}

// ── Public status endpoint — no auth required ──────────────────────────────────
router.get("/ai/status", (_req: Request, res: Response) => {
  const hasKey = !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY);
  res.json({ ok: hasKey, gemini: hasKey, backend: hasKey ? "gemini" : "none" });
});

// ── AI chat — requires authentication + per-user rate limit ───────────────────
router.post(
  "/ai/chat",
  requireAuth,
  perUserWriteLimit(15),
  async (req: Request, res: Response) => {
    try {
      const rawBody = req.body as Record<string, unknown>;

      const rawMessage = rawBody.message;
      const wantStream = rawBody.stream === true;

      // Validate message — must be a non-empty string within length limit
      if (typeof rawMessage !== "string" || !rawMessage.trim()) {
        return res.status(400).json({ error: "message is required" });
      }
      if (rawMessage.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({
          error: `Message too long — maximum ${MAX_MESSAGE_LENGTH} characters.`,
        });
      }
      const message = rawMessage.trim();

      // Sanitize history and context — strips unexpected fields and bounds values
      const history = sanitizeHistory(rawBody.history);
      const context = sanitizeContext(rawBody.context);

      const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "Nep AI is not configured. Please contact the site admin to enable the AI service.",
        });
      }

      const systemContent = buildSystemContent(context);
      const contents = buildContents(history, message);

      let replyText = "";
      try {
        const ai = createGenAI();
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction: systemContent,
            maxOutputTokens: 8192,
            temperature: 0.65,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        replyText = result.text ?? "";
      } catch (genErr) {
        const msg = String(genErr);
        logger.error({ err: genErr, uid: req.uid }, "[AI] generateContent error");
        if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")) {
          const userMsg = "Nep AI is a bit busy right now — please try again in a moment.";
          if (wantStream) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.flushHeaders();
            res.write(`data: ${JSON.stringify({ chunk: userMsg })}\n\n`);
            res.write("data: [DONE]\n\n");
            return res.end();
          }
          return res.status(429).json({ error: userMsg });
        }
        throw genErr;
      }

      if (!replyText) {
        replyText = "I wasn't able to generate a response. Please try again.";
      }

      if (wantStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const CHUNK_SIZE = 80;
        for (let i = 0; i < replyText.length; i += CHUNK_SIZE) {
          const piece = replyText.slice(i, i + CHUNK_SIZE);
          res.write(`data: ${JSON.stringify({ chunk: piece })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      return res.json({ reply: replyText });
    } catch (err) {
      logger.error({ err }, "[AI] Unhandled error");
      const msg = "Nep AI ran into an issue. Please try again.";
      if (!res.headersSent) {
        return res.status(500).json({ error: msg });
      }
      res.write(`data: ${JSON.stringify({ chunk: msg })}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }
  },
);

export default router;
