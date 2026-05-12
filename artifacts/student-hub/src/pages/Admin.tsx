import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  collection, getDocs, doc, query, where, orderBy,
  setDoc, getDoc, addDoc, deleteDoc, updateDoc,
} from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import {
  ref, uploadBytesResumable, getDownloadURL,
} from "firebase/storage";
import { db, storage, auth, googleProvider } from "@/lib/firebase";
import {
  LayoutDashboard, BookOpen, FileText, Users,
  Shield, Plus, Trash2, LogOut, Megaphone, Upload, X, Image,
  CheckCircle, AlertCircle, Award, Search, Type,
} from "lucide-react";

const ADMIN_SESSION = "admin_session_v1";
type Section = "dashboard" | "notes" | "pyqs" | "announcements" | "users" | "reports" | "seo";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FireUser {
  uid: string;
  name: string;
  email: string;
  grade: number;
  role: string;
  createdAt: string;
  streak: number;
  totalStudyTime: number;
  todayStudyTime: number;
  badges?: CustomBadge[];
}

interface FireNote {
  id: string;
  grade: number;
  subject: string;
  chapter: string;
  title: string;
  contentType: "text" | "pdf" | "image";
  content: string;
  createdAt: string;
}

interface FirePyq {
  id: string;
  grade: number;
  subject: string;
  title: string;
  year: number;
  pdfUrl: string;
  fileType: "pdf" | "image" | "rich";
  contentType?: "file" | "rich";
  content?: string;
  createdAt: string;
}

interface FireAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface CustomBadge { id: string; text: string; emoji: string; color: string; createdAt: string }

// ─── File Upload Component ───────────────────────────────────────────────────

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

  const upload = async (file: File) => {
    setError("");
    const isImage = file.type.startsWith("image/");
    const isPdf   = file.type === "application/pdf";
    if (!isImage && !isPdf) { setError("Please upload a PDF or image file."); return; }

    if (!auth.currentUser) {
      try { await signInWithPopup(auth, googleProvider); }
      catch { setError("Google sign-in required to upload files. Please sign in with your Google account."); return; }
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
        onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) upload(file); }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all select-none ${
          dragging ? "border-blue-400 bg-blue-50" :
          disabled ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60" :
          "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
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
      <input ref={inputRef} type="file" accept={accept} className="hidden" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
}

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg ?? undefined);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const toolbarBtn = (label: string, cmd: string, arg?: string, title?: string) => (
    <button
      type="button"
      title={title ?? label}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd, arg); }}
      className="px-2 py-1 text-xs font-medium rounded hover:bg-gray-200 transition-all text-gray-700"
    >
      {label}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
      <div className="flex flex-wrap gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        {toolbarBtn("H1", "formatBlock", "<h1>", "Heading 1")}
        {toolbarBtn("H2", "formatBlock", "<h2>", "Heading 2")}
        {toolbarBtn("H3", "formatBlock", "<h3>", "Heading 3")}
        <span className="w-px bg-gray-300 mx-1 self-stretch" />
        {toolbarBtn("B", "bold", undefined, "Bold")}
        {toolbarBtn("I", "italic", undefined, "Italic")}
        {toolbarBtn("U", "underline", undefined, "Underline")}
        <span className="w-px bg-gray-300 mx-1 self-stretch" />
        {toolbarBtn("• List", "insertUnorderedList", undefined, "Bullet list")}
        {toolbarBtn("1. List", "insertOrderedList", undefined, "Numbered list")}
        <span className="w-px bg-gray-300 mx-1 self-stretch" />
        {toolbarBtn("P", "formatBlock", "<p>", "Paragraph")}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; if (editorRef.current) onChange(editorRef.current.innerHTML); }}
        onInput={() => { if (!isComposing.current && editorRef.current) onChange(editorRef.current.innerHTML); }}
        className="min-h-[160px] px-3 py-3 text-sm text-gray-800 focus:outline-none leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-1.5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_li]:mb-0.5 [&_p]:mb-2"
        data-placeholder="Write note content here…"
        style={{ caretColor: "#3b82f6" }}
      />
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ─── Admin Overview ──────────────────────────────────────────────────────────

function AdminOverview() {
  const [users, setUsers] = useState<FireUser[]>([]);
  const [noteCount, setNoteCount] = useState(0);
  const [pyqCount, setPyqCount] = useState(0);

  useEffect(() => {
    getDocs(collection(db, "users")).then(s => {
      setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as FireUser)));
    }).catch(console.error);
    getDocs(collection(db, "notes")).then(s => setNoteCount(s.size)).catch(console.error);
    getDocs(collection(db, "pyqs")).then(s => setPyqCount(s.size)).catch(console.error);
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
        <StatCard label="Notes in DB"  value={noteCount}    />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="PYQs in DB"      value={pyqCount} />
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

// ─── Manage Notes ────────────────────────────────────────────────────────────

function ManageNotes() {
  const [notes, setNotes] = useState<FireNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm] = useState({
    grade: 10, subject: "", chapter: "", title: "",
    contentType: "text" as "text" | "pdf" | "image",
    content: "",
  });

  const loadNotes = useCallback(() => {
    setLoading(true);
    getDocs(query(collection(db, "notes"), orderBy("createdAt", "desc")))
      .then(s => setNotes(s.docs.map(d => ({ id: d.id, ...d.data() } as FireNote))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const reset = () => {
    setShow(false);
    setForm({ grade: 10, subject: "", chapter: "", title: "", contentType: "text", content: "" });
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    if (!form.subject || !form.chapter || !form.title || !form.content) {
      setSaveStatus("error"); setSaveMsg("Please fill in all required fields."); return;
    }
    setSaving(true); setSaveStatus("idle");
    try {
      await addDoc(collection(db, "notes"), { ...form, createdAt: new Date().toISOString() });
      setSaveStatus("success"); setSaveMsg(`Note "${form.title}" saved successfully!`);
      loadNotes();
      setTimeout(() => reset(), 1800);
    } catch (err: any) {
      setSaveStatus("error"); setSaveMsg(err?.message || "Failed to save note.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notes", id));
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e) { console.error("[Admin] Delete note failed:", e); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage Notes</h2>
        <button onClick={() => setShow(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Add Note
        </button>
      </div>

      {show && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {[9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Content Type</label>
              <select value={form.contentType}
                onChange={e => setForm(f => ({ ...f, contentType: e.target.value as "text" | "pdf" | "image", content: "" }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="text">Text</option>
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
              </select>
            </div>
          </div>
          {(["subject", "chapter", "title"] as const).map(f => (
            <div key={f}>
              <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{f}</label>
              <input value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
            </div>
          ))}
          {form.contentType === "text" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
              <RichTextEditor value={form.content} onChange={v => setForm(f => ({ ...f, content: v }))} />
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
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {saveMsg}
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveMsg}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.content}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">
              {saving ? "Saving…" : "Save Note"}
            </button>
            <button onClick={reset} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading
        ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : notes.map(n => (
          <div key={n.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div>
              <p className="font-medium text-gray-900 text-sm">{n.title}</p>
              <p className="text-xs text-gray-500">Grade {n.grade} · {n.subject} · {n.chapter} · <span className="capitalize">{n.contentType}</span></p>
            </div>
            <button onClick={() => handleDelete(n.id)} className="p-1.5 text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ─── Manage PYQs ─────────────────────────────────────────────────────────────

function ManagePyqs() {
  const [pyqs, setPyqs] = useState<FirePyq[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const [imgUploading, setImgUploading] = useState(false);
  const richEditorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [form, setForm] = useState({
    grade: 10,
    subject: "",
    title: "",
    year: new Date().getFullYear(),
    pdfUrl: "",
    fileType: "pdf" as "pdf" | "image" | "rich",
    contentType: "file" as "file" | "rich",
  });

  const loadPyqs = useCallback(() => {
    setLoading(true);
    getDocs(query(collection(db, "pyqs"), orderBy("createdAt", "desc")))
      .then(s => setPyqs(s.docs.map(d => ({ id: d.id, ...d.data() } as FirePyq))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPyqs(); }, [loadPyqs]);

  const reset = () => {
    setShow(false);
    setForm({ grade: 10, subject: "", title: "", year: new Date().getFullYear(), pdfUrl: "", fileType: "pdf", contentType: "file" });
    setSaveStatus("idle");
    setSaveMsg("");
    if (richEditorRef.current) richEditorRef.current.innerHTML = "";
  };

  // Rich-text toolbar helper
  const execCmd = (cmd: string, value?: string) => {
    richEditorRef.current?.focus();
    document.execCommand(cmd, false, value ?? "");
  };

  // Save cursor position before file dialog opens (so we can restore it)
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    if (!savedRangeRef.current) return;
    richEditorRef.current?.focus();
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current); }
  };

  // Insert an image inline using base64 — no Firebase Storage auth required
  const handleInlineImageFile = async (file: File) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setSaveStatus("error"); setSaveMsg("Only JPEG, PNG, WebP or GIF images are allowed."); return;
    }
    if (file.size > 500 * 1024) {
      setSaveStatus("error"); setSaveMsg("Image too large — please use an image under 500 KB."); return;
    }
    setImgUploading(true);
    setSaveStatus("idle");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      restoreSelection();
      document.execCommand("insertHTML", false,
        `<img src="${base64}" alt="question image" style="max-width:100%;border-radius:8px;margin:8px 0;display:block;" />`);
    } catch (e: any) {
      setSaveStatus("error");
      setSaveMsg("Image insert failed: " + (e?.message ?? "unknown error"));
    } finally {
      setImgUploading(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.subject.trim() || !form.title.trim()) {
      setSaveStatus("error"); setSaveMsg("Subject and title are required."); return;
    }
    if (form.contentType === "file" && !form.pdfUrl) {
      setSaveStatus("error"); setSaveMsg("Please upload a PDF or image file."); return;
    }
    const richContent = richEditorRef.current?.innerHTML ?? "";
    if (form.contentType === "rich" && (!richContent || richContent.replace(/<[^>]*>/g, "").trim() === "")) {
      setSaveStatus("error"); setSaveMsg("Please add some content in the editor."); return;
    }

    setSaving(true); setSaveStatus("idle");
    try {
      const base = {
        grade: form.grade,
        subject: form.subject.trim(),
        title: form.title.trim(),
        year: form.year,
        contentType: form.contentType,
        createdAt: new Date().toISOString(),
      };
      if (form.contentType === "file") {
        await addDoc(collection(db, "pyqs"), { ...base, pdfUrl: form.pdfUrl, fileType: form.fileType });
      } else {
        await addDoc(collection(db, "pyqs"), { ...base, content: richContent, pdfUrl: "", fileType: "rich" });
      }
      setSaveStatus("success"); setSaveMsg(`PYQ "${form.title.trim()}" saved successfully!`);
      loadPyqs();
      setTimeout(() => reset(), 1800);
    } catch (e: any) {
      setSaveStatus("error"); setSaveMsg(e?.message || "Failed to save PYQ.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "pyqs", id));
      setPyqs(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error("[Admin] Delete PYQ failed:", e); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Manage PYQs</h2>
        <button onClick={() => setShow(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-all">
          <Plus className="w-4 h-4" /> Add PYQ
        </button>
      </div>

      {show && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
          {/* Row 1: Grade + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {[9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          {/* Subject + Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. Mathematics" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. Bagmati Pradesh 2080" />
          </div>

          {/* Content type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Content Type</label>
            <div className="flex gap-2">
              {(["file", "rich"] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => { setForm(f => ({ ...f, contentType: t })); setSaveStatus("idle"); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border transition-all ${
                    form.contentType === t
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                  }`}>
                  {t === "file" ? <><Upload className="w-3.5 h-3.5" /> File (PDF / Image)</> : <><Type className="w-3.5 h-3.5" /> Rich Text + Images</>}
                </button>
              ))}
            </div>
          </div>

          {/* FILE upload */}
          {form.contentType === "file" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Upload PDF or Image</label>
              {form.pdfUrl ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  {form.fileType === "image" ? <Image className="w-4 h-4 text-green-600" /> : <FileText className="w-4 h-4 text-green-600" />}
                  <p className="text-sm text-green-700 flex-1">{form.fileType === "image" ? "Image" : "PDF"} uploaded ✓</p>
                  <button onClick={() => setForm(f => ({ ...f, pdfUrl: "", fileType: "pdf" }))} className="text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <FileUpload
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  label="Upload PDF or image (drag & drop or click)"
                  storagePath="pyqs"
                  onUploaded={(url, type) => setForm(f => ({ ...f, pdfUrl: url, fileType: type }))}
                />
              )}
            </div>
          )}

          {/* RICH TEXT editor */}
          {form.contentType === "rich" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Content</label>
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 select-none">
                  <button type="button" onMouseDown={e => { e.preventDefault(); execCmd("formatBlock", "h2"); }}
                    className="px-2.5 py-1 text-xs font-bold rounded hover:bg-gray-200 text-gray-700">H1</button>
                  <button type="button" onMouseDown={e => { e.preventDefault(); execCmd("formatBlock", "h3"); }}
                    className="px-2.5 py-1 text-xs font-bold rounded hover:bg-gray-200 text-gray-700">H2</button>
                  <button type="button" onMouseDown={e => { e.preventDefault(); execCmd("formatBlock", "h4"); }}
                    className="px-2.5 py-1 text-xs font-bold rounded hover:bg-gray-200 text-gray-700">H3</button>
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  <button type="button" onMouseDown={e => { e.preventDefault(); execCmd("bold"); }}
                    className="px-2.5 py-1 text-xs font-bold rounded hover:bg-gray-200 text-gray-700">B</button>
                  <button type="button" onMouseDown={e => { e.preventDefault(); execCmd("italic"); }}
                    className="px-2.5 py-1 text-xs italic rounded hover:bg-gray-200 text-gray-700">I</button>
                  <button type="button" onMouseDown={e => { e.preventDefault(); execCmd("underline"); }}
                    className="px-2.5 py-1 text-xs underline rounded hover:bg-gray-200 text-gray-700">U</button>
                  <div className="w-px h-4 bg-gray-300 mx-1" />
                  <button type="button"
                    onMouseDown={e => { e.preventDefault(); saveSelection(); imgInputRef.current?.click(); }}
                    disabled={imgUploading}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded hover:bg-gray-200 text-gray-700 disabled:opacity-50">
                    <Image className="w-3 h-3" />
                    {imgUploading ? "Uploading…" : "Image"}
                  </button>
                </div>
                {/* Editor area */}
                <div
                  ref={richEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Write PYQ content here — questions, answers, diagrams. Use toolbar for headings, bold, and inline images."
                  className="pyq-editor min-h-[220px] max-h-[500px] overflow-y-auto p-4 text-sm focus:outline-none prose prose-sm max-w-none"
                />
              </div>
              {/* Hidden image input */}
              <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleInlineImageFile(f); }} />
              <p className="text-xs text-gray-400 mt-1.5">Click the Image button in the toolbar to insert photos inline.</p>
            </div>
          )}

          {/* Status messages */}
          {saveStatus === "success" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {saveMsg}
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">
              {saving ? "Saving…" : "Save PYQ"}
            </button>
            <button onClick={reset} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {loading
        ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : pyqs.map(p => (
          <div key={p.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2">
            <div>
              <p className="font-medium text-gray-900 text-sm">{p.title}</p>
              <p className="text-xs text-gray-500">Grade {p.grade} · {p.subject} · {p.year} · {
                p.contentType === "rich" ? "Rich Text" : p.fileType === "image" ? "Image" : "PDF"
              }</p>
            </div>
            <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ─── Announcements ───────────────────────────────────────────────────────────

function ManageAnnouncements() {
  const [list, setList] = useState<FireAnnouncement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
      setList(snap.docs.map(d => ({ id: d.id, ...d.data() } as FireAnnouncement)));
    } catch (e) { console.error(e); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true); setErrorMsg("");
    try {
      await addDoc(collection(db, "announcements"), {
        title: title.trim(), body: body.trim(), createdAt: new Date().toISOString(),
      });
      setTitle(""); setBody("");
      await load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to post announcement.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "announcements", id));
      setList(l => l.filter(x => x.id !== id));
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">Announcements</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Post New Announcement</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your announcement…"
            rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" required />
        </div>
        {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50">
          <Megaphone className="w-4 h-4" /> {saving ? "Posting…" : "Post Announcement"}
        </button>
      </form>

      {loadingList
        ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        : list.length === 0
        ? <p className="text-center text-gray-400 py-8">No announcements yet.</p>
        : list.map(a => (
          <div key={a.id} className="flex items-start justify-between bg-white rounded-xl border border-gray-100 px-4 py-4 mb-2">
            <div className="flex-1 min-w-0 mr-3">
              <p className="font-semibold text-gray-900 text-sm mb-1">{a.title}</p>
              <p className="text-gray-600 text-sm">{a.body}</p>
              <p className="text-gray-400 text-xs mt-1">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
            <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ─── Manage Users ────────────────────────────────────────────────────────────

function ManageUsers() {
  const [users, setUsers] = useState<FireUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")))
      .then(s => setUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as FireUser))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (uid: string, role: string) => {
    setUpdatingUid(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role } : u));
    } catch (e) { console.error("[Admin] Role update failed:", e); }
    finally { setUpdatingUid(null); }
  };

  const handleDelete = async (uid: string) => {
    if (!window.confirm("Delete this user's profile? They can still log in but will need to redo setup.")) return;
    try {
      await deleteDoc(doc(db, "users", uid));
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
        <button onClick={loadUsers} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Refresh</button>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
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
                <p className="text-xs text-gray-400">Joined {new Date(u.createdAt || Date.now()).toLocaleDateString()}</p>
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

// ─── Badge Manager ───────────────────────────────────────────────────────────

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

const fmtTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
function getUnlockedStudyBadges(mins: number)  { return STUDY_TIERS.filter(t => mins >= t.mins); }
function getUnlockedStreakBadges(days: number)  { return STREAK_TIERS.filter(t => days >= t.days); }

function MicroBadge({ emoji, label, bg }: { emoji: string; label: string; bg: string }) {
  return (
    <span style={{ background: bg }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold">
      {emoji} {label}
    </span>
  );
}

function CustomBadgePill({ badge, onRemove }: { badge: CustomBadge; onRemove: () => void }) {
  return (
    <span style={{ background: badge.color, boxShadow: `0 2px 10px ${badge.color}55` }}
      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-white text-[10px] font-bold">
      {badge.emoji} {badge.text}
      <button onClick={onRemove} className="ml-0.5 opacity-70 hover:opacity-100 rounded-full">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function BadgeManager() {
  const [users, setUsers] = useState<FireUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<"all" | 9 | 10 | 11 | 12>("all");
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [badgeText, setBadgeText] = useState("");
  const [badgeEmoji, setBadgeEmoji] = useState("⭐");
  const [badgeColor, setBadgeColor] = useState("#6366f1");
  const [userBadges, setUserBadges] = useState<Record<string, CustomBadge[]>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), orderBy("totalStudyTime", "desc")));
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as FireUser));
      setUsers(list);
      const map: Record<string, CustomBadge[]> = {};
      list.forEach(u => { map[u.uid] = u.badges ?? []; });
      setUserBadges(map);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(u => {
    if (gradeFilter !== "all" && u.grade !== gradeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const addBadge = async (uid: string) => {
    if (!badgeText.trim()) return;
    const newBadge: CustomBadge = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: badgeText.trim(), emoji: badgeEmoji, color: badgeColor,
      createdAt: new Date().toISOString(),
    };
    const updated = [...(userBadges[uid] ?? []), newBadge];
    setUserBadges(prev => ({ ...prev, [uid]: updated }));
    setBadgeText(""); setOpenUid(null);
    updateDoc(doc(db, "users", uid), { badges: updated }).catch(e => console.error("Badge save failed:", e));
  };

  const removeBadge = (uid: string, badgeId: string) => {
    const updated = (userBadges[uid] ?? []).filter(b => b.id !== badgeId);
    setUserBadges(prev => ({ ...prev, [uid]: updated }));
    updateDoc(doc(db, "users", uid), { badges: updated }).catch(e => console.error("Badge remove failed:", e));
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

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div className="flex gap-1.5 items-center flex-shrink-0">
          {(["all", 9, 10, 11, 12] as const).map(g => (
            <button key={g} onClick={() => setGradeFilter(g)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all ${gradeFilter === g ? "bg-purple-500 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600"}`}>
              {g === "all" ? "All" : `G${g}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{search ? "No users match your search." : "No users yet."}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const studyBadges  = getUnlockedStudyBadges(u.totalStudyTime ?? 0);
            const streakBadges = getUnlockedStreakBadges(u.streak ?? 0);
            const custom = userBadges[u.uid] ?? [];
            const isOpen = openUid === u.uid;
            return (
              <div key={u.uid} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded-xl hover:bg-purple-100 transition-all flex-shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Add Badge
                  </button>
                </div>
                {(studyBadges.length > 0 || streakBadges.length > 0 || custom.length > 0) && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {studyBadges.map(b => <MicroBadge key={b.label} emoji={b.emoji} label={b.label} bg={b.bg} />)}
                    {streakBadges.map(b => <MicroBadge key={b.label} emoji={b.emoji} label={b.label} bg={b.bg} />)}
                    {custom.map(b => <CustomBadgePill key={b.id} badge={b} onRemove={() => removeBadge(u.uid, b.id)} />)}
                  </div>
                )}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-purple-50/60 px-4 py-4 space-y-3">
                    <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">New Custom Badge</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Badge Text</label>
                      <input value={badgeText} onChange={e => setBadgeText(e.target.value)}
                        placeholder="e.g. Top Performer, Most Dedicated…" maxLength={30}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Emoji</label>
                      <div className="flex flex-wrap gap-1.5">
                        {EMOJI_OPTIONS.map(e => (
                          <button key={e} onClick={() => setBadgeEmoji(e)}
                            className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${badgeEmoji === e ? "bg-purple-200 ring-2 ring-purple-500 scale-110" : "bg-white border border-gray-200 hover:bg-purple-50"}`}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Badge Color</label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {COLOR_PRESETS.map(c => (
                          <button key={c} onClick={() => setBadgeColor(c)} style={{ background: c }}
                            className={`w-7 h-7 rounded-full transition-all ${badgeColor === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`} />
                        ))}
                        <div className="flex items-center gap-2 ml-1">
                          <input type="color" value={badgeColor} onChange={e => setBadgeColor(e.target.value)}
                            className="w-7 h-7 rounded-full cursor-pointer border border-gray-200" title="Custom color" />
                          <span className="text-xs text-gray-400">Custom</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      {badgeText && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Preview:</span>
                          <span style={{ background: badgeColor, boxShadow: `0 4px 16px ${badgeColor}66` }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold">
                            {badgeEmoji} {badgeText}
                          </span>
                        </div>
                      )}
                      <button onClick={() => addBadge(u.uid)} disabled={!badgeText.trim()}
                        className="ml-auto px-4 py-2 bg-purple-500 text-white text-xs font-semibold rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-all">
                        Assign Badge
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

// ─── SEO Panel ───────────────────────────────────────────────────────────────

interface SeoMeta {
  seoTitle: string; description: string; keywords: string; slug: string; noIndex: boolean;
  ogImage: string; ogType: string; twitterCard: string; twitterImage: string;
  canonicalUrl: string; gscVerification: string; structuredData: string;
}
const emptySeo = (): SeoMeta => ({
  seoTitle: "", description: "", keywords: "", slug: "", noIndex: false,
  ogImage: "", ogType: "article", twitterCard: "summary_large_image", twitterImage: "",
  canonicalUrl: "", gscVerification: "", structuredData: "",
});
type SeoKind = "note" | "pyq";
interface SeoEditTarget { id: string; defaultTitle: string; kind: SeoKind }

function SeoEditor({ target, onClose }: { target: SeoEditTarget; onClose: () => void }) {
  const docId = `${target.kind}_${target.id}`;
  const [form, setForm] = useState<SeoMeta>(emptySeo());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"basic" | "social" | "advanced">("basic");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await Promise.race([
          getDoc(doc(db, "seo_meta", docId)),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
        ]);
        if (cancelled) return;
        if (snap.exists()) setForm({ ...emptySeo(), ...(snap.data() as SeoMeta) });
        else setForm({ ...emptySeo(), seoTitle: target.defaultTitle });
      } catch {
        if (!cancelled) setForm({ ...emptySeo(), seoTitle: target.defaultTitle });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [docId, target.defaultTitle]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaved(false);
    try {
      await setDoc(doc(db, "seo_meta", docId), { ...form, updatedAt: new Date().toISOString() });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err) { console.error("SEO save failed:", err); alert("Save failed — check console."); }
    finally { setSaving(false); }
  };

  const f = (k: keyof SeoMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const autoJsonLd = () => {
    const baseUrl = "https://studenthub.np";
    const ld = {
      "@context": "https://schema.org",
      "@type": target.kind === "note" ? "Article" : "Course",
      "name": form.seoTitle || target.defaultTitle,
      "description": form.description,
      "url": form.canonicalUrl || `${baseUrl}/${target.kind}s/${target.id}`,
      "publisher": { "@type": "Organization", "name": "Student Hub", "url": baseUrl },
      "educationalLevel": "High School",
      "inLanguage": "en-NP",
    };
    setForm(p => ({ ...p, structuredData: JSON.stringify(ld, null, 2) }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{target.kind.toUpperCase()} SEO</p>
            <h3 className="text-base font-bold text-gray-900 truncate max-w-xs">{target.defaultTitle}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-all">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 pt-3">
          {(["basic", "social", "advanced"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-2.5 px-3 text-xs font-semibold capitalize border-b-2 transition-all ${tab === t ? "border-purple-500 text-purple-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t === "basic" ? "Basic SEO" : t === "social" ? "Social / OG" : "Advanced"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-4">
            {/* ── Basic Tab ── */}
            {tab === "basic" && (<>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">SEO Title <span className="text-gray-400 font-normal">(shown in Google)</span></label>
                <input value={form.seoTitle} onChange={f("seoTitle")} placeholder={target.defaultTitle}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-400">Keep under 60 chars</p>
                  <p className={`text-xs font-medium ${form.seoTitle.length > 60 ? "text-red-500" : "text-gray-400"}`}>{form.seoTitle.length}/60</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Meta Description</label>
                <textarea value={form.description} onChange={f("description")} rows={3}
                  placeholder="Brief description for search engines…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-400">120–160 chars ideal</p>
                  <p className={`text-xs font-medium ${form.description.length > 160 ? "text-red-500" : form.description.length >= 120 ? "text-green-500" : "text-gray-400"}`}>{form.description.length}/160</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Focus Keywords</label>
                <input value={form.keywords} onChange={f("keywords")} placeholder="grade 10 science notes, SEE notes Nepal"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <p className="text-xs text-gray-400 mt-1">Comma-separated keywords</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Canonical URL</label>
                <input value={form.canonicalUrl} onChange={f("canonicalUrl")} placeholder="https://studenthub.np/notes/grade-10-science"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <p className="text-xs text-gray-400 mt-1">Prevents duplicate content issues</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">URL Slug</label>
                <input value={form.slug} onChange={f("slug")} placeholder="grade-10-science-notes-nepal"
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
            </>)}

            {/* ── Social / OG Tab ── */}
            {tab === "social" && (<>
              <div className="bg-blue-50 rounded-2xl p-3 text-xs text-blue-700">
                Open Graph tags control how links look when shared on Facebook, WhatsApp, LinkedIn, and other platforms.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">OG Image URL</label>
                <input value={form.ogImage} onChange={f("ogImage")} placeholder="https://studenthub.np/og-images/grade10-science.jpg"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <p className="text-xs text-gray-400 mt-1">Recommended: 1200×630px image (upload to Firebase Storage first)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">OG Type</label>
                <select value={form.ogType} onChange={f("ogType")}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  <option value="article">article</option>
                  <option value="website">website</option>
                  <option value="book">book</option>
                </select>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-600 mb-3">Twitter / X Card</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Card Type</label>
                    <select value={form.twitterCard} onChange={f("twitterCard")}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                      <option value="summary_large_image">summary_large_image (big preview)</option>
                      <option value="summary">summary (small thumbnail)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Twitter Image URL <span className="text-gray-400">(leave blank to use OG image)</span></label>
                    <input value={form.twitterImage} onChange={f("twitterImage")} placeholder="https://studenthub.np/twitter-card.jpg"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  </div>
                </div>
              </div>
              {form.ogImage && (
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <p className="text-xs font-semibold text-gray-500 px-4 py-2 border-b bg-gray-50">OG Preview</p>
                  <div className="p-3">
                    <img src={form.ogImage} alt="OG Preview" className="w-full h-32 object-cover rounded-xl" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <p className="text-xs font-semibold text-gray-800 mt-2 truncate">{form.seoTitle || target.defaultTitle}</p>
                    <p className="text-xs text-gray-400 truncate">{form.description}</p>
                  </div>
                </div>
              )}
            </>)}

            {/* ── Advanced Tab ── */}
            {tab === "advanced" && (<>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Google Search Console Verification Code</label>
                <input value={form.gscVerification} onChange={f("gscVerification")} placeholder="abc123xyz (meta tag content value)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <p className="text-xs text-gray-400 mt-1">Paste the value from &lt;meta name="google-site-verification" content="..."&gt;</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-600">Structured Data (JSON-LD)</label>
                  <button type="button" onClick={autoJsonLd}
                    className="text-xs px-3 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-all font-medium">
                    Auto-Generate
                  </button>
                </div>
                <textarea value={form.structuredData} onChange={f("structuredData")} rows={8}
                  placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "name": "..."\n}'}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-purple-400" />
                <p className="text-xs text-gray-400 mt-1">Valid JSON-LD. Test at <span className="text-blue-400">search.google.com/test/rich-results</span></p>
              </div>
              {form.structuredData && (() => {
                try {
                  JSON.parse(form.structuredData);
                  return <p className="text-xs text-green-600 font-medium">✓ Valid JSON</p>;
                } catch {
                  return <p className="text-xs text-red-500 font-medium">✗ Invalid JSON — check syntax</p>;
                }
              })()}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">🔒 Firestore Rules — Action Required</p>
                <p className="text-xs text-amber-600 mb-2">
                  For notes and PYQs to be visible to non-logged-in visitors, your Firestore security rules must allow public reads.
                </p>
                <ol className="text-xs text-amber-600 space-y-1 list-decimal ml-4">
                  <li>Go to <strong>Firebase Console → Firestore → Rules</strong></li>
                  <li>Replace the existing rules with the contents of your <code>firestore.rules</code> file</li>
                  <li>Click <strong>Publish</strong></li>
                </ol>
              </div>
            </>)}

            <div className="flex gap-3 pt-2 border-t border-gray-100">
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
  const [noteItems, setNoteItems] = useState<Array<{ id: string; title: string; grade: number; subject: string; kind: SeoKind; url: string }>>([]);
  const [pyqItems,  setPyqItems]  = useState<Array<{ id: string; title: string; grade: number; subject: string; kind: SeoKind; url: string }>>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [filterKind, setFilterKind] = useState<"all" | "note" | "pyq">("all");
  const [filterGrade, setFilterGrade] = useState<"all" | number>("all");
  const baseUrl = "https://studenthub.np";

  useEffect(() => {
    setLoadingItems(true);
    Promise.all([
      getDocs(collection(db, "notes")),
      getDocs(collection(db, "pyqs")),
    ]).then(([notesSnap, pyqsSnap]) => {
      setNoteItems(notesSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, title: data.title, grade: data.grade, subject: data.subject, kind: "note" as SeoKind, url: `${baseUrl}/notes/${d.id}` };
      }));
      setPyqItems(pyqsSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, title: data.title, grade: data.grade, subject: data.subject, kind: "pyq" as SeoKind, url: `${baseUrl}/pyq/${d.id}` };
      }));
    }).catch(console.error)
    .finally(() => setLoadingItems(false));
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
    ...pyqItems.map(i =>  ({ ...i, kindLabel: "PYQ"  })),
  ].filter(i => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterKind !== "all" && i.kind !== filterKind) return false;
    if (filterGrade !== "all" && i.grade !== filterGrade) return false;
    return true;
  });

  const generateSitemap = () => {
    const all = [...staticUrls, ...noteItems.map(n => ({ url: n.url, label: n.title, kind: "Note" })), ...pyqItems.map(p => ({ url: p.url, label: p.title, kind: "PYQ" }))];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all.map(u => `  <url>\n    <loc>${u.url}</loc>\n    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.kind === "Static" ? "0.9" : "0.7"}</priority>\n  </url>`).join("\n")}\n</urlset>`;
    const blob = new Blob([xml], { type: "application/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sitemap.xml";
    link.click();
  };

  const generateRobotsTxt = () => {
    const txt = `User-agent: *\nAllow: /\nAllow: /notes/\nAllow: /pyqs/\nAllow: /about\nAllow: /contact\nDisallow: /dashboard\nDisallow: /admin\nDisallow: /settings\nDisallow: /todo\nDisallow: /report\nDisallow: /saved\nDisallow: /pomodoro\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
    const blob = new Blob([txt], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "robots.txt";
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
            Advanced SEO management ·{" "}
            <span className="text-purple-600 font-medium">{allItems.length} pages indexable</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={generateRobotsTxt}
            className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-all flex items-center gap-2">
            ⬇ robots.txt
          </button>
          <button onClick={generateSitemap}
            className="px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-all flex items-center gap-2">
            ⬇ sitemap.xml
          </button>
        </div>
      </div>

      {/* Firestore Rules Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
        <p className="text-xs font-bold text-amber-800 mb-1.5">⚠️ Required: Deploy Firestore Rules for Public Notes Access</p>
        <p className="text-xs text-amber-700 mb-2">
          Notes and PYQs are invisible to guest visitors until you deploy the updated security rules. This is a one-time step.
        </p>
        <ol className="text-xs text-amber-700 space-y-1 list-decimal ml-4">
          <li>Open <strong>Firebase Console</strong> → your project → <strong>Firestore Database → Rules</strong></li>
          <li>Replace ALL existing rules with the content of your <code className="bg-amber-100 px-1 rounded">firestore.rules</code> file in this project</li>
          <li>Click <strong>Publish</strong> — notes will become visible to everyone instantly</li>
        </ol>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Static Pages",        count: staticUrls.length,  color: "bg-blue-50 text-blue-600"    },
          { label: "Note Pages",           count: noteItems.length,   color: "bg-green-50 text-green-600"  },
          { label: "PYQ Pages",            count: pyqItems.length,    color: "bg-orange-50 text-orange-600"},
          { label: "Total Indexable",      count: staticUrls.length + noteItems.length + pyqItems.length, color: "bg-purple-50 text-purple-600" },
        ].map(({ label, count, color }) => (
          <div key={label} className={`${color.split(" ")[0]} rounded-2xl p-4 border border-gray-100`}>
            <p className={`text-2xl font-bold ${color.split(" ")[1]}`}>{count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Google Search Console guide */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
        <p className="text-sm font-bold text-gray-900 mb-3">Google Search Console Setup</p>
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p>Go to <strong>search.google.com/search-console</strong> and add your property (e.g. <code className="bg-gray-100 px-1 rounded">studenthub.np</code>)</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p>Choose <strong>HTML tag</strong> verification → copy the <code className="bg-gray-100 px-1 rounded">content="..."</code> value</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <p>Paste it in the <strong>GSC Verification Code</strong> field when editing a page's SEO (Advanced tab)</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            <p>Download <strong>sitemap.xml</strong> above, upload it to your hosting root, then submit the URL in GSC</p>
          </div>
        </div>
      </div>

      {/* SEO tips */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-6">
        <p className="text-xs font-semibold text-purple-700 mb-2">📌 Advanced SEO Tips</p>
        <ul className="text-xs text-purple-600 space-y-1">
          <li>• <strong>SEO Title:</strong> Keep under 60 chars. E.g. "Grade 10 Science Notes — NEB Nepal | Student Hub"</li>
          <li>• <strong>Meta Description:</strong> 120–160 chars. Natural language that matches what the student is searching.</li>
          <li>• <strong>OG Image:</strong> 1200×630px image makes your links look great on WhatsApp and Facebook shares.</li>
          <li>• <strong>Canonical URL:</strong> Always set this for note/PYQ pages to avoid duplicate content penalties.</li>
          <li>• <strong>JSON-LD:</strong> Use the Auto-Generate button — structured data helps Google show rich results.</li>
          <li>• <strong>No Index:</strong> Mark empty or duplicate pages to avoid wasting your crawl budget.</li>
        </ul>
      </div>

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

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-700 mr-auto">Notes &amp; PYQs SEO</p>
          {(["all", "note", "pyq"] as const).map(k => (
            <button key={k} onClick={() => setFilterKind(k)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${filterKind === k ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {k === "all" ? "All" : k === "note" ? "Notes" : "PYQs"}
            </button>
          ))}
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
                  {item.grade && <span className="text-[9px] text-gray-400">G{item.grade}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{item.title}</p>
                  {item.subject && <p className="text-xs text-gray-400 truncate">{item.subject}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-600 transition-colors">Open ↗</a>
                  <button
                    onClick={() => setEditing({ id: item.id, defaultTitle: item.title, kind: item.kind })}
                    className="px-3 py-1.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded-lg hover:bg-purple-100 transition-all">
                    Edit SEO
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
      <p className="text-xs text-gray-400 mt-4 text-center">SEO data saved to Firestore · Changes apply immediately on the live site</p>
    </div>
  );
}

// ─── Admin Shell ─────────────────────────────────────────────────────────────

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
            <button key={key} onClick={() => setSection(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                section === key ? "bg-purple-50 text-purple-600" : "text-gray-600 hover:bg-gray-50"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <Link href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-all mb-1 w-full">
            ← Back to App
          </Link>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all w-full">
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
