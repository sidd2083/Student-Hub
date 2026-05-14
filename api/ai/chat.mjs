async function callGemini(systemContent, history, message) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_GEMINI_KEY");

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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400 && msg.toLowerCase().includes("api key")) throw new Error("NO_GEMINI_KEY");
    throw new Error(`Gemini ${res.status}: ${msg}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ?? "I couldn't generate a response. Please try again.";
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
- Cover the Nepal NEB/SEE curriculum: Math, Science, English, Nepali, Social Studies, Computer Science, Accounts, Economics, Biology, Physics, Chemistry

Guidelines:
- Keep responses concise, clear, and encouraging
- Use simple language appropriate for high school students
- For math/science: show clear step-by-step working
- Be motivating and positive — like a personal tutor who genuinely cares
- Format answers with bullet points, numbered steps, or sections where helpful
- Current year is 2026`;

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
  if (context.weeklyMins !== undefined) {
    parts.push(`Weekly study: ${context.weeklyMins} min`);
  }
  parts.push("--- END ---");
  return SYSTEM_PROMPT + parts.join("\n");
}

async function callOpenAI(apiKey, baseURL, messages) {
  const endpoint = baseURL
    ? `${baseURL.replace(/\/$/, "")}/chat/completions`
    : "https://api.openai.com/v1/chat/completions";

  // Try up to 2 times — wait 4 seconds before retry on rate limit
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (response.status === 429 && attempt === 0) {
      // Rate limited — wait and retry once
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody?.error?.message ?? `status ${response.status}`;
      if (response.status === 429) {
        throw Object.assign(new Error("rate_limit"), { statusCode: 429 });
      }
      if (response.status === 401 || response.status === 403) {
        throw Object.assign(new Error("invalid_key"), { statusCode: response.status });
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";
  }

  // Both attempts rate-limited
  throw Object.assign(new Error("rate_limit"), { statusCode: 429 });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Vercel may pass body as a string — ensure it's parsed
    let bodyData = req.body;
    if (typeof bodyData === "string") {
      try { bodyData = JSON.parse(bodyData); } catch { bodyData = {}; }
    }
    if (!bodyData || typeof bodyData !== "object") bodyData = {};
    const { message, history = [], context } = bodyData;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const hasGemini = !!process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const hasOpenAI = !!openaiKey;

    if (!hasGemini && !hasOpenAI) {
      return res.status(503).json({
        error: "Nep AI is not configured. Please add GEMINI_API_KEY in your Vercel project settings under Settings → Environment Variables, then redeploy."
      });
    }

    const systemContent = buildSystemContent(context);
    let reply;

    if (hasGemini) {
      try {
        reply = await callGemini(systemContent, history, message);
      } catch (geminiErr) {
        if (!hasOpenAI) throw geminiErr;
        const openaiMessages = [
          { role: "system", content: systemContent },
          ...history.filter(m => m && (m.role === "user" || m.role === "assistant") && m.content).map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ];
        reply = await callOpenAI(openaiKey, process.env.OPENAI_BASE_URL ?? null, openaiMessages);
      }
    } else {
      const openaiMessages = [
        { role: "system", content: systemContent },
        ...history.filter(m => m && (m.role === "user" || m.role === "assistant") && m.content).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ];
      reply = await callOpenAI(openaiKey, process.env.OPENAI_BASE_URL ?? null, openaiMessages);
    }

    return res.json({ reply });

  } catch (err) {
    console.error("[AI] Error:", err?.message);
    if (err?.statusCode === 429 || err?.message === "rate_limit") {
      return res.status(429).json({
        error: "I'm a little busy right now — too many requests! Please wait a few seconds and try again."
      });
    }
    if (err?.message === "invalid_key") {
      return res.status(503).json({
        error: "AI not configured — the OPENAI_API_KEY in Vercel is invalid or missing."
      });
    }
    return res.status(500).json({ error: "AI service error. Please try again." });
  }
}
