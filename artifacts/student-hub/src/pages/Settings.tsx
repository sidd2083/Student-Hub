import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, Sun, Moon, Shield, Check, LogOut } from "lucide-react";

export default function Settings() {
  const { profile, setProfile, user, signOut } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [grade, setGrade] = useState<number>(profile?.grade || 10);
  const [saving, setSaving] = useState(false);
  const [gradeSaving, setGradeSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setGrade(profile.grade || 10);
    }
  }, [profile]);

  const toggleTheme = async () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), { darkMode: next });
      } catch {}
    }
  };

  const handleGradeSwitch = async (g: number) => {
    if (g === grade || !user) return;
    setGrade(g);
    setProfile({ ...profile!, grade: g });
    setGradeSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { grade: g });
    } catch (err) {
      console.error("Grade update failed:", err);
    } finally {
      setGradeSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name cannot be empty.");
    if (!user) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateDoc(doc(db, "users", user.uid), { name: name.trim() });
      setProfile({ ...profile!, name: name.trim() });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Profile update failed:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Settings — Student Hub</title>
        <meta name="description" content="Manage your Student Hub profile, grade, and appearance settings." />
      </Helmet>
      <div className="px-4 pt-4 pb-36 sm:p-8 max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
            <p className="text-gray-500 text-sm">Manage your account and preferences</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all disabled:opacity-60"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Grade</label>
                  {gradeSaving && <span className="text-xs text-blue-500 animate-pulse">Saving…</span>}
                  {!gradeSaving && grade !== (profile?.grade || 10) && (
                    <span className="text-xs text-green-600 flex items-center gap-0.5"><Check className="w-3 h-3" /> Saved</span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[9, 10, 11, 12].map((g) => (
                    <button
                      key={g}
                      type="button"
                      disabled={saving}
                      onClick={() => handleGradeSwitch(g)}
                      className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all disabled:opacity-60 ${
                        grade === g
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/40"
                      }`}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Grade updates instantly — no save needed.</p>
              </div>

              {error && <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">{error}</div>}
              {success && <div className="px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm font-medium flex items-center gap-2"><Check className="w-4 h-4" /> Name saved successfully!</div>}

              <button type="submit" disabled={saving} className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 text-sm">
                {saving ? "Saving…" : "Save Name"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                {darkMode ? <Moon className="w-4 h-4 text-amber-600" /> : <Sun className="w-4 h-4 text-amber-600" />}
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Dark Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">Switch between light and dark theme</p>
              </div>
              <button onClick={toggleTheme} className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${darkMode ? "bg-blue-500" : "bg-gray-200"}`} aria-label="Toggle dark mode">
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${darkMode ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
                <Shield className="w-4 h-4 text-gray-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-900 font-medium">{profile?.email || user?.email || "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Grade</span>
                <span className="text-gray-900 font-medium">{profile?.grade ? `Grade ${profile.grade}` : "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Role</span>
                <span className="text-gray-900 font-medium capitalize">{profile?.role || "user"}</span>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-5 flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all border border-red-100"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
    </>
  );
}
