export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const hasKey = !!(process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
  res.json({
    ok: true,
    ai: hasKey,
    env: process.env.NODE_ENV ?? "unknown",
    time: new Date().toISOString(),
    hint: hasKey ? "AI key is set ✓" : "OPENAI_API_KEY is NOT set — AI will not work",
  });
}
