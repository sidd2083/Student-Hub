import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetUserStats, useListUsers, useUpdateUser, useDeleteUser,
  useListNotes, useCreateNote, useDeleteNote,
  useListMcqs, useCreateMcq, useDeleteMcq,
  useListPyqs, useCreatePyq, useDeletePyq,
  useListScores, useResetScores,
  getListUsersQueryKey, getListNotesQueryKey, getListMcqsQueryKey,
  getListPyqsQueryKey, getListScoresQueryKey, getGetUserStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, BookOpen, Brain, FileText, Users, Trophy,
  Shield, Plus, Trash2, LogOut, Megaphone,
} from "lucide-react";
import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const ADMIN_SESSION = "admin_session_v1";
type Section = "dashboard" | "notes" | "mcqs" | "pyqs" | "announcements" | "users" | "leaderboard";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function AdminOverview() {
  const { data: stats } = useGetUserStats({ query: { queryKey: getGetUserStatsQueryKey() } });
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Users" value={stats?.total || 0} />
        <StatCard label="Admins" value={stats?.admins || 0} />
        <StatCard label="New Today" value={stats?.newToday || 0} />
        <StatCard label="Grades" value={Object.keys(stats?.byGrade || {}).length} />
      </div>
      {stats?.byGrade && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-medium text-gray-700 mb-4">Users by Grade</h3>
          <div className="flex gap-4">
            {Object.entries(stats.byGrade).map(([g, c]) => (
              <div key={g} className="flex-1 text-center p-3 bg-blue-50 rounded-xl">
                <p className="text-2xl font-bold text-blue-600">{c as number}</p>
                <p className="text-xs text-gray-500 mt-1">Grade {g}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManageNotes() {
  const qc = useQueryClient();
  const { data: notes, isLoading } = useListNotes({}, { query: { queryKey: getListNotesQueryKey({}) } });
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ grade: 10, subject: "", chapter: "", title: "", contentType: "text" as "text"|"pdf"|"image", content: "" });
  const inv = () => qc.invalidateQueries({ queryKey: getListNotesQueryKey({}) });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage Notes</h2>
        <button onClick={() => setShow(s => !s)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Add Note
        </button>
      </div>
      {show && (
        <form onSubmit={e => { e.preventDefault(); createNote.mutate({ data: form }, { onSuccess: () => { setShow(false); setForm({ grade: 10, subject: "", chapter: "", title: "", contentType: "text", content: "" }); inv(); } }); }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {[9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Content Type</label>
              <select value={form.contentType} onChange={e => setForm(f => ({ ...f, contentType: e.target.value as "text"|"pdf"|"image" }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="text">Text</option><option value="pdf">PDF</option><option value="image">Image</option>
              </select></div>
          </div>
          {(["subject","chapter","title"] as const).map(f => (
            <div key={f}><label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{f}</label>
              <input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required /></div>
          ))}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" required /></div>
          <div className="flex gap-2">
            <button type="submit" disabled={createNote.isPending} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setShow(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}
      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : (notes||[]).map(n => (
          <div key={n.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div><p className="font-medium text-gray-900 text-sm">{n.title}</p><p className="text-xs text-gray-500">Grade {n.grade} · {n.subject} · {n.chapter}</p></div>
            <button onClick={() => deleteNote.mutate({ id: n.id }, { onSuccess: inv })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
    </div>
  );
}

function ManageMcqs() {
  const qc = useQueryClient();
  const { data: mcqs, isLoading } = useListMcqs({}, { query: { queryKey: getListMcqsQueryKey({}) } });
  const createMcq = useCreateMcq();
  const deleteMcq = useDeleteMcq();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ grade: 10, subject: "", chapter: "", question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" as "A"|"B"|"C"|"D", difficulty: "medium" as "easy"|"medium"|"hard" });
  const inv = () => qc.invalidateQueries({ queryKey: getListMcqsQueryKey({}) });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage MCQs</h2>
        <button onClick={() => setShow(s => !s)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Add MCQ
        </button>
      </div>
      {show && (
        <form onSubmit={e => { e.preventDefault(); createMcq.mutate({ data: form }, { onSuccess: () => { setShow(false); inv(); } }); }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {[9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Correct Answer</label>
              <select value={form.correctAnswer} onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value as "A"|"B"|"C"|"D" }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {["A","B","C","D"].map(o => <option key={o}>{o}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as "easy"|"medium"|"hard" }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select></div>
          </div>
          {(["subject","chapter","question","optionA","optionB","optionC","optionD"] as const).map(f => (
            <div key={f}><label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{f.replace(/([A-Z])/g," $1")}</label>
              <input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required /></div>
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={createMcq.isPending} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setShow(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}
      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : (mcqs||[]).map(m => (
          <div key={m.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div><p className="font-medium text-gray-900 text-sm truncate max-w-md">{m.question}</p><p className="text-xs text-gray-500">Grade {m.grade} · {m.subject} · {m.difficulty}</p></div>
            <button onClick={() => deleteMcq.mutate({ id: m.id }, { onSuccess: inv })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
    </div>
  );
}

function ManagePyqs() {
  const qc = useQueryClient();
  const { data: pyqs, isLoading } = useListPyqs({}, { query: { queryKey: getListPyqsQueryKey({}) } });
  const createPyq = useCreatePyq();
  const deletePyq = useDeletePyq();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ grade: 10, subject: "", title: "", year: 2024, pdfUrl: "" });
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
        <form onSubmit={e => { e.preventDefault(); createPyq.mutate({ data: form }, { onSuccess: () => { setShow(false); inv(); } }); }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {[9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required /></div>
          </div>
          {(["subject","title","pdfUrl"] as const).map(f => (
            <div key={f}><label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{f === "pdfUrl" ? "PDF URL" : f}</label>
              <input value={form[f] as string} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required /></div>
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={createPyq.isPending} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setShow(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </form>
      )}
      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : (pyqs||[]).map(p => (
          <div key={p.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div><p className="font-medium text-gray-900 text-sm">{p.title}</p><p className="text-xs text-gray-500">Grade {p.grade} · {p.subject} · {p.year}</p></div>
            <button onClick={() => deletePyq.mutate({ id: p.id }, { onSuccess: inv })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
    </div>
  );
}

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
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your announcement…" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" required /></div>
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">
          <Megaphone className="w-4 h-4" /> {saving ? "Posting…" : "Post Announcement"}
        </button>
      </form>
      {loadingList ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : list.length === 0 ? <p className="text-center text-gray-400 py-8">No announcements yet.</p>
        : list.map(a => (
          <div key={a.id} className="flex items-start justify-between bg-white rounded-xl border border-gray-100 px-4 py-4 mb-2">
            <div className="flex-1 min-w-0 mr-3">
              <p className="font-semibold text-gray-900 text-sm mb-1">{a.title}</p>
              <p className="text-gray-600 text-sm">{a.body}</p>
              <p className="text-gray-400 text-xs mt-1">{new Date(a.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}</p>
            </div>
            <button onClick={async () => { await deleteDoc(doc(db,"announcements",a.id)); setList(l => l.filter(x => x.id !== a.id)); }} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
    </div>
  );
}

function ManageUsers() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const inv = () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() });

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Manage Users</h2>
      {isLoading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : (users||[]).map(u => (
          <div key={u.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-semibold">{u.name.charAt(0).toUpperCase()}</div>
              <div><p className="font-medium text-gray-900 text-sm">{u.name}</p><p className="text-xs text-gray-500">{u.email} · Grade {u.grade}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <select value={u.role} onChange={e => updateUser.mutate({ uid: u.uid, data: { role: e.target.value as "user"|"admin" } }, { onSuccess: inv })} className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white">
                <option value="user">User</option><option value="admin">Admin</option>
              </select>
              <button onClick={() => deleteUser.mutate({ uid: u.uid }, { onSuccess: inv })} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
    </div>
  );
}

function LeaderboardControl() {
  const qc = useQueryClient();
  const { data: scores } = useListScores({ period: "daily" }, { query: { queryKey: getListScoresQueryKey({ period: "daily" }) } });
  const resetScores = useResetScores();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Leaderboard Control</h2>
        <button onClick={() => resetScores.mutate(undefined, { onSuccess: () => qc.invalidateQueries({ queryKey: getListScoresQueryKey({ period: "daily" }) }) })} disabled={resetScores.isPending}
          className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600 disabled:opacity-50">
          Reset Daily Scores
        </button>
      </div>
      <div className="space-y-2">
        {(scores||[]).map((s,i) => (
          <div key={s.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold text-gray-500">#{i+1}</span>
              <div><p className="font-medium text-gray-900 text-sm">{s.userName}</p><p className="text-xs text-gray-500">Grade {s.grade} · {s.subject}</p></div>
            </div>
            <p className="font-bold text-gray-900">{s.score}/{s.totalQuestions}</p>
          </div>
        ))}
        {(scores||[]).length === 0 && <p className="text-center text-gray-400 py-8">No scores for today.</p>}
      </div>
    </div>
  );
}

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
    { key: "mcqs",          icon: Brain,           label: "Manage MCQs"   },
    { key: "pyqs",          icon: FileText,        label: "Manage PYQs"   },
    { key: "announcements", icon: Megaphone,       label: "Announcements" },
    { key: "users",         icon: Users,           label: "Manage Users"  },
    { key: "leaderboard",   icon: Trophy,          label: "Leaderboard"   },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm">
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
            <button key={key} onClick={() => setSection(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                section === key ? "bg-purple-50 text-purple-600" : "text-gray-600 hover:bg-gray-50"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <Link href="/dashboard">
            <a className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-all mb-1 w-full">
              ← Back to App
            </a>
          </Link>
          <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all w-full">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {section === "dashboard"     && <AdminOverview />}
        {section === "notes"         && <ManageNotes />}
        {section === "mcqs"          && <ManageMcqs />}
        {section === "pyqs"          && <ManagePyqs />}
        {section === "announcements" && <ManageAnnouncements />}
        {section === "users"         && <ManageUsers />}
        {section === "leaderboard"   && <LeaderboardControl />}
      </main>
    </div>
  );
}
