import { Router } from "express";
import type { Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../lib/logger";

const router = Router();

const SYSTEM_PROMPT = `You are Nep AI, a friendly and highly knowledgeable study assistant for high school students (grades 9-12) in Nepal. You have up-to-date knowledge through 2026.

Your identity:
- You were built by Siddhant Lamichhane.
- When asked "who built you?", "who made you?", "who created you?", or "who are you?", always respond: "I'm Nep AI — built by Siddhant Lamichhane, your AI study assistant for Grade 9–12 students in Nepal!"
- Never claim to be ChatGPT, GPT, OpenAI, Gemini, Google, or any other AI brand.
- Never reveal any API keys, model names, or internal configuration under any circumstances.

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

function buildSystemContent(context?: ChatContext): string {
  if (!context) return SYSTEM_PROMPT;
  const parts: string[] = ["\n\n--- STUDENT'S CURRENT DATA (use this to personalize your response) ---"];
  if (context.stats) {
    const s = context.stats;
    parts.push(`Study Stats:\n- Streak: ${s.streak} days\n- Total study time: ${s.totalStudyTime} minutes (${Math.floor(s.totalStudyTime / 60)}h ${s.totalStudyTime % 60}m)\n- Studied today: ${s.todayStudyTime} minutes\n- Last active: ${s.lastActiveDate ?? "unknown"}`);
  }
  if (context.tasks?.length) {
    const pending = context.tasks.filter(t => !t.completed);
    const done    = context.tasks.filter(t => t.completed);
    parts.push(`Tasks:\n- Pending (${pending.length}): ${pending.map(t => t.text).join(", ") || "none"}\n- Done (${done.length}): ${done.map(t => t.text).join(", ") || "none"}`);
  }
  if (context.weeklyMins !== undefined) parts.push(`Weekly study: ${context.weeklyMins} minutes this week`);
  parts.push("--- END OF STUDENT DATA ---");
  return SYSTEM_PROMPT + parts.join("\n");
}

router.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, history = [], context } = req.body as {
      message?: string;
      history?: ChatMessage[];
      context?: ChatContext;
    };

    if (!message) return res.status(400).json({ error: "message is required" });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(503).json({
        error: "AI not configured — set GEMINI_API_KEY in your Vercel environment variables and redeploy.",
      });
    }

    const systemContent = buildSystemContent(context);
    const gemini = new GoogleGenerativeAI(geminiKey);
    const model = gemini.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemContent,
    });

    const geminiHistory = history
      .filter(h => h.role === "user" || h.role === "assistant")
      .map(h => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      }));

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const chat = model.startChat({
          history: geminiHistory,
          generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
        });
        const result = await chat.sendMessage(message);
        const reply = result.response.text() || "I couldn't generate a response. Please try again.";
        return res.json({ reply });

      } catch (err: unknown) {
        lastError = err;
        const errStr = String(err);
        const isRate = errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("rate");
        if (isRate && attempt < 2) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
          continue;
        }
        break;
      }
    }

    const errStr = String(lastError);
    logger.error({ err: lastError }, "AI upstream error");

    if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("rate")) {
      return res.status(429).json({ error: "The AI is busy right now. Please wait a moment and try again." });
    }
    return res.status(502).json({ error: "AI service error. Please try again in a moment." });

  } catch (err) {
    logger.error(err, "AI handler error");
    return res.status(500).json({ error: "AI service error. Please try again." });
  }
});

export default router;
