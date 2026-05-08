import { useState, useRef, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { SoftGate } from "@/components/SoftGate";
import { useAuth } from "@/context/AuthContext";
import { Send, MessageCircle, Sparkles, BookOpen, BarChart2, ListChecks } from "lucide-react";
import { useSearch } from "wouter";

interface Message { role: "user" | "assistant"; content: string }

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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STUDY_FALLBACKS: [RegExp, string][] = [
  [/who (built|made|created|developed) you|who are you|tell me about yourself/i,
    "I'm Nep AI, built by Siddhant Lamichhane to help Grade 9–12 students in Nepal. I can explain concepts, solve problems, analyze your study habits, and help you improve. What would you like to learn?"],
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

function NepAiContent() {
  const { user } = useAuth();
  const search = useSearch();
  const initialQ = new URLSearchParams(search).get("q") || "";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<StudyContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [showCtxBanner, setShowCtxBanner] = useState(false);
  const autoSentRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-send if navigated from ReportCard with a ?q= param
  useEffect(() => {
    if (!initialQ || autoSentRef.current || !user) return;
    autoSentRef.current = true;
    // Load context first, then send
    (async () => {
      setLoadingCtx(true);
      let ctx: StudyContext | null = null;
      try {
        const [statsRes, tasksRes, logsRes] = await Promise.all([
          fetch(`/api/study/stats/${user.id}`),
          fetch(`/api/tasks?uid=${user.id}`),
          fetch(`/api/study/logs/${user.id}`),
        ]);
        const stats = statsRes.ok ? await statsRes.json() : undefined;
        const tasks = tasksRes.ok ? await tasksRes.json() : undefined;
        const logs: Array<{ studyMinutes: number }> = logsRes.ok ? await logsRes.json() : [];
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const weeklyMins = logs.filter((l: any) => new Date(l.date) >= weekAgo).reduce((s: number, l: any) => s + (l.studyMinutes || 0), 0);
        ctx = { stats, tasks: Array.isArray(tasks) ? tasks : undefined, weeklyMins };
        setContext(ctx);
      } catch { /* ignore */ } finally { setLoadingCtx(false); }

      // Now send the message with context
      const msg = initialQ;
      setMessages([{ role: "user", content: msg }]);
      setLoading(true);
      try {
        const res = await fetch(`${BASE}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, history: [], context: ctx ?? undefined }),
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json() as { reply?: string };
        setMessages(prev => [...prev, { role: "assistant", content: data.reply || "No response." }]);
      } catch {
        setMessages(prev => [...prev, { role: "assistant", content: getLocalFallback(msg) }]);
      } finally { setLoading(false); }
    })();
  }, [initialQ, user]);

  // Load context (tasks + study stats) when user is present
  const loadContext = useCallback(async () => {
    if (!user?.id) return;
    setLoadingCtx(true);
    try {
      const [statsRes, tasksRes, logsRes] = await Promise.all([
        fetch(`/api/study/stats/${user.id}`),
        fetch(`/api/tasks?uid=${user.id}`),
        fetch(`/api/study/logs/${user.id}`),
      ]);
      const stats = statsRes.ok ? await statsRes.json() : undefined;
      const tasks = tasksRes.ok ? await tasksRes.json() : undefined;
      const logs: Array<{ studyMinutes: number }> = logsRes.ok ? await logsRes.json() : [];

      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyMins = logs
        .filter((l: any) => new Date(l.date) >= weekAgo)
        .reduce((s: number, l: any) => s + (l.studyMinutes || 0), 0);

      const ctx: StudyContext = { stats, tasks: Array.isArray(tasks) ? tasks : undefined, weeklyMins };
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
    const newMessages: Message[] = [...messages, { role: "user" as const, content: msg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages,
          context: context ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json() as { reply?: string };
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "No response generated." }]);
    } catch (err) {
      console.warn("AI API failed, using fallback:", err);
      setMessages(prev => [...prev, { role: "assistant", content: getLocalFallback(msg) }]);
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
      {/* Header */}
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
            onClick={loadContext}
            disabled={loadingCtx || !user}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              context
                ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                : "bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
            } disabled:opacity-50`}
            title="Load your tasks & study stats into context"
          >
            {loadingCtx ? (
              <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <BarChart2 className="w-3.5 h-3.5" />
            )}
            {context ? "Context loaded" : "Load my data"}
          </button>
        </div>

        {/* Context banner */}
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

      {/* Messages */}
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

            {/* Quick prompts */}
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

              {/* Contextual prompts (only if context loaded) */}
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

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              </div>
            )}
            <div
              data-testid={`msg-${msg.role}-${i}`}
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-br-sm"
                  : "bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
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

      {/* Input */}
      <div className="px-4 py-4 border-t border-gray-100 bg-white flex-shrink-0">
        <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto">
          <input
            data-testid="input-ai-message"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Nep AI a question…"
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <button
            data-testid="btn-send-ai"
            type="submit"
            disabled={loading || !input.trim()}
            className="w-12 h-12 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all disabled:opacity-50 flex items-center justify-center flex-shrink-0"
          >
            <Send className="w-4 h-4" />
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
