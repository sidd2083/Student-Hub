import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

type Tab = "login" | "register";

const ICONS = [
  { emoji: "📚", label: "Notes", x: "8%", y: "15%", delay: "0s", size: "text-3xl" },
  { emoji: "🧠", label: "MCQ", x: "85%", y: "10%", delay: "0.3s", size: "text-2xl" },
  { emoji: "⏱️", label: "Timer", x: "78%", y: "75%", delay: "0.6s", size: "text-3xl" },
  { emoji: "🤖", label: "AI", x: "12%", y: "78%", delay: "0.9s", size: "text-2xl" },
  { emoji: "🏆", label: "Rank", x: "50%", y: "5%", delay: "1.2s", size: "text-xl" },
  { emoji: "✅", label: "Tasks", x: "3%", y: "48%", delay: "1.5s", size: "text-xl" },
  { emoji: "📝", label: "PYQ", x: "90%", y: "45%", delay: "1.8s", size: "text-2xl" },
];

function FloatingIcon({ emoji, x, y, delay, size }: { emoji: string; label: string; x: string; y: string; delay: string; size: string }) {
  return (
    <div
      className={`absolute ${size} select-none pointer-events-none`}
      style={{
        left: x,
        top: y,
        animation: `float 3s ease-in-out infinite`,
        animationDelay: delay,
        opacity: 0.35,
      }}
    >
      {emoji}
    </div>
  );
}

export default function Login() {
  const { user, profile, loading, redirectLoading, signInWithGoogle } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("login");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      setLocation("/dashboard");
    } else if (!loading && user && !profile) {
      setLocation("/onboarding");
    }
  }, [user, profile, loading]);

  const handleGoogle = async () => {
    setBusy(true);
    await signInWithGoogle();
  };

  const showSpinner = redirectLoading || busy;

  return (
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
        <div className="text-center mb-8 anim-up" style={{ animationDelay: "0.05s" }}>
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
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-7">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <div className="anim-up">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome back! 👋</h2>
              <p className="text-gray-500 text-sm mb-6">Sign in with your Google account to continue</p>

              <button
                data-testid="btn-google-signin"
                onClick={handleGoogle}
                disabled={showSpinner}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-gray-200 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-60 shadow-sm group"
              >
                {showSpinner ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>{showSpinner ? "Redirecting to Google..." : "Continue with Google"}</span>
              </button>

              <p className="text-center text-xs text-gray-400 mt-5">
                Don't have an account?{" "}
                <button onClick={() => setTab("register")} className="text-blue-500 hover:underline font-medium">
                  Create one
                </button>
              </p>
            </div>
          ) : (
            <div className="anim-up">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Join Student Hub 🚀</h2>
              <p className="text-gray-500 text-sm mb-5">Sign up with Google — we'll collect a few details after</p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                  <span className="text-lg">📚</span>
                  <p className="text-sm text-blue-700 font-medium">Access notes by grade & subject</p>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                  <span className="text-lg">🧠</span>
                  <p className="text-sm text-purple-700 font-medium">Practice MCQs and track scores</p>
                </div>
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
                  <span className="text-lg">🤖</span>
                  <p className="text-sm text-indigo-700 font-medium">Get help from Nep AI assistant</p>
                </div>
              </div>

              <button
                data-testid="btn-google-register"
                onClick={handleGoogle}
                disabled={showSpinner}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-2xl hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg shadow-blue-200"
              >
                {showSpinner ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fillOpacity="0.9"/>
                    <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fillOpacity="0.9"/>
                    <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fillOpacity="0.9"/>
                    <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fillOpacity="0.9"/>
                  </svg>
                )}
                <span>{showSpinner ? "Redirecting to Google..." : "Sign up with Google"}</span>
              </button>

              <p className="text-center text-xs text-gray-400 mt-5">
                Already have an account?{" "}
                <button onClick={() => setTab("login")} className="text-blue-500 hover:underline font-medium">
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          For students in grades 9–12 · Secure Google authentication
        </p>
      </div>
    </div>
  );
}
