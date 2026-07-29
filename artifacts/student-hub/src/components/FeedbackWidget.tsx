import { useState } from "react";
import { Link } from "wouter";
import { MessageSquarePlus, Send, CheckCircle2, ChevronRight } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type FeedbackType = "feature" | "bug" | "other";

const TYPES: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: "feature", label: "New Feature", emoji: "✨" },
  { value: "bug",     label: "Bug Report",  emoji: "🐛" },
  { value: "other",   label: "Other",       emoji: "💬" },
];

export function FeedbackWidget() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType]   = useState<FeedbackType>("feature");
  const [text, setText]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState(false);

  if (!user) return null;

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "feedback"), {
        uid:       user.uid,
        name:      profile?.name ?? "Unknown",
        grade:     profile?.grade ?? null,
        type,
        text:      text.trim(),
        status:    "new",
        createdAt: new Date().toISOString(),
      });
      setDone(true);
      setText("");
      setTimeout(() => { setDone(false); setOpen(false); }, 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-5 sm:mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <MessageSquarePlus className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">Share Feedback</p>
          <p className="text-xs text-gray-400 leading-tight">Suggest a feature, report a bug, or anything else</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>

      {/* Expandable form */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50">
          {done ? (
            <div className="flex items-center gap-2.5 py-4 text-green-600">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">Thanks! Message sent 🎉</p>
                <p className="text-xs text-gray-400 mt-0.5">We'll review it soon.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Type chips */}
              <div className="flex gap-2 mt-3 mb-3">
                {TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      type === t.value
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={
                  type === "feature" ? "What feature would make this app better for you?"
                  : type === "bug"   ? "What's broken? Describe what happened..."
                  :                    "Anything you'd like to share with us..."
                }
                rows={3}
                className="w-full text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />

              <div className="flex items-center justify-between mt-2.5">
                <Link href="/feedback">
                  <a className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                    View your past feedback →
                  </a>
                </Link>
                <button
                  onClick={submit}
                  disabled={!text.trim() || loading}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {loading ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
