import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCreateUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { BookOpen } from "lucide-react";

export default function Onboarding() {
  const { user, setProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState(user?.displayName || "");
  const [grade, setGrade] = useState<number | "">("");
  const [error, setError] = useState("");
  const createUser = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your name");
    if (!grade) return setError("Please select your grade");
    if (!user) return;
    setError("");
    createUser.mutate(
      { data: { uid: user.uid, name: name.trim(), email: user.email || "", grade: Number(grade) } },
      {
        onSuccess: (profile) => {
          setProfile(profile as { id: number; uid: string; name: string; email: string; grade: number; role: "user" | "admin"; createdAt: string });
          setLocation("/dashboard");
        },
        onError: () => setError("Something went wrong. Please try again."),
      }
    );
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">Student Hub</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">Set up your profile</h1>
        <p className="text-gray-500 text-center mb-8">Just a couple of details to get started</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input
              data-testid="input-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Grade</label>
            <select
              data-testid="select-grade"
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value) as 9 | 10 | 11 | 12)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            >
              <option value="">Select your grade</option>
              {[9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            data-testid="btn-continue"
            type="submit"
            disabled={createUser.isPending}
            className="w-full py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-all disabled:opacity-60 mt-2"
          >
            {createUser.isPending ? "Setting up..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
