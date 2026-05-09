import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const SYSTEM_PROMPT = `You are Nep AI, a friendly and highly knowledgeable study assistant for high school students (grades 9-12) in Nepal. You have up-to-date knowledge through 2026.

Your identity:
- You are a product of Tufan Production.
- When asked "who built you?", "who made you?", "who created you?", or "who are you?", always respond: "I'm Nep AI — a product of Tufan Production, your AI study assistant for Grade 9–12 students in Nepal!"
- Never claim to be ChatGPT, GPT, OpenAI, or any other AI brand.

Your capabilities:
- Explain academic concepts clearly for grades 9-12
- Help solve problems step by step across all subjects
- Give personalized study advice based on the student's actual progress data
- Analyze study habits and suggest improvements
- Cover the Nepal NEB/SEE curriculum and all subjects: Math, Science, English, Nepali, Social Studies, Computer Science, Accounts, Economics, Biology, Physics, Chemistry

Guidelines:
- Keep responses concise, clear, and encouraging
- Use simple language appropriate for high school students
- For math/science: show clear step-by-step working
- Be motivating and positive — like a personal tutor who genuinely cares
- Format answers with bullet points, numbered steps, or sections where helpful
- Current year is 2026`;

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
    parts.push(`Study Stats:\n- Streak: ${s.streak} days\n- Total: ${s.totalStudyTime} min\n- Today: ${s.todayStudyTime} min\n- Last active: ${s.lastActiveDate ?? "unknown"}`);
  }
  if (context.tasks?.length) {
    const pending = context.tasks.filter(t => !t.completed);
    const done    = context.tasks.filter(t => t.completed);
    parts.push(`Tasks:\n- Pending (${pending.length}): ${pending.map(t => t.text).join(", ") || "none"}\n- Done (${done.length}): ${done.map(t => t.text).join(", ") || "none"}`);
  }
  if (context.weeklyMins !== undefined) parts.push(`Weekly study: ${context.weeklyMins} min`);
  parts.push("--- END ---");
  return SYSTEM_PROMPT + parts.join("\n");
}

function getApiConfig(): { apiKey: string; endpoint: string } {
  // Replit dev: AI integration provides a local proxy
  const replitKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const replitBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (replitKey && replitBase && replitBase.startsWith("http://localhost")) {
    return {
      apiKey:   replitKey,
      endpoint: `${replitBase.replace(/\/$/, "")}/chat/completions`,
    };
  }
  // Standard OpenAI (Vercel / other deployments)
  const apiKey  = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_API_KEY ?? "";
  const baseURL = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return { apiKey, endpoint: `${baseURL}/chat/completions` };
}

router.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, history = [], context } = req.body as {
      message?: string;
      history?: ChatMessage[];
      context?: ChatContext;
    };

    if (!message) return res.status(400).json({ error: "message is required" });

    const { apiKey, endpoint } = getApiConfig();

    if (!apiKey) {
      return res.status(503).json({ error: "AI not configured — set OPENAI_API_KEY in environment variables." });
    }

    const messages = [
      { role: "system" as const, content: buildSystemContent(context) },
      ...history
        .filter(h => h.role === "user" || h.role === "assistant")
        .map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user" as const, content: message },
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 1200, temperature: 0.7 }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      logger.error({ status: response.status, body: errText }, "AI upstream error");
      return res.status(502).json({ error: `AI error ${response.status} — check your API key.` });
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
    return res.json({ reply });

  } catch (err) {
    logger.error(err, "AI handler error");
    return res.status(500).json({ error: "AI service error. Please try again." });
  }
});

export default router;
