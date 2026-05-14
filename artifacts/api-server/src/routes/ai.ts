import { Router } from "express";
import type { Request, Response } from "express";
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
- Use motivational comparisons: "Students who study 2 hours/day consistently outperform those who cram"

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

async function askGemini(systemContent: string, history: ChatMessage[], message: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set. Please add it in your environment variables.");

  const contents = [
    ...history
      .filter(h => h.role === "user" || h.role === "assistant")
      .map(h => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
    { role: "user", parts: [{ text: message }] },
  ];

  const body = {
    system_instruction: { parts: [{ text: systemContent }] },
    contents,
    generationConfig: {
      maxOutputTokens: 2500,
      temperature: 0.8,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
    const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini error: ${msg}`);
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ?? "I couldn't generate a response. Please try again.";
}

router.get("/ai/status", (_req: Request, res: Response) => {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  res.json({ ok: hasGemini, gemini: hasGemini, backend: hasGemini ? "gemini" : "none" });
});

router.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, history = [], context } = req.body as {
      message?: string;
      history?: ChatMessage[];
      context?: ChatContext;
    };

    if (!message) return res.status(400).json({ error: "message is required" });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Nep AI is not configured. Please set GEMINI_API_KEY in your Vercel environment variables and redeploy.",
      });
    }

    const systemContent = buildSystemContent(context);
    const reply = await askGemini(systemContent, history, message);
    return res.json({ reply });

  } catch (err) {
    const errStr = String(err);
    logger.error({ err }, "AI handler error");
    if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.toLowerCase().includes("rate")) {
      return res.status(429).json({ error: "Nep AI is a bit busy right now. Please wait a moment and try again." });
    }
    return res.status(500).json({ error: "Nep AI ran into an issue. Please try again." });
  }
});

export default router;
