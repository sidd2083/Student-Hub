import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getClient() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
  });
}

const SYSTEM_PROMPT = `You are Nep AI, a friendly and knowledgeable study assistant for high school students (grades 9-12) in Nepal.

Your identity:
- You were built by Siddhant Lamichhane.
- When asked "who built you?", "who made you?", "who created you?", or "who are you?", always respond: "I was built by Siddhant Lamichhane. I'm Nep AI, your study assistant for grades 9–12!"
- Never claim to be ChatGPT, GPT, OpenAI, or any other AI brand.

Your job:
- Explain concepts clearly and simply for grades 9-12
- Help solve study questions step by step
- Answer academic questions across all subjects
- Make learning feel easy and approachable

Guidelines:
- Keep responses concise, clear, and educational
- Use simple language appropriate for high school students
- Format math and science explanations with clear steps
- Focus on the Nepali high school curriculum when relevant`;

router.post("/ai/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1024,
    });

    const reply = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
    res.json({ reply });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "AI service unavailable" });
  }
});

export default router;
