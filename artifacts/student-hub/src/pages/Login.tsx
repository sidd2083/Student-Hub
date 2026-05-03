import { useAuth } from "@/context/AuthContext";
import { BookOpen } from "lucide-react";
import { useState } from "react";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">Student Hub</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-500 mb-8">Sign in to continue learning</p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}
          <button
            data-testid="btn-google-signin"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "Signing in..." : "Continue with Google"}
          </button>
          <p className="text-center text-xs text-gray-400 mt-6">
            Your academic journey starts here
          </p>
        </div>
      </div>
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="grid grid-cols-2 gap-4 mb-8">
            {["Notes", "MCQ Practice", "Study Timer", "Nep AI"].map((item) => (
              <div key={item} className="bg-white rounded-2xl p-4 shadow-sm text-left">
                <div className="w-6 h-6 bg-blue-100 rounded-lg mb-2"></div>
                <p className="text-sm font-medium text-gray-700">{item}</p>
              </div>
            ))}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Everything you need to study</h2>
          <p className="text-gray-500 text-sm">Notes, quizzes, timers, and AI help — all in one place</p>
        </div>
      </div>
    </div>
  );
}
