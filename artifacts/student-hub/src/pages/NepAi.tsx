import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useNepAiChat } from "@workspace/api-client-react";
import { Send, MessageCircle, Sparkles } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string }

export default function NepAi() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const nepAiChat = useNepAiChat();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || nepAiChat.isPending) return;
    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    nepAiChat.mutate(
      { data: { message: msg, history: messages } },
      {
        onSuccess: (data) => {
          setMessages(prev => [...prev, { role: "assistant", content: (data as { reply: string }).reply }]);
        },
        onError: () => {
          setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process your request. Please try again." }]);
        }
      }
    );
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <div className="p-6 pb-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Nep AI</h1>
              <p className="text-xs text-gray-500">Your study assistant</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="font-medium text-gray-700 mb-2">Ask me anything</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">I can help explain concepts, solve problems, and answer study questions</p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {["Explain Newton's laws", "Solve x² - 5x + 6 = 0", "What is photosynthesis?"].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                  >
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
              <div
                data-testid={`msg-${msg.role}-${i}`}
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {nepAiChat.isPending && (
            <div className="flex justify-start">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
          <form onSubmit={sendMessage} className="flex gap-3">
            <input
              data-testid="input-ai-message"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nep AI a question..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <button
              data-testid="btn-send-ai"
              type="submit"
              disabled={nepAiChat.isPending || !input.trim()}
              className="px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
