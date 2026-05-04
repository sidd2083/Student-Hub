import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Layout } from "@/components/Layout";
import { SoftGate } from "@/components/SoftGate";
import { Send, MessageCircle, Sparkles } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string }

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const STUDY_FALLBACKS: [RegExp, string][] = [
  [/who (built|made|created|developed) you|who are you|tell me about yourself/i,
    "I'm Nep AI, built by Siddhant Lamichhane to help Grade 9–12 students in Nepal. I can explain concepts, solve problems, and answer academic questions. What would you like to learn?"],
  [/newton/i,
    "Newton's Three Laws of Motion:\n1. An object at rest stays at rest unless acted upon by a force.\n2. F = ma (Force = mass × acceleration).\n3. Every action has an equal and opposite reaction."],
  [/photosynthesis/i,
    "Photosynthesis converts sunlight into food:\n6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂\nIt occurs in chloroplasts using the green pigment chlorophyll."],
  [/pythagoras|hypotenuse/i,
    "Pythagorean Theorem: a² + b² = c²\nwhere c is the hypotenuse.\nExample: a=3, b=4 → c = √(9+16) = 5."],
  [/quadratic|x²|x\^2/i,
    "Quadratic formula: x = (-b ± √(b²-4ac)) / 2a\nFor x² - 5x + 6 = 0: x = 3 or x = 2."],
  [/mitosis|meiosis/i,
    "Mitosis: 2 identical daughter cells (growth/repair).\nMeiosis: 4 unique gametes (reproduction, halves chromosome number)."],
  [/atom|proton|neutron|electron/i,
    "Atomic structure:\n• Protons (+) — in nucleus\n• Neutrons (0) — in nucleus\n• Electrons (-) — orbit in shells\nAtomic number = protons. Mass number = protons + neutrons."],
  [/gravity|gravitation/i,
    "Gravity: F = G(m₁m₂)/r²\nOn Earth, g ≈ 9.8 m/s². A falling object gains 9.8 m/s every second."],
];

function getLocalFallback(msg: string): string {
  for (const [pattern, response] of STUDY_FALLBACKS) {
    if (pattern.test(msg)) return response;
  }
  return "I'm having trouble connecting. Try asking about Newton's laws, photosynthesis, quadratic equations, or atomic structure!";
}

function NepAiContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json() as { reply?: string };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response generated." }]);
    } catch (err) {
      console.warn("AI API failed, using fallback:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: getLocalFallback(msg) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Nep AI</h1>
            <p className="text-xs text-gray-500">Your study assistant · Grades 9–12</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-7 h-7 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">Ask me anything</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-6">I can explain concepts, solve problems, and answer academic questions</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["Explain Newton's laws", "Solve x² - 5x + 6 = 0", "What is photosynthesis?", "Who built you?"].map((q) => (
                <button key={q} onClick={() => setInput(q)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                  {q}
                </button>
              ))}
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
            <div data-testid={`msg-${msg.role}-${i}`} className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user" ? "bg-blue-500 text-white rounded-br-sm" : "bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm"
            }`}>
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
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
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
            onChange={(e) => setInput(e.target.value)}
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
        <meta property="og:title" content="Nep AI — Student Hub" />
      </Helmet>
      <Layout>
        <SoftGate feature="Nep AI">
          <NepAiContent />
        </SoftGate>
      </Layout>
    </>
  );
}
