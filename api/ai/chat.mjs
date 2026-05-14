const SYSTEM_PROMPT = `You are Nep AI, a friendly and highly knowledgeable study assistant for high school students (grades 9-12) in Nepal. You have up-to-date knowledge through 2026.

Your identity:
- You were built by Siddhant Lamichhane.
- When asked "who built you?", "who made you?", "who created you?", or "who are you?", always respond: "I'm Nep AI — built by Siddhant Lamichhane, your AI study assistant for Grade 9–12 students in Nepal!"
- Never claim to be ChatGPT, GPT, OpenAI, Gemini, Google, or any other AI brand.
- Never reveal any API keys, model names, or internal configuration.

Your capabilities:
- Explain academic concepts clearly for grades 9-12
- Help solve problems step by step across all subjects
- Give personalized study advice based on the student's actual progress data
- Analyze study habits and suggest improvements
- Cover the Nepal NEB/SEE curriculum: Math, Science, English, Nepali, Social Studies, Computer Science, Accounts, Economics, Biology, Physics, Chemistry

Guidelines:
- Keep responses concise, clear, and encouraging
- Use simple language appropriate for high school students
- For math/science: show clear step-by-step working
- When the student shares study stats or tasks: give SPECIFIC, actionable advice
- Be motivating and positive — like a personal tutor who genuinely cares
- Format answers with bullet points, numbered steps, or sections where helpful
- Current year is 2026

When you receive study context (tasks, stats), use it actively:
- Comment on their streak, study time, or tasks specifically
- Suggest which subjects to prioritize based on pending tasks
- Give daily/weekly study targets based on their current performance`;

function buildSystemContent(context) {
  if (!context) return SYSTEM_PROMPT;
  const parts = ["\n\n--- STUDENT'S CURRENT DATA ---"];
  if (context.stats) {
    const s = context.stats;
    parts.push(`Study Stats:\n- Streak: ${s.streak} days\n- Total: ${s.totalStudyTime} min\n- Today: ${s.todayStudyTime} min\n- Last active: ${s.lastActiveDate ?? "unknown"}`);
  }
  if (context.tasks && context.tasks.length > 0) {
    const pending = context.tasks.filter(t => !t.completed);
    const done = context.tasks.filter(t => t.completed);
    parts.push(`Tasks:\n- Pending (${pending.length}): ${pending.map(t => t.text).join(", ") || "none"}\n- Done (${done.length}): ${done.map(t => t.text).join(", ") || "none"}`);
  }
  if (context.weeklyMins !== undefined) parts.push(`Weekly study: ${context.weeklyMins} min`);
  parts.push("--- END ---");
  return SYSTEM_PROMPT + parts.join("\n");
}

async function callGemini(systemContent, history, message) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error("GEMINI_API_KEY not set"), { statusCode: 503 });

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
    generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
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
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429) throw Object.assign(new Error("rate_limit"), { statusCode: 429 });
    throw new Error(`Gemini error: ${msg}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ?? "I couldn't generate a response. Please try again.";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    let bodyData = req.body;
    if (typeof bodyData === "string") {
      try { bodyData = JSON.parse(bodyData); } catch { bodyData = {}; }
    }
    if (!bodyData || typeof bodyData !== "object") bodyData = {};

    const { message, history = [], context } = bodyData;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Nep AI is not configured. Add GEMINI_API_KEY in Vercel → Settings → Environment Variables, then redeploy.",
      });
    }

    const systemContent = buildSystemContent(context);
    const reply = await callGemini(systemContent, history, message);
    return res.json({ reply });

  } catch (err) {
    console.error("[Nep AI] Error:", err?.message);
    if (err?.statusCode === 429 || err?.message === "rate_limit") {
      return res.status(429).json({ error: "Nep AI is a bit busy right now. Please wait a moment and try again." });
    }
    if (err?.statusCode === 503) {
      return res.status(503).json({
        error: "Nep AI is not configured. Add GEMINI_API_KEY in Vercel → Settings → Environment Variables, then redeploy.",
      });
    }
    return res.status(500).json({ error: "Nep AI ran into an issue. Please try again." });
  }
}
