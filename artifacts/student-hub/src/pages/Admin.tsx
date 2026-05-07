import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useListNotes, useCreateNote, useDeleteNote,
  useListPyqs, useCreatePyq, useDeletePyq,
  getListNotesQueryKey,
  getListPyqsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, BookOpen, FileText, Users,
  Shield, Plus, Trash2, LogOut, Megaphone, Upload, X, Image,
  CheckCircle, AlertCircle, Award, Search,
} from "lucide-react";
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy, setDoc, getDoc, onSnapshot,
} from "firebase/firestore";
import {
  ref, uploadBytesResumable, getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";

const ADMIN_SESSION = "admin_session_v1";
type Section = "dashboard" | "notes" | "pyqs" | "announcements" | "users" | "reports" | "seo";

// ─── File Upload Component ──────────────────────────────────────────────────

interface FileUploadProps {
  accept: string;
  label: string;
  storagePath: string;
  onUploaded: (url: string, type: "pdf" | "image") => void;
  disabled?: boolean;
}

function FileUpload({ accept, label, storagePath, onUploaded, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  const upload = (file: File) => {
    setError("");
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      setError("Please upload a PDF or image file.");
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `${storagePath}/${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setError(err.message); setProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setProgress(null);
        onUploaded(url, isPdf ? "pdf" : "image");
      }
    );
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) upload(file);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all select-none ${
          dragging
            ? "border-blue-400 bg-blue-50"
            : disabled
            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
        }`}
      >
        <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
        {progress !== null ? (
          <div>
            <p className="text-sm text-blue-600 font-medium mb-2">Uploading… {progress}%</p>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">Drag & drop or click to select</p>
            <p className="text-xs text-gray-400">{accept}</p>
          </>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
      />
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ─── Admin Overview ────────────────────────────────────────────────────────

interface ApiUser { id: number; uid: string; name: string; email: string; grade: number; role: string; createdAt: string; streak: number; totalStudyTime: number; todayStudyTime: number; }

function AdminOverview() {
  const { data: noteStats } = useListNotes({}, { query: { queryKey: getListNotesQueryKey({}) } });
  const { data: pyqStats }  = useListPyqs({},  { query: { queryKey: getListPyqsQueryKey({})  } });
  const [users, setUsers]   = useState<ApiUser[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then(r => r.json())
      .then(setUsers)
      .catch(console.error);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const admins   = users.filter(u => u.role === "admin").length;
  const newToday = users.filter(u => u.createdAt?.slice(0, 10) === today).length;
  const byGrade  = users.reduce<Record<number, number>>((acc, u) => {
    if (u.grade) acc[u.grade] = (acc[u.grade] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Users"  value={users.length} />
        <StatCard label="Admins"       value={admins}       />
        <StatCard label="New Today"    value={newToday}     />
        <StatCard label="Notes in DB"  value={noteStats?.length || 0} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="PYQs in DB"      value={pyqStats?.length || 0} />
        <StatCard label="Grades Active"   value={Object.keys(byGrade).length} />
        <StatCard label="Non-Admin Users" value={users.length - admins} />
      </div>
      {Object.keys(byGrade).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-medium text-gray-700 mb-4">Users by Grade</h3>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(byGrade).sort(([a], [b]) => Number(a) - Number(b)).map(([g, c]) => (
              <div key={g} className="flex-1 min-w-[80px] text-center p-3 bg-blue-50 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{c}</p>
                <p className="text-xs text-gray-500 mt-1">Grade {g}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {users.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center text-gray-400 text-sm">
          No users yet — they appear here after signing up.
        </div>
      )}
    </div>
  );
}

// ─── Manage Notes ──────────────────────────────────────────────────────────

function ManageNotes() {
  const qc = useQueryClient();
  const { data: notes, isLoading } = useListNotes({}, { query: { queryKey: getListNotesQueryKey({}) } });
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const [show, setShow] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm] = useState({
    grade: 10, subject: "", chapter: "", title: "",
    contentType: "text" as "text" | "pdf" | "image",
    content: "",
  });
  const inv = () => qc.invalidateQueries({ queryKey: getListNotesQueryKey({}) });
  const reset = () => { setShow(false); setForm({ grade: 10, subject: "", chapter: "", title: "", contentType: "text", content: "" }); setSaveStatus("idle"); };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage Notes</h2>
        <button onClick={() => setShow(s => !s)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Add Note
        </button>
      </div>

      {show && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {[9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Content Type</label>
              <select value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value as "text" | "pdf" | "image", content: "" }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="text">Text</option>
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
              </select>
            </div>
          </div>

          {(["subject", "chapter", "title"] as const).map(f => (
            <div key={f}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{f}</label>
              <input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
            </div>
          ))}

          {form.contentType === "text" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" required />
            </div>
          )}

          {(form.contentType === "pdf" || form.contentType === "image") && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Upload {form.contentType === "pdf" ? "PDF" : "Image"}
              </label>
              {form.content ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  {form.contentType === "image" ? <Image className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-green-600" />}
                  <p className="text-sm text-green-700 flex-1 truncate">File uploaded ✓</p>
                  <button onClick={() => setForm(f => ({ ...f, content: "" }))} className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <FileUpload
                  accept={form.contentType === "pdf" ? ".pdf,application/pdf" : ".jpg,.jpeg,.png,.webp,.gif,image/*"}
                  label={form.contentType === "pdf" ? "Upload PDF file" : "Upload image file"}
                  storagePath={`notes/${form.contentType}`}
                  onUploaded={(url) => setForm(f => ({ ...f, content: url }))}
                />
              )}
            </div>
          )}

          {saveStatus === "success" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm mb-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {saveMsg}
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm mb-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveMsg}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!form.subject || !form.chapter || !form.title || !form.content) {
                  setSaveStatus("error"); setSaveMsg("Please fill in all required fields."); return;
                }
                setSaveStatus("idle");
                createNote.mutate(
                  { data: { ...form, content: form.content } },
                  {
                    onSuccess: () => {
                      setSaveStatus("success");
                      setSaveMsg(`Note "${form.title}" saved successfully!`);
                      inv();
                      setTimeout(() => reset(), 1800);
                    },
                    onError: (err: Error) => {
                      setSaveStatus("error");
                      setSaveMsg(err?.message || "Failed to save note. Please try again.");
                    },
                  }
                );
              }}
              disabled={createNote.isPending || !form.content}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {createNote.isPending ? "Saving…" : "Save Note"}
            </button>
            <button onClick={reset} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {isLoading
        ? <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : (Array.isArray(notes) ? notes : []).map(n => (
          <div key={n.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div>
              <p className="font-medium text-gray-900 text-sm">{n.title}</p>
              <p className="text-xs text-gray-500">Grade {n.grade} · {n.subject} · {n.chapter} · <span className="capitalize">{n.contentType}</span></p>
            </div>
            <button onClick={() => deleteNote.mutate({ id: n.id }, { onSuccess: inv })} className="p-1.5 text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ─── Badge Manager ─────────────────────────────────────────────────────────

interface CustomBadge { id: string; text: string; emoji: string; color: string; createdAt: string; }

const STUDY_TIERS = [
  { mins: 24000, emoji: "🏆", label: "Champion",   bg: "linear-gradient(135deg,#94a3b8,#e2e8f0,#94a3b8)" },
  { mins: 12000, emoji: "🌟", label: "Master",     bg: "linear-gradient(135deg,#d97706,#fcd34d,#d97706)" },
  { mins: 6000,  emoji: "👑", label: "Legend",     bg: "linear-gradient(135deg,#b45309,#fbbf24,#b45309)" },
  { mins: 4500,  emoji: "💎", label: "Scholar",    bg: "linear-gradient(135deg,#6d28d9,#a78bfa,#6d28d9)" },
  { mins: 3000,  emoji: "🔥", label: "Achiever",   bg: "linear-gradient(135deg,#c2410c,#fb923c,#c2410c)" },
  { mins: 1500,  emoji: "⚡", label: "Explorer",   bg: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)" },
  { mins: 600,   emoji: "🌱", label: "Beginner",   bg: "linear-gradient(135deg,#15803d,#4ade80,#15803d)" },
];

const STREAK_TIERS = [
  { days: 100, emoji: "🦁", label: "Elite",        bg: "linear-gradient(135deg,#1e1b4b,#4338ca,#1e1b4b)" },
  { days: 60,  emoji: "⭐", label: "Legendary",    bg: "linear-gradient(135deg,#92400e,#fcd34d,#92400e)" },
  { days: 30,  emoji: "🚀", label: "Unstoppable",  bg: "linear-gradient(135deg,#5b21b6,#c4b5fd,#5b21b6)" },
  { days: 15,  emoji: "💪", label: "Dedicated",    bg: "linear-gradient(135deg,#991b1b,#f87171,#991b1b)" },
  { days: 5,   emoji: "🎯", label: "Consistent",   bg: "linear-gradient(135deg,#164e63,#67e8f9,#164e63)" },
];

const EMOJI_OPTIONS = ["⭐","🔥","💎","👑","🌟","🚀","💪","🎯","🌱","⚡","🏆","🦁","✨","🎓","🌈","🎪","🏅","🥇","🛡️","🎉","🧠","🪄","🌸","🐉","☄️","🔮"];
const COLOR_PRESETS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316","#e11d48","#0ea5e9"];

function getUnlockedStudyBadges(mins: number) { return STUDY_TIERS.filter(t => mins >= t.mins); }
function getUnlockedStreakBadges(days: number) { return STREAK_TIERS.filter(t => days >= t.days); }
const fmtTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

function MicroBadge({ emoji, label, bg }: { emoji: string; label: string; bg: string }) {
  return (
    <span
      style={{ background: bg }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
    >
      {emoji} {label}
    </span>
  );
}

function CustomBadgePill({ badge, onRemove }: { badge: CustomBadge; onRemove: () => void }) {
  return (
    <span
      style={{ background: badge.color, boxShadow: `0 2px 10px ${badge.color}55` }}
      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-white text-[10px] font-bold"
    >
      {badge.emoji} {badge.text}
      <button onClick={onRemove} className="ml-0.5 opacity-70 hover:opacity-100 rounded-full">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function BadgeManager() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [badgeText, setBadgeText] = useState("");
  const [badgeEmoji, setBadgeEmoji] = useState("⭐");
  const [badgeColor, setBadgeColor] = useState("#6366f1");
  const [userBadges, setUserBadges] = useState<Record<string, CustomBadge[]>>({});
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list: ApiUser[] = await fetch("/api/users").then(r => r.json());
      list.sort((a, b) => (b.totalStudyTime ?? 0) - (a.totalStudyTime ?? 0));
      setUsers(list);
      // Load badges for all users
      const badgeSnaps = await Promise.all(
        list.map(u => getDoc(doc(db, "user_badges", u.uid)).catch(() => null))
      );
      const map: Record<string, CustomBadge[]> = {};
      badgeSnaps.forEach((snap, i) => {
        if (snap?.exists()) map[list[i].uid] = snap.data()?.badges ?? [];
        else map[list[i].uid] = [];
      });
      setUserBadges(map);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const addBadge = async (uid: string) => {
    if (!badgeText.trim()) return;
    setSaving(true);
    const newBadge: CustomBadge = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: badgeText.trim(),
      emoji: badgeEmoji,
      color: badgeColor,
      createdAt: new Date().toISOString(),
    };
    const existing = userBadges[uid] ?? [];
    const updated = [...existing, newBadge];
    try {
      await setDoc(doc(db, "user_badges", uid), { badges: updated });
      setUserBadges(prev => ({ ...prev, [uid]: updated }));
      setBadgeText("");
      setOpenUid(null);
    } catch (e) { console.error("Badge save failed:", e); }
    finally { setSaving(false); }
  };

  const removeBadge = async (uid: string, badgeId: string) => {
    const updated = (userBadges[uid] ?? []).filter(b => b.id !== badgeId);
    try {
      await setDoc(doc(db, "user_badges", uid), { badges: updated });
      setUserBadges(prev => ({ ...prev, [uid]: updated }));
    } catch (e) { console.error("Badge remove failed:", e); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Badge Manager</h2>
          <p className="text-sm text-gray-500 mt-0.5">Assign custom badges · Auto badges earned by study time &amp; streak</p>
        </div>
        <button onClick={loadUsers} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Refresh</button>
      </div>

      {/* Badge tier legend */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Auto Badge Tiers</p>
        <div className="flex flex-wrap gap-3 mb-3">
          <p className="text-xs text-gray-500 w-full font-medium">📚 Study Time:</p>
          {STUDY_TIERS.map(t => (
            <span key={t.label} style={{ background: t.bg }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-bold">
              {t.emoji} {t.label} <span className="opacity-70">({fmtTime(t.mins)}+)</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <p className="text-xs text-gray-500 w-full font-medium">🔥 Streak:</p>
          {STREAK_TIERS.map(t => (
            <span key={t.label} style={{ background: t.bg }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-bold">
              {t.emoji} {t.label} <span className="opacity-70">({t.days}+ days)</span>
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users by name or email…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{search ? "No users match your search." : "No users yet."}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const studyBadges = getUnlockedStudyBadges(u.totalStudyTime ?? 0);
            const streakBadges = getUnlockedStreakBadges(u.streak ?? 0);
            const custom = userBadges[u.uid] ?? [];
            const isOpen = openUid === u.uid;

            return (
              <div key={u.uid} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* User row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {(u.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{u.name || "(no name)"}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email} · Grade {u.grade}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>⏱ {fmtTime(u.totalStudyTime ?? 0)}</span>
                      <span>🔥 {u.streak ?? 0} days</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpenUid(isOpen ? null : u.uid); setBadgeText(""); setBadgeEmoji("⭐"); setBadgeColor("#6366f1"); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded-xl hover:bg-purple-100 transition-all flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Badge
                  </button>
                </div>

                {/* Badges row */}
                {(studyBadges.length > 0 || streakBadges.length > 0 || custom.length > 0) && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {studyBadges.map(b => <MicroBadge key={b.label} emoji={b.emoji} label={b.label} bg={b.bg} />)}
                    {streakBadges.map(b => <MicroBadge key={b.label} emoji={b.emoji} label={b.label} bg={b.bg} />)}
                    {custom.map(b => <CustomBadgePill key={b.id} badge={b} onRemove={() => removeBadge(u.uid, b.id)} />)}
                  </div>
                )}

                {/* Add badge form */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-purple-50/60 px-4 py-4 space-y-3">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">New Custom Badge</p>

                    {/* Badge text */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Badge Text</label>
                      <input
                        value={badgeText}
                        onChange={e => setBadgeText(e.target.value)}
                        placeholder="e.g. Top Performer, Most Dedicated…"
                        maxLength={30}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>

                    {/* Emoji picker */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Emoji</label>
                      <div className="flex flex-wrap gap-1.5">
                        {EMOJI_OPTIONS.map(e => (
                          <button
                            key={e}
                            onClick={() => setBadgeEmoji(e)}
                            className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${badgeEmoji === e ? "bg-purple-200 ring-2 ring-purple-500 scale-110" : "bg-white border border-gray-200 hover:bg-purple-50"}`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color picker */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Badge Color</label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {COLOR_PRESETS.map(c => (
                          <button
                            key={c}
                            onClick={() => setBadgeColor(c)}
                            style={{ background: c }}
                            className={`w-7 h-7 rounded-full transition-all ${badgeColor === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`}
                          />
                        ))}
                        <div className="flex items-center gap-2 ml-1">
                          <input
                            type="color"
                            value={badgeColor}
                            onChange={e => setBadgeColor(e.target.value)}
                            className="w-7 h-7 rounded-full cursor-pointer border border-gray-200"
                            title="Custom color"
                          />
                          <span className="text-xs text-gray-400">Custom</span>
                        </div>
                      </div>
                    </div>

                    {/* Preview + save */}
                    <div className="flex items-center gap-3 pt-1">
                      {badgeText && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Preview:</span>
                          <span
                            style={{ background: badgeColor, boxShadow: `0 4px 16px ${badgeColor}66` }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold"
                          >
                            {badgeEmoji} {badgeText}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => addBadge(u.uid)}
                        disabled={!badgeText.trim() || saving}
                        className="ml-auto px-4 py-2 bg-purple-500 text-white text-xs font-semibold rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-all"
                      >
                        {saving ? "Saving…" : "Assign Badge"}
                      </button>
                      <button onClick={() => setOpenUid(null)} className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-xl hover:bg-gray-200">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Manage PYQs ───────────────────────────────────────────────────────────

function ManagePyqs() {
  const qc = useQueryClient();
  const { data: pyqs, isLoading } = useListPyqs({}, { query: { queryKey: getListPyqsQueryKey({}) } });
  const createPyq = useCreatePyq();
  const deletePyq = useDeletePyq();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ grade: 10, subject: "", title: "", year: 2024, pdfUrl: "", fileType: "pdf" as "pdf" | "image" });
  const inv = () => qc.invalidateQueries({ queryKey: getListPyqsQueryKey({}) });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage PYQs</h2>
        <button onClick={() => setShow(s => !s)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Add PYQ
        </button>
      </div>

      {show && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {[9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. Mathematics" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. Bagmati Pradesh 2080" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">File (PDF or Image)</label>
            {form.pdfUrl ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                {form.fileType === "image" ? <Image className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-green-600" />}
                <p className="text-sm text-green-700 flex-1">
                  {form.fileType === "image" ? "Image" : "PDF"} uploaded ✓
                </p>
                <button onClick={() => setForm(f => ({ ...f, pdfUrl: "", fileType: "pdf" }))} className="text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <FileUpload
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                label="Upload PDF or image"
                storagePath="pyqs"
                onUploaded={(url, type) => setForm(f => ({ ...f, pdfUrl: url, fileType: type }))}
              />
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!form.subject || !form.title || !form.pdfUrl) return;
                createPyq.mutate({
                  data: { grade: form.grade, subject: form.subject, title: form.title, year: form.year, pdfUrl: form.pdfUrl, fileType: form.fileType }
                }, { onSuccess: () => { setShow(false); setForm({ grade: 10, subject: "", title: "", year: 2024, pdfUrl: "", fileType: "pdf" }); inv(); } });
              }}
              disabled={createPyq.isPending || !form.pdfUrl}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
            >
              {createPyq.isPending ? "Saving…" : "Save PYQ"}
            </button>
            <button onClick={() => setShow(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {isLoading
        ? <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : (Array.isArray(pyqs) ? pyqs : []).map(p => (
          <div key={p.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div>
              <p className="font-medium text-gray-900 text-sm">{p.title}</p>
              <p className="text-xs text-gray-500">Grade {p.grade} · {p.subject} · {p.year} · {(p as { fileType?: string | null }).fileType === "image" ? "Image" : "PDF"}</p>
            </div>
            <button onClick={() => deletePyq.mutate({ id: p.id }, { onSuccess: inv })} className="p-1.5 text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ─── Announcements ─────────────────────────────────────────────────────────

interface Announcement { id: string; title: string; body: string; createdAt: string }

function ManageAnnouncements() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const load = async () => {
    try {
      const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    } catch (e) { console.error(e); }
    finally { setLoadingList(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "announcements"), { title: title.trim(), body: body.trim(), createdAt: new Date().toISOString() });
      setTitle(""); setBody("");
      await load();
    } finally { setSaving(false); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Announcements</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Post New Announcement</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your announcement…" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" required />
        </div>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">
          <Megaphone className="w-4 h-4" /> {saving ? "Posting…" : "Post Announcement"}
        </button>
      </form>

      {loadingList
        ? <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : list.length === 0
        ? <p className="text-center text-gray-400 py-8">No announcements yet.</p>
        : list.map(a => (
          <div key={a.id} className="flex items-start justify-between bg-white rounded-xl border border-gray-100 px-4 py-4 mb-2">
            <div className="flex-1 min-w-0 mr-3">
              <p className="font-semibold text-gray-900 text-sm mb-1">{a.title}</p>
              <p className="text-gray-600 text-sm">{a.body}</p>
              <p className="text-gray-400 text-xs mt-1">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
            <button onClick={async () => { await deleteDoc(doc(db, "announcements", a.id)); setList(l => l.filter(x => x.id !== a.id)); }} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ─── Manage Users (Backend API / PostgreSQL) ───────────────────────────────

function ManageUsers() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const loadUsers = () => {
    setLoading(true);
    fetch("/api/users")
      .then(r => r.json())
      .then((list: ApiUser[]) => {
        list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setUsers(list);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleRoleChange = async (uid: string, role: string) => {
    setUpdatingUid(uid);
    try {
      await fetch(`/api/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
    } catch (e) { console.error("[Admin] Role update failed:", e); }
    finally { setUpdatingUid(null); }
  };

  const handleDelete = async (uid: string) => {
    if (!window.confirm("Delete this user's profile? They can still log in but will need to redo setup.")) return;
    try {
      await fetch(`/api/users/${uid}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (e) { console.error("[Admin] Delete failed:", e); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} registered users</p>
        </div>
        <button onClick={loadUsers} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No users found. Users appear here after completing setup.</p>
      ) : (
        users.map(u => (
          <div key={u.uid} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-semibold flex-shrink-0">
                {(u.name || u.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{u.name || "(no name)"}</p>
                <p className="text-xs text-gray-500 truncate">{u.email} · Grade {u.grade}</p>
                <p className="text-xs text-gray-400">Joined {new Date(u.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={u.role || "user"}
                disabled={updatingUid === u.uid}
                onChange={e => handleRoleChange(u.uid, e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white disabled:opacity-50"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={() => handleDelete(u.uid)} className="p-1.5 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}


// ─── SEO Panel ─────────────────────────────────────────────────────────────

interface SeoMeta { seoTitle: string; description: string; keywords: string; slug: string; noIndex: boolean }
const emptySeo = (): SeoMeta => ({ seoTitle: "", description: "", keywords: "", slug: "", noIndex: false });

type SeoKind = "note" | "pyq";
interface SeoEditTarget { id: number; defaultTitle: string; kind: SeoKind }

function SeoEditor({ target, onClose }: { target: SeoEditTarget; onClose: () => void }) {
  const docId = `${target.kind}_${target.id}`;
  const [form, setForm] = useState<SeoMeta>(emptySeo());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "seo_meta", docId));
        if (snap.exists()) setForm(snap.data() as SeoMeta);
        else setForm({ ...emptySeo(), seoTitle: target.defaultTitle });
      } catch (e) {
        console.error("SEO load failed:", e);
        setForm({ ...emptySeo(), seoTitle: target.defaultTitle });
      } finally { setLoading(false); }
    };
    load();
  }, [docId, target.defaultTitle]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "seo_meta", docId), { ...form, updatedAt: new Date().toISOString() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("SEO save failed:", err);
      alert("Save failed — check console.");
    } finally { setSaving(false); }
  };

  const f = (k: keyof SeoMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{target.kind.toUpperCase()} SEO</p>
            <h3 className="text-base font-bold text-gray-900 truncate">{target.defaultTitle}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-all">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">SEO Title</label>
              <input value={form.seoTitle} onChange={f("seoTitle")} placeholder={target.defaultTitle}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <p className="text-xs text-gray-400 mt-1">{form.seoTitle.length}/60 chars recommended</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Meta Description</label>
              <textarea value={form.description} onChange={f("description")} rows={3} placeholder="Brief description for search engines…"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400" />
              <p className="text-xs text-gray-400 mt-1">{form.description.length}/160 chars recommended</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Keywords</label>
              <input value={form.keywords} onChange={f("keywords")} placeholder="keyword1, keyword2, keyword3"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">URL Slug</label>
              <input value={form.slug} onChange={f("slug")} placeholder="auto-generated-from-title"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(p => ({ ...p, noIndex: !p.noIndex }))}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${form.noIndex ? "bg-red-500 border-red-500" : "border-gray-300 hover:border-red-400"}`}
              >
                {form.noIndex && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">No Index</p>
                <p className="text-xs text-gray-400">Exclude this page from search engines</p>
              </div>
            </label>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-all text-sm">
                {saving ? "Saving…" : saved ? "✓ Saved!" : "Save SEO"}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SeoPanel() {
  const [editing, setEditing] = useState<SeoEditTarget | null>(null);
  const [search, setSearch] = useState("");
  const [noteItems, setNoteItems] = useState<Array<{ id: number; title: string; kind: SeoKind; url: string }>>([]);
  const [pyqItems,  setPyqItems]  = useState<Array<{ id: number; title: string; kind: SeoKind; url: string }>>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [filterKind, setFilterKind] = useState<"all" | "note" | "pyq">("all");
  const [filterGrade, setFilterGrade] = useState<"all" | number>("all");
  const baseUrl = "https://studenthub.np";

  // Fetch ALL notes and PYQs across all grades
  useEffect(() => {
    setLoadingItems(true);
    Promise.all([
      Promise.all([9, 10, 11, 12].map(g =>
        fetch(`/api/notes?grade=${g}`).then(r => r.json()).catch(() => [])
      )),
      Promise.all([9, 10, 11, 12].map(g =>
        fetch(`/api/pyqs?grade=${g}`).then(r => r.json()).catch(() => [])
      )),
    ]).then(([notesPerGrade, pyqsPerGrade]) => {
      const allNotes = notesPerGrade.flat();
      const allPyqs  = pyqsPerGrade.flat();
      setNoteItems(allNotes.map((n: any) => ({ id: n.id, title: n.title, grade: n.grade, subject: n.subject, kind: "note" as SeoKind, url: `${baseUrl}/notes/${n.id}` })));
      setPyqItems(allPyqs.map((p: any)  => ({ id: p.id, title: p.title, grade: p.grade, subject: p.subject, kind: "pyq"  as SeoKind, url: `${baseUrl}/pyq/${p.id}`   })));
    }).finally(() => setLoadingItems(false));
  }, []);

  const staticUrls = [
    { url: `${baseUrl}/`,        label: "Homepage",   kind: "Static" },
    { url: `${baseUrl}/notes`,   label: "Notes List", kind: "Static" },
    { url: `${baseUrl}/pyqs`,    label: "PYQs List",  kind: "Static" },
    { url: `${baseUrl}/about`,   label: "About",      kind: "Static" },
    { url: `${baseUrl}/contact`, label: "Contact",    kind: "Static" },
  ];

  const allItems = [
    ...noteItems.map(i => ({ ...i, kindLabel: "Note" })),
    ...pyqItems.map(i => ({  ...i, kindLabel: "PYQ"  })),
  ].filter(i => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterKind !== "all" && i.kind !== filterKind) return false;
    if (filterGrade !== "all" && (i as any).grade !== filterGrade) return false;
    return true;
  });

  const generateSitemap = () => {
    const all = [...staticUrls, ...noteItems.map(n => ({ url: n.url, label: n.title, kind: "Note" })), ...pyqItems.map(p => ({ url: p.url, label: p.title, kind: "PYQ" }))];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all.map(u => `  <url>\n    <loc>${u.url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u.kind === "Static" ? "0.9" : "0.7"}</priority>\n  </url>`).join("\n")}\n</urlset>`;
    const blob = new Blob([xml], { type: "application/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sitemap.xml";
    link.click();
  };

  return (
    <div>
      {editing && <SeoEditor target={editing} onClose={() => setEditing(null)} />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">SEO Panel</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Edit per-page SEO metadata stored in Firestore ·
            {" "}<span className="text-purple-600 font-medium">{allItems.length} pages indexable</span>
          </p>
        </div>
        <button onClick={generateSitemap}
          className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-all flex items-center gap-2">
          ⬇ Download sitemap.xml
        </button>
      </div>

      {/* SEO Quick Tips */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-6">
        <p className="text-xs font-semibold text-purple-700 mb-2">📌 SEO Tips</p>
        <ul className="text-xs text-purple-600 space-y-1">
          <li>• <strong>SEO Title:</strong> Keep under 60 characters. Include keywords like "Grade 10 Science Notes Nepal".</li>
          <li>• <strong>Meta Description:</strong> 120–160 characters. Describe what the page contains clearly.</li>
          <li>• <strong>Keywords:</strong> Comma-separated. E.g. "SEE notes, grade 10 science, NEB notes Nepal"</li>
          <li>• <strong>No Index:</strong> Check this to hide low-quality or duplicate pages from Google.</li>
          <li>• Download sitemap.xml and submit it to Google Search Console after adding content.</li>
        </ul>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Static Pages", count: staticUrls.length,  color: "bg-blue-50 text-blue-600"    },
          { label: "Note Pages",   count: noteItems.length,   color: "bg-green-50 text-green-600"   },
          { label: "PYQ Pages",    count: pyqItems.length,    color: "bg-orange-50 text-orange-600" },
        ].map(({ label, count, color }) => (
          <div key={label} className={`${color.split(" ")[0]} rounded-2xl p-4 border border-gray-100`}>
            <p className={`text-2xl font-bold ${color.split(" ")[1]}`}>{count}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Notes + PYQs with Edit SEO button */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-700 mr-auto">Notes &amp; PYQs SEO</p>

          {/* Kind filter */}
          {(["all", "note", "pyq"] as const).map(k => (
            <button key={k} onClick={() => setFilterKind(k)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${filterKind === k ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {k === "all" ? "All" : k === "note" ? "Notes" : "PYQs"}
            </button>
          ))}

          {/* Grade filter */}
          {(["all", 9, 10, 11, 12] as const).map(g => (
            <button key={g} onClick={() => setFilterGrade(g)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${filterGrade === g ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {g === "all" ? "All grades" : `G${g}`}
            </button>
          ))}

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title…"
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 w-36" />
        </div>

        {loadingItems ? (
          <div className="p-8 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : allItems.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            {noteItems.length === 0 ? "No notes or PYQs found. Add some first." : "No results match your filters."}
          </p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {allItems.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-all">
                <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.kindLabel === "Note" ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                    {item.kindLabel}
                  </span>
                  {(item as any).grade && (
                    <span className="text-[9px] text-gray-400">G{(item as any).grade}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{item.title}</p>
                  {(item as any).subject && <p className="text-xs text-gray-400 truncate">{(item as any).subject}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-600 transition-colors">Open ↗</a>
                  <button
                    onClick={() => setEditing({ id: item.id, defaultTitle: item.title, kind: item.kind })}
                    className="px-3 py-1.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-all"
                  >
                    Edit SEO
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Static pages list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Static Pages</p>
          <span className="text-xs text-gray-400">These use Helmet meta tags in code</span>
        </div>
        <div className="divide-y divide-gray-50">
          {staticUrls.map((u) => (
            <div key={u.url} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 bg-blue-50 text-blue-600">Static</span>
              <p className="text-sm text-gray-700 truncate flex-1">{u.label}</p>
              <a href={u.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex-shrink-0">Open ↗</a>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        SEO data saved to Firestore · Changes apply immediately on the live site
      </p>
    </div>
  );
}

// ─── Admin Shell ───────────────────────────────────────────────────────────

export default function Admin() {
  const { profile, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>("dashboard");

  const handleSignOut = () => {
    sessionStorage.removeItem(ADMIN_SESSION);
    signOut();
    setLocation("/admin");
  };

  const navItems: { key: Section; icon: typeof LayoutDashboard; label: string }[] = [
    { key: "dashboard",     icon: LayoutDashboard, label: "Dashboard"     },
    { key: "notes",         icon: BookOpen,        label: "Manage Notes"  },
    { key: "pyqs",          icon: FileText,        label: "Manage PYQs"   },
    { key: "announcements", icon: Megaphone,       label: "Announcements" },
    { key: "users",         icon: Users,           label: "Manage Users"  },
    { key: "reports",       icon: Award,           label: "Badges"        },
    { key: "seo",           icon: Shield,          label: "SEO Panel"     },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm flex-shrink-0">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900">Admin Panel</span>
          </div>
          {profile?.role === "admin" && (
            <p className="text-xs text-purple-500 mt-1">Firebase admin: {profile.name}</p>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                section === key ? "bg-purple-50 text-purple-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-all mb-1 w-full"
          >
            ← Back to App
          </Link>
          <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all w-full">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {section === "dashboard"     && <AdminOverview />}
        {section === "notes"         && <ManageNotes />}
        {section === "pyqs"          && <ManagePyqs />}
        {section === "announcements" && <ManageAnnouncements />}
        {section === "users"         && <ManageUsers />}
        {section === "reports"       && <BadgeManager />}
        {section === "seo"           && <SeoPanel />}
      </main>
    </div>
  );
}
