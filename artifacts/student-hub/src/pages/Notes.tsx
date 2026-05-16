import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpen, ChevronRight, FileText, Image, Type, X, ExternalLink, ZoomIn, LogIn, Sparkles, Maximize2, Minimize2, Bookmark } from "lucide-react";

type NoteView = {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  grade: number;
  contentType: string;
  content: string;
};

function ContentTypeBadge({ type }: { type: string }) {
  const map: Record<string, { icon: typeof FileText; label: string; cls: string }> = {
    pdf:   { icon: FileText, label: "PDF",   cls: "bg-red-50 text-red-600"       },
    image: { icon: Image,    label: "Image", cls: "bg-purple-50 text-purple-600" },
    text:  { icon: Type,     label: "Text",  cls: "bg-blue-50 text-blue-600"     },
  };
  const m = map[type] ?? map.text;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${m.cls}`}>
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

function NoteViewer({ note, onClose, uid }: { note: NoteView; onClose: () => void; uid?: string }) {
  const [, setLocation] = useLocation();
  const [imgZoomed, setImgZoomed] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const savedDocId = uid ? `${uid}_note_${note.id}` : null;

  // Lock background scroll when the viewer is open — prevents iOS touch-scroll bleed-through.
  useEffect(() => {
    const area = document.querySelector(".main-scroll-area") as HTMLElement | null;
    const prevOvf = area?.style.overflowY ?? "";
    const prevPE  = area?.style.pointerEvents ?? "";
    if (area) { area.style.overflowY = "hidden"; area.style.pointerEvents = "none"; }
    return () => {
      if (area) { area.style.overflowY = prevOvf; area.style.pointerEvents = prevPE; }
    };
  }, []);

  useEffect(() => {
    if (!savedDocId) return;
    getDoc(doc(db, "saved_items", savedDocId))
      .then(snap => setSaved(snap.exists()))
      .catch(() => {});
  }, [savedDocId]);

  const toggleSave = async () => {
    if (!uid || !savedDocId || savingToggle) return;
    setSavingToggle(true);
    try {
      if (saved) {
        await deleteDoc(doc(db, "saved_items", savedDocId));
        setSaved(false);
      } else {
        await setDoc(doc(db, "saved_items", savedDocId), {
          uid, itemType: "note", itemId: note.id,
          savedAt: new Date().toISOString(),
        });
        setSaved(true);
      }
    } catch (e) {
      console.error("[NoteViewer save]", e);
    } finally {
      setSavingToggle(false);
    }
  };

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = el.scrollHeight <= el.clientHeight
      ? 100
      : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
    setScrollPct(pct);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleAskAi = () => {
    onClose();
    const ctx = note.contentType === "text"
      ? `I am reading a note titled "${note.title}" (${note.subject}, Chapter: ${note.chapter}). Here is the content:\n\n${note.content.slice(0, 1500)}\n\nPlease explain this clearly and help me understand the key concepts.`
      : `I am reading a ${note.contentType} note titled "${note.title}" (${note.subject}, Chapter: ${note.chapter}). Please explain this topic to me and tell me the key things I should know.`;
    setLocation(`/ai?q=${encodeURIComponent(ctx)}`);
  };

  // Log note view
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const logId = `${uid}_${today}`;
        const logRef = doc(db, "study_logs", logId);
        const logSnap = await getDoc(logRef);
        if (logSnap.exists()) {
          await updateDoc(logRef, { notesViewed: (logSnap.data().notesViewed ?? 0) + 1 });
        } else {
          await setDoc(logRef, { uid, date: today, studyMinutes: 0, tasksCompleted: 0, notesViewed: 1 });
        }
      } catch {}
    })();
  }, [uid, note.id]);

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[9000] flex items-center justify-center p-2 sm:p-4">
      <div ref={containerRef} className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="h-1 bg-gray-100 flex-shrink-0 rounded-t-3xl overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${scrollPct}%` }} />
        </div>
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <ContentTypeBadge type={note.contentType} />
              <span className="text-xs text-gray-400">{note.subject} · {note.chapter}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{note.title}</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleAskAi}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white text-xs font-semibold rounded-xl hover:bg-indigo-600 transition-all"
            >
              <Sparkles className="w-3 h-3" /> Ask AI
            </button>
            {uid && (
              <button
                onClick={toggleSave}
                disabled={savingToggle}
                title={saved ? "Remove from saved" : "Save this note"}
                className={`p-1.5 rounded-xl transition-all disabled:opacity-50 ${saved ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                <Bookmark className={`w-4 h-4 ${saved ? "fill-white" : ""}`} />
              </button>
            )}
            <Link
              href={`/notes/${note.id}`}
              onClick={onClose}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all"
            >
              <ExternalLink className="w-3 h-3" /> Full page
            </Link>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="p-2 rounded-xl hover:bg-gray-100 transition-all"
            >
              {isFullscreen
                ? <Minimize2 className="w-4 h-4 text-gray-500" />
                : <Maximize2 className="w-4 h-4 text-gray-500" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-all">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="sm:hidden flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <span className="text-xs text-blue-700">Reading preview</span>
          <Link href={`/notes/${note.id}`} onClick={onClose}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600">
            <ExternalLink className="w-3 h-3" /> View Full Note
          </Link>
        </div>
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto">
          {note.contentType === "text" && (
            <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
              {note.content.trimStart().startsWith("<") ? (
                <article
                  className="text-gray-800 text-[16px] leading-[1.85] prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
              ) : (
                <article className="text-gray-800 text-[16px] leading-[1.85] space-y-4 whitespace-pre-wrap">
                  {note.content}
                </article>
              )}
            </div>
          )}
          {note.contentType === "pdf" && (
            <div className="flex flex-col h-full min-h-[400px] sm:min-h-[540px] p-4 sm:p-6 gap-3">
              <div className="flex items-center justify-between flex-shrink-0">
                <p className="text-sm text-gray-500">PDF Document</p>
                <a href={note.content} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
                </a>
              </div>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(note.content)}&embedded=true`}
                className="flex-1 w-full rounded-2xl border border-gray-100 min-h-[400px]"
                title={note.title}
              />
            </div>
          )}
          {note.contentType === "image" && (
            <div className="flex flex-col items-center gap-4 p-6 sm:p-8">
              <div className="relative group cursor-zoom-in" onClick={() => setImgZoomed(true)}>
                <img src={note.content} alt={note.title} className="max-w-full rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                     style={{ maxHeight: "60vh", objectFit: "contain" }} />
                <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Click to zoom</p>
              {imgZoomed && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center cursor-zoom-out" onClick={() => setImgZoomed(false)}>
                  <img src={note.content} alt={note.title} className="max-w-full max-h-full object-contain p-6" />
                  <button className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30" onClick={() => setImgZoomed(false)}>
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function NotesContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { user, profile } = useAuth();
  const [grade, setGrade] = useState<number>(profile?.grade || 10);
  const [subject, setSubject] = useState<string>("");
  const [selectedNote, setSelectedNote] = useState<NoteView | null>(null);
  const [notes, setNotes] = useState<NoteView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSubject("");
    const q = query(collection(db, "notes"), where("grade", "==", grade));
    getDocs(q).then(snap => {
      const list: NoteView[] = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as NoteView))
        .sort((a, b) => {
          const aTime = (a as any).createdAt ?? "";
          const bTime = (b as any).createdAt ?? "";
          return bTime.localeCompare(aTime);
        });
      setNotes(list);
    }).catch(e => {
      console.error("[Notes] Load failed:", e);
      setNotes([]);
    }).finally(() => setLoading(false));
  }, [grade]);

  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    notes.forEach(n => {
      const key = n.subject.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, n.subject.trim());
    });
    return [...seen.values()].sort();
  }, [notes]);
  const filtered = useMemo(() =>
    subject ? notes.filter(n => n.subject.trim().toLowerCase() === subject.trim().toLowerCase()) : notes,
    [notes, subject]
  );

  return (
    <>
      {selectedNote && (
        <NoteViewer note={selectedNote} onClose={() => setSelectedNote(null)} uid={user?.uid} />
      )}

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Study Notes</h1>
          <p className="text-gray-500 text-sm">Study materials organised by grade and subject</p>
        </div>

        {!isLoggedIn && (
          <div className="mb-5 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-blue-900 text-sm">Get full access — free</p>
              <p className="text-blue-700 text-xs mt-0.5">Nep AI, progress tracking, Pomodoro &amp; more</p>
            </div>
            <Link href="/login"
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-all flex-shrink-0 w-full sm:w-auto justify-center">
              <LogIn className="w-3.5 h-3.5" /> Login / Register
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 sm:mb-6">
          <select
            data-testid="select-grade-notes"
            value={grade}
            onChange={(e) => { setGrade(Number(e.target.value)); setSubject(""); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button onClick={() => setSubject("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All
            </button>
            {loading
              ? [1, 2, 3].map(i => <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />)
              : subjects.map((s) => (
                <button key={s} data-testid={`filter-subject-${s}`} onClick={() => setSubject(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {s}
                </button>
              ))
            }
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No notes found for this selection</p>
            <p className="text-sm mt-1">Try a different grade or subject</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((note) => (
              <div key={note.id} className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 hover:shadow-sm hover:border-blue-100 transition-all group min-w-0 overflow-hidden">
                <button
                  data-testid={`note-item-${note.id}`}
                  onClick={() => setSelectedNote(note)}
                  className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 text-left"
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    note.contentType === "pdf" ? "bg-red-50" : note.contentType === "image" ? "bg-purple-50" : "bg-blue-50"
                  }`}>
                    {note.contentType === "pdf"   && <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-red-500"    />}
                    {note.contentType === "image" && <Image    className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />}
                    {note.contentType === "text"  && <Type     className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500"   />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base line-clamp-2 leading-snug">{note.title}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{note.subject} · {note.chapter}</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2 sm:ml-3">
                  <ContentTypeBadge type={note.contentType} />
                  <Link
                    href={`/notes/${note.id}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    title="Open note page"
                    className="p-1 text-gray-300 hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function Notes() {
  const { user, profile } = useAuth();

  return (
    <>
      <Helmet>
        <title>Study Notes — Grade 9, 10, 11, 12 | Student Hub</title>
        <meta name="description" content="Free study notes for Nepal students in Grades 9–12. Browse by subject and chapter. PDF, image, and text notes available." />
        <meta name="keywords" content="grade 10 notes nepal, SEE notes, NEB notes, science notes, maths notes, class 10 notes" />
        <meta property="og:title" content="Study Notes — Student Hub" />
        <meta property="og:description" content="Free study notes for Grade 9–12 students in Nepal." />
      </Helmet>
      <NotesContent isLoggedIn={!!(user || profile)} />
    </>
  );
}
