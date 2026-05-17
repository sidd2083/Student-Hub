import { useState, useRef, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { SoftGate } from "@/components/SoftGate";
import { useAuth } from "@/context/AuthContext";
import { Send, MessageCircle, Sparkles, BookOpen, BarChart2, ListChecks } from "lucide-react";
import { useSearch, useLocation } from "wouter";
import { consumeAiContext } from "@/lib/aiContext";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Message { role: "user" | "assistant"; content: string }

function markdownToHtml(text: string): string {
  const renderInline = (s: string) =>
    s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
     .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
     .replace(/\*(.+?)\*/g, "<em>$1</em>")
     .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:0.85em;font-family:monospace;color:#1e40af">$1</code>');

  const lines = text.split("\n");
  const out: string[] = [];
  let inUl = false, inOl = false;

  const closeList = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { closeList(); out.push('<div style="height:6px"></div>'); continue; }

    // Headers — match any number of leading # chars followed by space or word char
    const heading = t.match(/^(#{1,6})\s*(.*)/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const content = renderInline(heading[2]);
      if (level === 1) {
        out.push(`<p style="font-size:1.1em;font-weight:800;margin:10px 0 4px;color:#111">${content}</p>`);
      } else if (level === 2) {
        out.push(`<p style="font-size:1em;font-weight:700;margin:9px 0 3px;color:#1e3a8a;border-bottom:1px solid #e5e7eb;padding-bottom:2px">${content}</p>`);
      } else {
        out.push(`<p style="font-weight:700;margin:7px 0 2px;color:#374151">${content}</p>`);
      }
      continue;
    }

    // Horizontal rule
    if (t.match(/^[-*_]{3,}$/)) { closeList(); out.push('<hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0"/>'); continue; }

    // Unordered list
    const bullet = t.match(/^[-*+] (.+)/);
    if (bullet) {
      if (!inUl) { closeList(); out.push('<ul style="margin:4px 0 4px 2px;padding-left:18px;list-style:disc">'); inUl = true; }
      out.push(`<li style="margin:3px 0;line-height:1.5">${renderInline(bullet[1])}</li>`);
      continue;
    }

    // Ordered list
    const num = t.match(/^(\d+)[.)]\s(.+)/);
    if (num) {
      if (!inOl) { closeList(); out.push('<ol style="margin:4px 0 4px 2px;padding-left:20px;list-style:decimal">'); inOl = true; }
      out.push(`<li style="margin:3px 0;line-height:1.5">${renderInline(num[2])}</li>`);
      continue;
    }

    // Blockquote
    if (t.startsWith("> ")) {
      closeList();
      out.push(`<div style="border-left:3px solid #6366f1;padding:3px 10px;margin:4px 0;color:#4b5563;font-style:italic">${renderInline(t.slice(2))}</div>`);
      continue;
    }

    closeList();
    out.push(`<p style="margin:3px 0;line-height:1.6">${renderInline(t)}</p>`);
  }
  closeList();
  return out.join("");
}

interface StudyContext {
  stats?: {
    streak: number;
    totalStudyTime: number;
    todayStudyTime: number;
    lastActiveDate: string | null;
  };
  tasks?: Array<{ text: string; completed: boolean }>;
  weeklyMins?: number;
}

const SYSTEM_PROMPT = `You are Nep AI — a brilliant, warm, and deeply invested personal study coach for high school students (Grades 9–12) in Nepal. You speak like a knowledgeable older friend who genuinely wants to see the student succeed.

## YOUR IDENTITY
- Built by Siddhant Lamichhane.
- If asked "who built you / who made you / who are you", say: "I'm Nep AI — built by Siddhant Lamichhane, your personal study coach for Grade 9–12 in Nepal!"
- Never say you are ChatGPT, Gemini, OpenAI, or any other AI brand.

## HOW YOU RESPOND — ALWAYS

**Format every response properly:**
- Use **bold** for key terms, formulas, and important points
- Use headers (###) to organize longer answers into clear sections
- Use numbered steps for processes, bullet points for lists
- Short paragraphs — never one giant wall of text
- For math/science: show every step clearly, explain WHY each step works

**Depth:**
- Give THOROUGH, COMPLETE answers — never cut yourself short
- Concept question? Explain deeply with examples, analogies, and memory tips
- Study habit question? Full analysis with specific targets and daily plan
- Problem to solve? Work through it completely step by step
- Never give a one-liner answer to a complex question

**Tone:** Warm, encouraging, and real — like a coach who truly believes in the student.

## WHEN GIVEN STUDY DATA
Do a FULL analysis: acknowledge effort, compare to NEB benchmarks (3–4 hrs/day ideal), spot patterns, give a specific weekly plan, and end with one powerful action to do TODAY.

## WHEN EXPLAINING A NOTE OR TOPIC
Do NOT just repeat the note. Teach it: explain with analogies, break into key concepts, show worked examples, give memory tricks, write 4–5 practice questions, connect to the bigger syllabus picture.

## SUBJECTS
Math, Physics, Chemistry, Biology, English, Nepali, Social Studies, Computer Science, Accounts, Economics — NEB/SEE Grade 9–12. Current year: 2026.`;

function buildSystemContent(ctx: StudyContext | null): string {
  if (!ctx) return SYSTEM_PROMPT;
  const parts: string[] = ["\n\n--- STUDENT'S CURRENT DATA (use this to personalize your response) ---"];
  if (ctx.stats) {
    const s = ctx.stats;
    parts.push(`Study Stats:\n- Streak: ${s.streak} days\n- Total study time: ${s.totalStudyTime} minutes (${Math.floor(s.totalStudyTime / 60)}h ${s.totalStudyTime % 60}m)\n- Studied today: ${s.todayStudyTime} minutes\n- Last active: ${s.lastActiveDate ?? "unknown"}`);
  }
  if (ctx.tasks && ctx.tasks.length > 0) {
    const pending = ctx.tasks.filter(t => !t.completed);
    const done = ctx.tasks.filter(t => t.completed);
    parts.push(`Tasks:\n- Pending (${pending.length}): ${pending.map(t => t.text).join(", ") || "none"}\n- Completed (${done.length}): ${done.map(t => t.text).join(", ") || "none"}`);
  }
  if (ctx.weeklyMins !== undefined) {
    parts.push(`Weekly study: ${ctx.weeklyMins} minutes this week`);
  }
  parts.push("--- END OF STUDENT DATA ---");
  return SYSTEM_PROMPT + parts.join("\n");
}

/**
 * Stream the AI response via SSE.
 * Calls onChunk for every text piece received so the UI updates in real time.
 * Returns the full assembled text when the stream ends.
 */
function parseSseLines(text: string, onChunk: (t: string) => void): string {
  let full = "";
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const raw = line.slice(6).trim();
    if (!raw || raw === "[DONE]") continue;
    try {
      const json = JSON.parse(raw) as { chunk?: string; error?: string };
      if (json.error) throw new Error(json.error);
      if (json.chunk) { full += json.chunk; onChunk(json.chunk); }
    } catch (e) {
      if (e instanceof Error && !e.message.includes("JSON")) throw e;
    }
  }
  return full;
}

async function streamAI(
  message: string,
  history: Message[],
  ctx: StudyContext | null,
  onChunk: (text: string) => void,
): Promise<string> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, context: ctx, stream: true }),
  });

  // Non-2xx — parse as JSON error
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `AI service ${res.status}`);
  }

  // If server returned plain JSON (fallback / proxy stripped SSE headers)
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json() as { reply?: string; error?: string };
    if (data.error) throw new Error(data.error);
    const text = data.reply ?? "";
    if (text) onChunk(text);
    return text || "I couldn't generate a response. Please try again.";
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream available.");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    full += parseSseLines(lines.join("\n"), onChunk);
  }

  // Flush any leftover in buffer (incomplete last line)
  if (buffer.trim()) full += parseSseLines(buffer, onChunk);

  return full || "I couldn't generate a response. Please try again.";
}

const STUDY_FALLBACKS: [RegExp, string][] = [
  [/who (built|made|created|developed) you|who are you|tell me about yourself/i,
    "I'm Nep AI — built by Siddhant Lamichhane, here to help Grade 9–12 students in Nepal. I can explain concepts, solve problems, analyze your study habits, and help you improve. What would you like to learn?"],
  [/newton/i,
    "Newton's Three Laws of Motion:\n1. An object at rest stays at rest unless acted upon by a force.\n2. F = ma (Force = mass × acceleration).\n3. Every action has an equal and opposite reaction."],
  [/photosynthesis/i,
    "Photosynthesis converts sunlight into food:\n6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂\nIt occurs in chloroplasts using the green pigment chlorophyll."],
  [/pythagoras|hypotenuse/i,
    "Pythagorean Theorem: a² + b² = c²\nwhere c is the hypotenuse.\nExample: a=3, b=4 → c = √(9+16) = 5."],
  [/quadratic|x²|x\^2/i,
    "Quadratic formula: x = (-b ± √(b²-4ac)) / 2a\nFor x² - 5x + 6 = 0: x = 3 or x = 2."],
];

function getLocalFallback(msg: string): string {
  for (const [pattern, response] of STUDY_FALLBACKS) {
    if (pattern.test(msg)) return response;
  }
  return "I'm having trouble connecting. Try asking about Newton's laws, photosynthesis, or quadratic equations!";
}

async function loadStudyContext(uid: string): Promise<StudyContext> {
  const [userSnap, tasksSnap, logsSnap] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDocs(query(collection(db, "tasks"), where("uid", "==", uid))),
    getDocs(query(collection(db, "study_logs"), where("uid", "==", uid))),
  ]);

  let stats: StudyContext["stats"] | undefined;
  if (userSnap.exists()) {
    const d = userSnap.data();
    stats = {
      streak: d.streak ?? 0,
      totalStudyTime: d.totalStudyTime ?? 0,
      todayStudyTime: d.todayStudyTime ?? 0,
      lastActiveDate: d.lastActiveDate ?? null,
    };
  }

  const tasks = tasksSnap.docs.map(d => ({
    text: d.data().text,
    completed: d.data().completed,
  }));

  const logs = logsSnap.docs.map(d => ({
    date: d.data().date,
    studyMinutes: d.data().studyMinutes ?? 0,
  }));

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyMins = logs
    .filter(l => new Date(l.date) >= weekAgo)
    .reduce((s, l) => s + l.studyMinutes, 0);

  return { stats, tasks, weeklyMins };
}

function NepAiContent() {
  const { user } = useAuth();
  const search = useSearch();
  const [location] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<StudyContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [showCtxBanner, setShowCtxBanner] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSentRef = useRef(false);
  const prevInitialQRef = useRef<string>("");
  const lastCtxIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); cooldownRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!user) return;

    // 1. Check sessionStorage for context set by Notes / ReportCard
    const pending = consumeAiContext();
    if (pending && pending.id !== lastCtxIdRef.current) {
      lastCtxIdRef.current = pending.id;
      const msg = pending.context;
      setMessages([{ role: "user", content: msg }, { role: "assistant", content: "" }]);
      setLoading(true);
      setLoadingCtx(true);
      (async () => {
        let ctx: StudyContext | null = null;
        try { ctx = await loadStudyContext(user.uid); setContext(ctx); } catch { }
        finally { setLoadingCtx(false); }
        try {
          const finalText = await streamAI(msg, [], ctx, (chunk) => {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") updated[updated.length - 1] = { role: "assistant", content: last.content + chunk };
              return updated;
            });
          });
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant" && !last.content && finalText) {
              updated[updated.length - 1] = { role: "assistant", content: finalText };
            }
            return updated;
          });
        } catch {
          setMessages(prev => {
            const updated = [...prev];
            if (updated[updated.length - 1]?.role === "assistant") updated[updated.length - 1] = { role: "assistant", content: getLocalFallback(msg) };
            return updated;
          });
        } finally { setLoading(false); }
      })();
      return;
    }

    // 2. Fall back to URL query string (direct links / bookmarks)
    const urlQ = new URLSearchParams(search).get("q") || "";
    if (!urlQ || urlQ === prevInitialQRef.current) return;
    prevInitialQRef.current = urlQ;
    autoSentRef.current = true;
    const msg = urlQ;
    setMessages([{ role: "user", content: msg }, { role: "assistant", content: "" }]);
    setLoading(true);
    (async () => {
      let ctx: StudyContext | null = null;
      try { ctx = await loadStudyContext(user.uid); setContext(ctx); } catch { }
      try {
        const finalText = await streamAI(msg, [], ctx, (chunk) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") updated[updated.length - 1] = { role: "assistant", content: last.content + chunk };
            return updated;
          });
        });
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant" && !last.content && finalText) {
            updated[updated.length - 1] = { role: "assistant", content: finalText };
          }
          return updated;
        });
      } catch {
        setMessages(prev => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.role === "assistant") updated[updated.length - 1] = { role: "assistant", content: getLocalFallback(msg) };
          return updated;
        });
      } finally { setLoading(false); }
    })();
  }, [location, search, user]);

  const loadContextManual = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingCtx(true);
    try {
      const ctx = await loadStudyContext(user.uid);
      setContext(ctx);
      setShowCtxBanner(true);
    } catch (err) {
      console.error("[NepAI] Context load failed:", err);
    } finally {
      setLoadingCtx(false);
    }
  }, [user]);

  const sendMessage = async (e: React.FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = (overrideMsg ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setShowCtxBanner(false);
    // Optimistically add user message + empty assistant placeholder
    const historySnapshot = messages;
    setMessages(prev => [
      ...prev,
      { role: "user" as const, content: msg },
      { role: "assistant" as const, content: "" },
    ]);
    setLoading(true);
    try {
      const finalText = await streamAI(msg, historySnapshot, context, (chunk) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { role: "assistant", content: last.content + chunk };
          }
          return updated;
        });
      });
      // If chunks never arrived via onChunk, use the return value directly
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content && finalText) {
          updated[updated.length - 1] = { role: "assistant", content: finalText };
        }
        return updated;
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[NepAI] stream failed:", errMsg);
      const isRateLimit = errMsg.includes("busy") || errMsg.includes("too many") || errMsg.includes("rate") || errMsg.includes("429");
      const isConfig    = errMsg.includes("not configured") || errMsg.includes("GEMINI_API_KEY") || errMsg.includes("API key") || errMsg.includes("503");
      const isUserFriendly = errMsg.length >= 10 && errMsg.length <= 300 && !errMsg.match(/^(AI service|status |fetch)/i);
      if (isRateLimit) startCooldown(20);
      const errorContent = isRateLimit
        ? "Nep AI is a little busy — please wait 20 seconds and try again!"
        : isConfig
        ? "⚠️ Nep AI isn't connected.\n\nTo fix this on Vercel:\n1. Go to your Vercel project → Settings → Environment Variables\n2. Add **GEMINI_API_KEY** with your Google AI key\n3. Make sure it's enabled for **Production** environment\n4. Click **Redeploy** (not just save — you must redeploy!)\n\nGet a free key at: https://aistudio.google.com/apikey"
        : isUserFriendly
        ? errMsg
        : "Sorry, I ran into a temporary issue. Please try again in a moment!";
      setMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === "assistant") {
          updated[updated.length - 1] = { role: "assistant", content: errorContent };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const quickAsk = (q: string) => {
    setInput(q);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      sendMessage(fakeEvent, q);
    }, 10);
  };

  const ctxStats = context?.stats;
  const pendingTasks = context?.tasks?.filter(t => !t.completed) ?? [];

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Nep AI</h1>
              <p className="text-xs text-gray-500">Your study assistant · 2026</p>
            </div>
          </div>
          <button
            onClick={loadContextManual}
            disabled={loadingCtx || !user}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              context
                ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                : "bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
            } disabled:opacity-50`}
          >
            {loadingCtx ? (
              <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <BarChart2 className="w-3.5 h-3.5" />
            )}
            {context ? "Context loaded" : "Load my data"}
          </button>
        </div>

        {showCtxBanner && context && (
          <div className="mt-3 flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-xs text-indigo-700">
            <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold mb-0.5">Nep AI can now see your study data!</p>
              <p className="text-indigo-500 leading-relaxed">
                {ctxStats && `Streak: ${ctxStats.streak}d · Today: ${ctxStats.todayStudyTime}min`}
                {pendingTasks.length > 0 && ` · ${pendingTasks.length} pending tasks`}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">Ask me anything</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">
              I explain concepts, solve problems, and give personalized study advice based on your progress
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Quick questions</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Explain Newton's laws",
                  "Solve x² - 5x + 6 = 0",
                  "What is photosynthesis?",
                  "Help me study better",
                ].map((q) => (
                  <button key={q} onClick={() => quickAsk(q)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                    {q}
                  </button>
                ))}
              </div>

              {context && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Based on your data</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {ctxStats && (
                      <button onClick={() => quickAsk(`I've studied ${ctxStats.todayStudyTime} minutes today with a ${ctxStats.streak}-day streak. What should I do next?`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm rounded-full hover:bg-indigo-100 transition-all">
                        <BarChart2 className="w-3 h-3" /> Analyze my study progress
                      </button>
                    )}
                    {pendingTasks.length > 0 && (
                      <button onClick={() => quickAsk(`I have these pending tasks: ${pendingTasks.slice(0, 3).map(t => t.text).join(", ")}. Help me prioritize and make a plan.`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm rounded-full hover:bg-indigo-100 transition-all">
                        <ListChecks className="w-3 h-3" /> Plan my pending tasks
                      </button>
                    )}
                    <button onClick={() => quickAsk("Based on my study habits, what should I improve? Give me specific advice.")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-sm rounded-full hover:bg-indigo-100 transition-all">
                      <BookOpen className="w-3 h-3" /> How can I study better?
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isStreamingPlaceholder =
            loading && msg.role === "assistant" && i === messages.length - 1 && msg.content === "";
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                </div>
              )}
              {msg.role === "user" ? (
                <div
                  data-testid={`msg-${msg.role}-${i}`}
                  className="max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed bg-blue-500 text-white"
                >
                  {msg.content}
                </div>
              ) : isStreamingPlaceholder ? (
                <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1.5 items-center">
                    {[0, 150, 300].map(delay => (
                      <span key={delay} className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                    <span className="text-xs text-gray-400 ml-1">Thinking…</span>
                  </div>
                </div>
              ) : (
                <div
                  data-testid={`msg-${msg.role}-${i}`}
                  className="max-w-[82%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-gray-800 bg-white border border-gray-100 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                />
              )}
            </div>
          );
        })}

        {/* Show separate loading indicator only when no streaming placeholder is present */}
        {loading && (messages.length === 0 || messages[messages.length - 1]?.role !== "assistant") && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-4 border-t border-gray-100 bg-white flex-shrink-0">
        <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto">
          <input
            data-testid="input-ai-message"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={cooldown > 0}
            placeholder={cooldown > 0 ? `Please wait ${cooldown}s…` : "Ask Nep AI a question…"}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:bg-gray-50"
          />
          <button
            data-testid="btn-send-ai"
            type="submit"
            disabled={loading || !input.trim() || cooldown > 0}
            className="w-12 h-12 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center flex-shrink-0 flex-col gap-0"
          >
            {cooldown > 0
              ? <span className="text-[10px] font-bold leading-none">{cooldown}s</span>
              : <Send className="w-4 h-4" />
            }
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NepAi() {
  return (
    <>
      <Helmet>
        <title>Nep AI — AI Study Assistant | Student Hub</title>
        <meta name="description" content="Ask Nep AI any academic question. Get instant answers for Grade 9–12 subjects in Nepal." />
      </Helmet>
      <SoftGate feature="Nep AI">
        <NepAiContent />
      </SoftGate>
    </>
  );
}
