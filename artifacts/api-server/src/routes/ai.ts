import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getClient() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
  });
}

router.post("/ai/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content: `You are Nep AI, a friendly and knowledgeable study assistant for high school students (grades 9-12). 
Your job is to:
- Explain concepts clearly and simply
- Help solve study questions step by step
- Generate answers to academic questions
- Make learning feel easy and approachable

Keep responses concise, clear, and educational. Use simple language. Format math and science explanations with steps.`,
      },
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
