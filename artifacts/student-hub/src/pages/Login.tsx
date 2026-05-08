import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";

const ICONS = [
  { emoji: "📚", label: "Notes",   x: "8%",  y: "15%", delay: "0s",   size: "text-3xl" },
  { emoji: "📊", label: "Report",  x: "85%", y: "10%", delay: "0.3s", size: "text-2xl" },
  { emoji: "⏱️", label: "Timer",   x: "78%", y: "75%", delay: "0.6s", size: "text-3xl" },
  { emoji: "🤖", label: "AI",      x: "12%", y: "78%", delay: "0.9s", size: "text-2xl" },
  { emoji: "🏆", label: "Rank",    x: "50%", y: "5%",  delay: "1.2s", size: "text-xl"  },
  { emoji: "✅", label: "Tasks",   x: "3%",  y: "48%", delay: "1.5s", size: "text-xl"  },
  { emoji: "📝", label: "PYQ",     x: "90%", y: "45%", delay: "1.8s", size: "text-2xl" },
];

function FloatingIcon({ emoji, x, y, delay, size }: { emoji: string; label: string; x: string; y: string; delay: string; size: string }) {
  return (
    <div
      className={`absolute ${size} select-none pointer-events-none`}
      style={{ left: x, top: y, animation: "float 3s ease-in-out infinite", animationDelay: delay, opacity: 0.3 }}
    >
      {emoji}
    </div>
  );
}

export default function Login() {
  const { signIn } = useAuth();

  return (
    <>
      <Helmet>
        <title>Login — Student Hub | Free Study Platform for Nepal Students</title>
        <meta name="description" content="Sign in to Student Hub — access notes, past papers, Nep AI, and study progress tracking. Free for Grade 9–12 students in Nepal." />
        <meta property="og:title" content="Student Hub — Free Study Platform" />
        <meta property="og:description" content="Notes, PYQs, Nep AI and study tracking for Grade 9–12 students in Nepal." />
      </Helmet>
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50% { transform: translateY(-14px) rotate(3deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .anim-up { animation: fadeSlideUp 0.5s ease forwards; }
        .anim-scale { animation: scaleIn 0.4s ease forwards; }
      `}</style>

      {/* Gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-blue-100 blur-3xl opacity-60" />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full bg-indigo-100 blur-3xl opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-purple-50 blur-3xl opacity-40" />
      </div>

      {/* Floating emojis */}
      {ICONS.map((ic) => <FloatingIcon key={ic.label} {...ic} />)}

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4 anim-scale">
        {/* Logo */}
        <div className="text-center mb-8 anim-up">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <span className="text-xl">📖</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">Student Hub</span>
          </div>
          <p className="text-gray-500 text-sm">Your complete study companion</p>
        </div>

        {/* Main card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-xl shadow-gray-100 p-8 anim-up" style={{ animationDelay: "0.1s" }}>
          <div className="anim-up">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome to Student Hub 👋</h2>
            <p className="text-gray-500 text-sm mb-6">Sign in to access notes, PYQs, Nep AI, and more</p>

            <div className="space-y-3 mb-6">
              {[
                { emoji: "📚", color: "bg-blue-50 text-blue-700",     text: "Access notes by grade & subject" },
                { emoji: "📊", color: "bg-purple-50 text-purple-700", text: "Track your study time and progress" },
                { emoji: "🤖", color: "bg-indigo-50 text-indigo-700", text: "Get help from Nep AI study assistant" },
              ].map(({ emoji, color, text }) => (
                <div key={text} className={`flex items-center gap-3 p-3 rounded-xl ${color.split(" ")[0]}`}>
                  <span className="text-lg">{emoji}</span>
                  <p className={`text-sm font-medium ${color.split(" ")[1]}`}>{text}</p>
                </div>
              ))}
            </div>

            <button
              data-testid="btn-signin"
              type="button"
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-2xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200"
            >
              <span>Sign In to Continue</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          For students in grades 9–12 · Secure authentication
        </p>
      </div>
    </div>
    </>
  );
}
