import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import {
  collection, addDoc, query, where, orderBy, onSnapshot, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import {
  MessageSquarePlus, Send, CheckCircle2, Clock, MessageCircle, Sparkles,
} from "lucide-react";

type FeedbackType = "feature" | "bug" | "other";
type Status = "new" | "seen" | "replied";

interface FeedbackDoc {
  id: string;
  type: FeedbackType;
  text: string;
  status: Status;
  createdAt: string;
  reply?: string;
  repliedAt?: string;
}

const TYPES: { value: FeedbackType; label: string; emoji: string; desc: string }[] = [
  { value: "feature", label: "New Feature", emoji: "✨", desc: "Something you'd love to see added" },
  { value: "bug",     label: "Bug Report",  emoji: "🐛", desc: "Something that's broken or wrong" },
  { value: "other",   label: "Other",       emoji: "💬", desc: "General feedback or suggestions" },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string; dot: string }> = {
  new:     { label: "Sent",     color: "bg-blue-50 text-blue-600",   dot: "bg-blue-400"  },
  seen:    { label: "Seen ✓",   color: "bg-amber-50 text-amber-600", dot: "bg-amber-400" },
  replied: { label: "Replied",  color: "bg-green-50 text-green-700", dot: "bg-green-500" },
};

function FeedbackContent() {
  const { user, profile } = useAuth();
  const [type, setType]   = useState<FeedbackType>("feature");
  const [text, setText]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState(false);
  const [history, setHistory] = useState<FeedbackDoc[]>([]);

  // Live-listen to this user's feedback
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "feedback"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackDoc)));
    });
    return unsub;
  }, [user?.uid]);

  const submit = async () => {
    if (!text.trim() || loading || !user) return;
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
      setTimeout(() => setDone(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <MessageSquarePlus className="w-5 h-5 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Share Feedback</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11.5 mt-1">
          Your feedback directly shapes Student Hub. Every message is read personally.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        {done ? (
          <div className="flex items-center gap-3 py-4">
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900">Message sent — thank you! 🎉</p>
              <p className="text-sm text-gray-400 mt-0.5">We'll review it and get back to you soon.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700 mb-3">What type of feedback is this?</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                    type === t.value
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className="text-xs font-semibold leading-tight">{t.label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{t.desc}</span>
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={
                type === "feature"
                  ? "What feature would make Student Hub more useful for you? Be as specific as you like!"
                  : type === "bug"
                  ? "What went wrong? Tell us what happened, which page you were on, and what you expected."
                  : "Anything at all — ideas, praise, concerns, or general thoughts. We read everything."
              }
              rows={5}
              className="w-full text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1.5 mb-3">{text.length}/1000</p>

            <button
              onClick={submit}
              disabled={!text.trim() || loading || text.length > 1000}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
              {loading ? "Sending…" : "Send Feedback"}
            </button>
          </>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Your Previous Feedback
          </h2>
          <div className="space-y-3">
            {history.map(item => {
              const typeInfo = TYPES.find(t => t.value === item.type)!;
              const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.new;
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      {typeInfo.emoji} {typeInfo.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed mb-1">{item.text}</p>
                  <p className="text-[11px] text-gray-400">
                    {new Date(item.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </p>

                  {/* Admin reply */}
                  {item.reply && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                        <p className="text-xs font-semibold text-indigo-700">Reply from Siddhant</p>
                        {item.repliedAt && (
                          <p className="text-[10px] text-gray-400 ml-auto">
                            {new Date(item.repliedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed bg-indigo-50 rounded-xl px-3 py-2">{item.reply}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {history.length === 0 && !done && (
        <div className="text-center py-8 text-gray-400">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No feedback sent yet — be the first to shape the app!</p>
        </div>
      )}
    </div>
  );
}

export default function Feedback() {
  return (
    <>
      <Helmet>
        <title>Feedback — Student Hub</title>
        <meta name="description" content="Share your ideas, report bugs, or suggest features for Student Hub Nepal." />
      </Helmet>
      <SoftGate feature="the feedback page">
        <FeedbackContent />
      </SoftGate>
    </>
  );
}
