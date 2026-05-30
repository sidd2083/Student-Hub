import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadProfilePhoto, removeProfilePhoto } from "@/lib/photoUpload";
import { Sun, Moon, Shield, Check, LogOut, Camera, Trash2, Loader2 } from "lucide-react";

export default function Settings() {
  const { profile, setProfile, user, signOut } = useAuth();
  const [name,        setName]        = useState(profile?.name ?? "");
  const [grade,       setGrade]       = useState<number>(profile?.grade ?? 10);
  const [saving,      setSaving]      = useState(false);
  const [gradeSaving, setGradeSaving] = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState("");

  const [uploadPct,   setUploadPct]   = useState<number | null>(null);
  const [photoPreview,setPhotoPreview]= useState<string | null>(null);
  const [photoError,  setPhotoError]  = useState("");
  const [removing,    setRemoving]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [darkMode, setDarkMode] = useState(
    () => typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (profile) { setName(profile.name ?? ""); setGrade(profile.grade ?? 10); }
  }, [profile]);

  const toggleTheme = async () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    if (user) try { await updateDoc(doc(db, "users", user.uid), { darkMode: next }); } catch {}
  };

  const handleGradeSwitch = async (g: number) => {
    if (g === grade || !user) return;
    setGrade(g);
    setProfile({ ...profile!, grade: g });
    setGradeSaving(true);
    try { await updateDoc(doc(db, "users", user.uid), { grade: g }); }
    catch (e) { console.error("Grade update failed:", e); }
    finally { setGradeSaving(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name cannot be empty.");
    if (!user) return;
    setSaving(true); setError(""); setSuccess(false);
    try {
      await updateDoc(doc(db, "users", user.uid), { name: name.trim() });
      setProfile({ ...profile!, name: name.trim() });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setPhotoError("");

    if (!file.type.startsWith("image/")) {
      setPhotoError("Please pick an image file (JPG, PNG, etc.)");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPhotoError("File too large — max 15 MB.");
      return;
    }

    // Show local preview immediately
    const local = URL.createObjectURL(file);
    setPhotoPreview(local);
    setUploadPct(0);

    let uploadedUrl: string | null = null;
    try {
      const url = await uploadProfilePhoto(user.uid, file, (pct) => setUploadPct(pct), () => user.getIdToken());
      uploadedUrl = url;
      URL.revokeObjectURL(local);
      setPhotoPreview(url);
      setProfile({ ...profile!, photoURL: url });
    } catch (err) {
      URL.revokeObjectURL(local);
      setPhotoPreview(null);
      const msg = (err as Error).message || "Upload failed — please try again.";
      setPhotoError(msg);
      console.error("[Settings] Upload error:", err);
    } finally {
      // Only clear the uploading state after fully confirming success or failure.
      // If upload succeeded (uploadedUrl is set), briefly show 100% before clearing.
      if (uploadedUrl) {
        setUploadPct(100);
        await new Promise(r => setTimeout(r, 600));
      }
      setUploadPct(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setRemoving(true);
    try {
      await removeProfilePhoto(user.uid);
      setPhotoPreview(null);
      setProfile({ ...profile!, photoURL: undefined });
    } catch { /* silent */ }
    finally { setRemoving(false); }
  };

  const currentPhoto   = photoPreview ?? profile?.photoURL ?? null;
  const initial        = (profile?.name ?? user?.displayName ?? "?").charAt(0).toUpperCase();
  const isUploading    = uploadPct !== null;

  return (
    <>
      <Helmet>
        <title>Settings — Student Hub</title>
        <meta name="description" content="Manage your Student Hub profile and preferences." />
      </Helmet>

      <div className="px-4 pt-4 pb-36 sm:p-8 max-w-2xl mx-auto space-y-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your account and preferences</p>
        </div>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profile</h2>

          {/* ── Avatar tap-to-change ─────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
            {/* Entire avatar is the tap/click target */}
            <button
              type="button"
              disabled={isUploading || removing}
              onClick={() => fileInputRef.current?.click()}
              className="relative group focus:outline-none"
              aria-label="Change profile photo"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-gray-900 transition-transform active:scale-95">
                {currentPhoto ? (
                  <img
                    src={currentPhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={() => setPhotoPreview(null)}
                  />
                ) : (
                  <span className="text-white text-3xl font-bold select-none">{initial}</span>
                )}
              </div>

              {/* Upload spinner overlay */}
              {isUploading && (
                <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center bg-black/50">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <span className="text-white text-xs font-bold mt-1">{uploadPct}%</span>
                </div>
              )}

              {/* Camera overlay on hover/non-uploading */}
              {!isUploading && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}

              {/* Small camera badge for mobile (always visible) */}
              {!isUploading && (
                <span className="absolute bottom-1 right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-gray-900 sm:hidden">
                  <Camera className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </button>

            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {isUploading ? `Uploading… ${uploadPct}%` : currentPhoto ? "Tap photo to change" : "Tap to add a photo"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Auto-resized · Only visible in classroom & here
              </p>
            </div>

            {currentPhoto && !isUploading && (
              <button
                type="button"
                disabled={removing}
                onClick={handleRemove}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50 transition-colors disabled:opacity-50"
              >
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove photo
              </button>
            )}

            {photoError && (
              <p className="text-xs text-red-500 dark:text-red-400 text-center max-w-xs">{photoError}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* ── Name + Grade form ──────────────────────────────────────────── */}
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                placeholder="Your full name"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60 placeholder-gray-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Grade</label>
                {gradeSaving && <span className="text-xs text-blue-500 animate-pulse">Saving…</span>}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[9, 10, 11, 12].map((g) => (
                  <button key={g} type="button" disabled={saving} onClick={() => handleGradeSwitch(g)}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all disabled:opacity-60 ${
                      grade === g
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300"
                    }`}
                  >Grade {g}</button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {([
                  { value: 13, label: "CEE", sub: "Medical" },
                  { value: 14, label: "IOE", sub: "Engineering" },
                  { value: 15, label: "Bachelor's", sub: "University" },
                ] as const).map(({ value, label, sub }) => (
                  <button key={value} type="button" disabled={saving} onClick={() => handleGradeSwitch(value)}
                    className={`py-3 rounded-xl border-2 flex flex-col items-center gap-0.5 transition-all disabled:opacity-60 ${
                      grade === value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300"
                    }`}
                  >
                    <span className="text-sm font-bold">{label}</span>
                    <span className="text-[9px] opacity-60">{sub}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Grade updates instantly — no save needed.</p>
            </div>

            {error   && <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">{error}</div>}
            {success && <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 text-sm font-medium flex items-center gap-2"><Check className="w-4 h-4" /> Name saved!</div>}

            <button type="submit" disabled={saving}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 text-sm">
              {saving ? "Saving…" : "Save Name"}
            </button>
          </form>
        </div>

        {/* ── Appearance ────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              {darkMode ? <Moon className="w-4 h-4 text-amber-600" /> : <Sun className="w-4 h-4 text-amber-600" />}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Switch between light and dark theme</p>
            </div>
            <button onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${darkMode ? "bg-blue-500" : "bg-gray-200"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${darkMode ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </div>

        {/* ── Account ───────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              { label: "Email", value: profile?.email ?? user?.email ?? "—" },
              { label: "Grade", value: profile?.grade
                  ? ({ 13: "CEE (Medical)", 14: "IOE (Engineering)", 15: "Bachelor's" } as Record<number,string>)[profile.grade] ?? `Grade ${profile.grade}`
                  : "—" },
              { label: "Role",  value: profile?.role ?? "user" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                <span className="text-gray-900 dark:text-white font-medium capitalize">{value}</span>
              </div>
            ))}
          </div>
          <button onClick={signOut}
            className="mt-5 flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-red-100 dark:border-red-900">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
