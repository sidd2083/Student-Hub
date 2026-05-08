import { Router } from "express";
import type { Request, Response } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router = Router();

function getClient(): OpenAI {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.VITE_OPENAI_API_KEY ??
    "placeholder";
  const baseURL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    process.env.VITE_OPENAI_BASE_URL ??
    undefined;
  return new OpenAI({ baseURL, apiKey });
}

const SYSTEM_PROMPT = `You are Nep AI, a friendly and highly knowledgeable study assistant for high school students (grades 9-12) in Nepal. You have up-to-date knowledge through 2026.

Your identity:
- You were built by Siddhant Lamichhane.
- When asked "who built you?", "who made you?", "who created you?", or "who are you?", always respond: "I was built by Siddhant Lamichhane. I'm Nep AI, your AI study assistant for Grade 9–12 students in Nepal!"
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
- When the student shares their study stats or tasks: analyze them and give SPECIFIC, actionable advice
- Be motivating and positive — like a personal tutor who genuinely cares
- Format answers with bullet points, numbered steps, or sections where helpful
- Current year is 2026

When you receive study context (tasks, stats), use it actively:
- Comment on their streak, study time, or tasks specifically
- Suggest which subjects to prioritize based on pending tasks
- Give daily/weekly study targets based on their current performance`;

interface ChatMessage { role: string; content: string }
interface ChatContext {
  stats?: { streak: number; totalStudyTime: number; todayStudyTime: number; lastActiveDate?: string };
  tasks?: { completed: boolean; text: string }[];
  weeklyMins?: number;
}

router.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, history = [], context } = req.body as {
      message?: string;
      history?: ChatMessage[];
      context?: ChatContext;
    };
    if (!message) return res.status(400).json({ error: "message is required" });

    let systemContent = SYSTEM_PROMPT;

    if (context) {
      const parts: string[] = ["\n\n--- STUDENT'S CURRENT DATA (use this to personalize your response) ---"];
      if (context.stats) {
        const s = context.stats;
        parts.push(`Study Stats:
- Streak: ${s.streak} days
- Total study time: ${s.totalStudyTime} minutes (${Math.floor(s.totalStudyTime / 60)}h ${s.totalStudyTime % 60}m)
- Studied today: ${s.todayStudyTime} minutes
- Last active: ${s.lastActiveDate ?? "unknown"}`);
      }
      if (context.tasks && context.tasks.length > 0) {
        const pending = context.tasks.filter(t => !t.completed);
        const done    = context.tasks.filter(t => t.completed);
        parts.push(`Tasks:
- Pending (${pending.length}): ${pending.map(t => t.text).join(", ") || "none"}
- Completed (${done.length}): ${done.map(t => t.text).join(", ") || "none"}`);
      }
      if (context.weeklyMins !== undefined) {
        parts.push(`Weekly study: ${context.weeklyMins} minutes this week`);
      }
      parts.push("--- END OF STUDENT DATA ---");
      systemContent = SYSTEM_PROMPT + parts.join("\n");
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemContent },
      ...history.map(h => ({
        role:    h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    const completion = await getClient().chat.completions.create({
      model:      "gpt-4o-mini",
      messages,
      max_tokens: 1200,
    });

    const reply = completion.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
    return res.json({ reply });
  } catch (err) {
    logger.error(err);
    return res.status(500).json({ error: "AI service unavailable" });
  }
});

export default router;
