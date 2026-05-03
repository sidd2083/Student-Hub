import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCreateUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";

export default function Onboarding() {
  const { user, profile, setProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(user?.displayName || "");
  const [grade, setGrade] = useState<number | "">("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const createUser = useCreateUser();

  useEffect(() => {
    if (profile) setLocation("/dashboard");
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your name");
    if (!grade) return setError("Please select your grade");
    if (!user) return;
    setError("");
    createUser.mutate(
      { data: { uid: user.uid, name: name.trim(), email: user.email || "", grade: Number(grade) } },
      {
        onSuccess: (p) => {
          setProfile(p as typeof profile);
          setLocation("/dashboard");
        },
        onError: () => setError("Something went wrong. Please try again."),
      }
    );
  };

  const GRADES = [9, 10, 11, 12];

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 relative overflow-hidden">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .anim-up { animation: fadeSlideUp 0.45s ease forwards; }
      `}</style>

      <div className="absolute top-[-60px] right-[-60px] w-64 h-64 rounded-full bg-blue-50 blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full bg-indigo-50 blur-3xl opacity-50 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8 anim-up">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Set up your profile</h1>
          <p className="text-gray-500 text-sm">Just two quick details to get started</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center anim-up" style={{ animationDelay: "0.05s" }}>
          <div className={`h-1.5 w-16 rounded-full transition-all ${step >= 1 ? "bg-blue-500" : "bg-gray-200"}`} />
          <div className={`h-1.5 w-16 rounded-full transition-all ${step >= 2 ? "bg-blue-500" : "bg-gray-200"}`} />
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100 p-8 anim-up" style={{ animationDelay: "0.1s" }}>
          {/* Google account info */}
          {user && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-2xl mb-6">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-9 h-9 rounded-full" alt="" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-sm">
                  {user.displayName?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-green-800">✓ Google account connected</p>
                <p className="text-xs text-green-600">{user.email}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Full Name
              </label>
              <input
                data-testid="input-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setStep(1); }}
                onFocus={() => setStep(1)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Which grade are you in?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    data-testid={`grade-btn-${g}`}
                    onClick={() => { setGrade(g); setStep(2); }}
                    className={`py-3 rounded-2xl text-sm font-semibold border-2 transition-all ${
                      grade === g
                        ? "border-blue-500 bg-blue-50 text-blue-600"
                        : "border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {g}
                    <span className="block text-xs font-normal opacity-70">Grade</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm flex items-center gap-1.5">
                <span>⚠️</span> {error}
              </p>
            )}

            <button
              data-testid="btn-continue"
              type="submit"
              disabled={createUser.isPending || !name.trim() || !grade}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 mt-2"
            >
              {createUser.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Setting up...
                </span>
              ) : (
                "Let's Go! 🚀"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
