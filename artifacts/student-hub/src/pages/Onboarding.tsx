import { useState } from "react";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLocation } from "wouter";

export default function Onboarding() {
  const { user, setProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(user?.displayName || "");
  const [grade, setGrade] = useState<number | "">("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your name.");
    if (!grade) return setError("Please select your grade.");
    if (!agreed) return setError("Please accept the Terms & Conditions.");
    if (!user) return setError("No session. Please refresh and try again.");

    setSaving(true);
    setError("");

    try {
      const now = new Date().toISOString();
      const data = {
        uid: user.uid,
        name: name.trim(),
        email: user.email ?? "",
        grade: Number(grade),
        role: "user" as const,
        createdAt: now,
        streak: 0,
        totalStudyTime: 0,
        todayStudyTime: 0,
        lastActiveDate: null,
      };

      console.log("[Auth] Saving user profile to Firestore:", user.uid);
      await setDoc(doc(db, "users", user.uid), data);
      console.log("[Auth] User saved:", user.uid, "name:", data.name, "grade:", data.grade);

      const newProfile: UserProfile = { id: 0, ...data };
      setProfile(newProfile);
      setLocation("/dashboard");
    } catch (err) {
      console.error("[Auth] Failed to save profile:", err);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 relative overflow-hidden">
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .anim { animation: fadeUp 0.4s ease both; }
        .anim-1 { animation-delay: 0.05s; }
        .anim-2 { animation-delay: 0.1s; }
      `}</style>

      <div className="absolute top-[-60px] right-[-60px] w-64 h-64 rounded-full bg-blue-50 blur-3xl opacity-70 pointer-events-none" />
      <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full bg-indigo-50 blur-3xl opacity-60 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 anim">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Complete your profile</h1>
          <p className="text-gray-500 text-sm">Just a few details to personalise your experience</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8 anim anim-1">
          <div className="h-1.5 w-8 rounded-full bg-green-400" />
          <div className="h-1.5 w-8 rounded-full bg-blue-500" />
          <div className={`h-1.5 w-8 rounded-full transition-all ${grade ? "bg-blue-500" : "bg-gray-200"}`} />
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 anim anim-2">
          {user && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-2xl mb-6">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-9 h-9 rounded-full ring-2 ring-green-200" alt="" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-sm">
                  {user.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800">✓ Google account connected</p>
                <p className="text-xs text-green-600 truncate">{user.email}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                data-testid="input-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Sharma"
                disabled={saving}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Your Grade <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    type="button"
                    data-testid={`grade-btn-${g}`}
                    disabled={saving}
                    onClick={() => setGrade(g)}
                    className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-0.5 disabled:opacity-60 ${
                      grade === g
                        ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm"
                        : "border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50"
                    }`}
                  >
                    <span className="text-xl font-bold leading-none">{g}</span>
                    <span className="text-[10px] text-gray-400">Grade</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer pt-1">
              <div
                onClick={() => !saving && setAgreed((a) => !a)}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                  agreed ? "bg-blue-500 border-blue-500" : "border-gray-300 hover:border-blue-400"
                }`}
              >
                {agreed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-600 leading-relaxed">
                I agree to the{" "}
                <span className="text-blue-500 font-medium">Terms & Conditions</span>
                {" "}and{" "}
                <span className="text-blue-500 font-medium">Privacy Policy</span>
                <span className="text-gray-400 text-xs block mt-0.5">(Full document coming soon)</span>
              </span>
            </label>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                <span>⚠️</span>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              data-testid="btn-continue"
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-2xl hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving your profile…
                </span>
              ) : (
                "Let's Go! 🚀"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Student Hub · Grades 9–12 · Secure & private
        </p>
      </div>
    </div>
  );
}
