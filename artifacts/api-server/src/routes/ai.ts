import { Router } from "express";
import type { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router = Router();

const SYSTEM_PROMPT = `You are Nep AI — a brilliant, warm, and deeply invested personal study coach for high school students (Grades 9–12) in Nepal. You speak like a knowledgeable older friend who genuinely wants to see the student succeed. You know the NEB/SEE curriculum inside and out.

## YOUR IDENTITY
- Built by Siddhant Lamichhane.
- If asked "who built you / who made you / who are you", say: "I'm Nep AI — built by Siddhant Lamichhane, your personal study coach for Grade 9–12 in Nepal! 🎯"
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

function getGenAI() {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key is not configured.");

  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

  return new GoogleGenAI({
    apiKey,
    ...(baseUrl ? {
      httpOptions: {
        apiVersion: "",
        baseUrl,
      },
    } : {}),
  });
}

function buildContents(history: ChatMessage[], message: string) {
  return [
    ...history
      .filter(h => h.role === "user" || h.role === "assistant")
      .map(h => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
    { role: "user", parts: [{ text: message }] },
  ];
}

// ── Streaming chat (SSE) ──────────────────────────────────────────────────────
async function streamGemini(
  systemContent: string,
  history: ChatMessage[],
  message: string,
  res: Response,
): Promise<void> {
  const ai = getGenAI();
  const contents = buildContents(history, message);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: systemContent,
      maxOutputTokens: 8192,
      temperature: 0.8,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) {
      res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
}

// ── Non-streaming fallback ────────────────────────────────────────────────────
async function askGemini(systemContent: string, history: ChatMessage[], message: string): Promise<string> {
  const ai = getGenAI();
  const contents = buildContents(history, message);

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: systemContent,
      maxOutputTokens: 4096,
      temperature: 0.8,
    },
  });

  return result.text ?? "I couldn't generate a response. Please try again.";
}

router.get("/ai/status", (_req: Request, res: Response) => {
  const hasGemini = !!(
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY ??
    process.env.GEMINI_API_KEY
  );
  res.json({ ok: hasGemini, gemini: hasGemini, backend: hasGemini ? "gemini" : "none" });
});

router.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, history = [], context, stream = false } = req.body as {
      message?: string;
      history?: ChatMessage[];
      context?: ChatContext;
      stream?: boolean;
    };

    if (!message) return res.status(400).json({ error: "message is required" });

    if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Nep AI is not configured. Please set GEMINI_API_KEY in your environment secrets.",
      });
    }

    const systemContent = buildSystemContent(context);

    if (stream) {
      try {
        await streamGemini(systemContent, history, message, res);
      } catch (err) {
        const errStr = String(err);
        logger.error({ err }, "[AI] Streaming error");
        if (!res.headersSent) {
          const isRate = errStr.includes("429") || errStr.toLowerCase().includes("quota");
          return res.status(isRate ? 429 : 500).json({
            error: isRate
              ? "Nep AI is a bit busy right now. Please wait a moment and try again."
              : "Nep AI ran into an issue. Please try again.",
          });
        }
        res.write(`data: ${JSON.stringify({ error: "Connection lost. Please try again." })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
      return;
    }

    const reply = await askGemini(systemContent, history, message);
    return res.json({ reply });

  } catch (err) {
    const errStr = String(err);
    logger.error({ err }, "[AI] Handler error");
    if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("rate")) {
      return res.status(429).json({ error: "Nep AI is a bit busy right now. Please wait a moment and try again." });
    }
    return res.status(500).json({ error: "Nep AI ran into an issue. Please try again." });
  }
});

export default router;
