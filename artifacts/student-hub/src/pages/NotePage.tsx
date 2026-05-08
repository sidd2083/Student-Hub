import { useCallback, useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft, FileText, Image, Type, ExternalLink, ZoomIn, X,
  BookOpen, Maximize2, Minimize2, Sparkles, ChevronRight, Bookmark,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  getDoc, doc, setDoc, updateDoc, deleteDoc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

const NOTE_VIEWED_KEY = "studenthub_viewed_notes_session";

interface NoteData {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  grade: number;
  contentType: string;
  content: string;
  createdAt?: string;
}

interface SeoMeta {
  seoTitle: string;
  description: string;
  keywords: string;
  noIndex: boolean;
}

function ZoomLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center cursor-zoom-out" onClick={onClose}>
      <img src={src} alt={alt} className="max-w-full max-h-full object-contain p-4 sm:p-8" />
      <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all" onClick={onClose}>
        <X className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}

function FocusReaderOverlay({ note, onClose, onAskAi }: {
  note: NoteData;
  onClose: () => void;
  onAskAi: () => void;
}) {
  const [scrollPct, setScrollPct] = useState(0);
  const [imgZoomed, setImgZoomed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = el.scrollHeight <= el.clientHeight
      ? 100
      : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
    setScrollPct(pct);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      <div className="h-1 bg-gray-100 flex-shrink-0">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${scrollPct}%` }} />
      </div>
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0">
          <Minimize2 className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">{note.subject} · {note.chapter} · Grade {note.grade}</p>
          <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">{note.title}</h1>
        </div>
        <button onClick={onAskAi}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-xl text-xs font-semibold hover:bg-indigo-600 transition-all flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5" /> Ask AI
        </button>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {note.contentType === "text" && (
          <div className="max-w-2xl mx-auto px-5 sm:px-10 py-10">
            <article className="prose prose-gray max-w-none text-gray-800 text-[16px] leading-[1.9] whitespace-pre-wrap">
              {note.content}
            </article>
          </div>
        )}
        {note.contentType === "pdf" && (
          <div className="h-full p-4 flex flex-col gap-3">
            <div className="flex justify-end">
              <a href={note.content} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
              </a>
            </div>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(note.content)}&embedded=true`}
              className="flex-1 w-full rounded-2xl border border-gray-100 min-h-[80vh]"
              title={note.title}
            />
          </div>
        )}
        {note.contentType === "image" && (
          <div className="flex flex-col items-center gap-4 p-8">
            <div className="relative group cursor-zoom-in" onClick={() => setImgZoomed(true)}>
              <img src={note.content} alt={note.title}
                className="max-w-full rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                style={{ maxHeight: "80vh", objectFit: "contain" }} />
              <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Click to zoom</p>
            {imgZoomed && <ZoomLightbox src={note.content} alt={note.title} onClose={() => setImgZoomed(false)} />}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveButton({ noteId, uid }: { noteId: string; uid: string }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const savedDocId = `${uid}_note_${noteId}`;

  useEffect(() => {
    getDoc(doc(db, "saved", savedDocId))
      .then(snap => setSaved(snap.exists()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savedDocId]);

  const toggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (saved) {
        await deleteDoc(doc(db, "saved", savedDocId));
        setSaved(false);
      } else {
        await setDoc(doc(db, "saved", savedDocId), {
          uid,
          itemType: "note",
          itemId: noteId,
          savedAt: new Date().toISOString(),
        });
        setSaved(true);
      }
    } catch (e) {
      console.error("[SaveButton]", e);
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      title={saved ? "Remove from saved" : "Save this note"}
      className={`p-2 rounded-xl transition-all disabled:opacity-50 ${
        saved ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      <Bookmark className={`w-4 h-4 ${saved ? "fill-white" : ""}`} />
    </button>
  );
}

export default function NotePage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [imgZoomed, setImgZoomed] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [seoMeta, setSeoMeta] = useState<SeoMeta | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) { setIsError(true); setLoading(false); return; }
    setLoading(true);
    getDoc(doc(db, "notes", id))
      .then(snap => {
        if (!snap.exists()) { setIsError(true); return; }
        setNote({ id: snap.id, ...snap.data() } as NoteData);
      })
      .catch(() => setIsError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "seo_meta", `note_${id}`))
      .then(snap => { if (snap.exists()) setSeoMeta(snap.data() as SeoMeta); })
      .catch(() => {});
  }, [id]);

  // Once-per-session note view logging
  useEffect(() => {
    if (!user?.uid || !note) return;
    try {
      const stored = sessionStorage.getItem(NOTE_VIEWED_KEY);
      const viewed: string[] = stored ? JSON.parse(stored) : [];
      if (!viewed.includes(id)) {
        viewed.push(id);
        sessionStorage.setItem(NOTE_VIEWED_KEY, JSON.stringify(viewed));
        (async () => {
          try {
            const today = new Date().toISOString().slice(0, 10);
            const logId = `${user.uid}_${today}`;
            const logRef = doc(db, "study_logs", logId);
            const logSnap = await getDoc(logRef);
            if (logSnap.exists()) {
              await updateDoc(logRef, { notesViewed: (logSnap.data().notesViewed ?? 0) + 1 });
            } else {
              await setDoc(logRef, { uid: user.uid, date: today, studyMinutes: 0, tasksCompleted: 0, notesViewed: 1 });
            }
          } catch {}
        })();
      }
    } catch {}
  }, [id, user, note]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = () => {
      const pct = el.scrollHeight <= el.clientHeight
        ? 100
        : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
      setScrollPct(pct);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [note]);

  const toSlug = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const canonicalSlug = note ? `grade-${note.grade}-${toSlug(note.subject)}-${toSlug(note.title)}` : "";

  const metaTitle = seoMeta?.seoTitle || (note
    ? `${note.title} — Grade ${note.grade} ${note.subject} Notes | Student Hub`
    : "Note | Student Hub");
  const metaDesc = seoMeta?.description || (note
    ? `Study notes for ${note.subject}, Grade ${note.grade} — ${note.chapter}. ${note.contentType === "text" ? note.content.slice(0, 120) + "…" : "Download or view the PDF/image."}`
    : "");
  const metaKeywords = seoMeta?.keywords || (note
    ? `${note.subject} notes, grade ${note.grade} notes, ${note.chapter}, Nepal SEE NEB notes`
    : "");

  const handleAskAi = () => {
    if (!note) return;
    const ctx = note.contentType === "text"
      ? `I am reading a note titled "${note.title}" (${note.subject}, Grade ${note.grade}, Chapter: ${note.chapter}). Here is the content:\n\n${note.content.slice(0, 1500)}\n\nPlease explain this to me clearly and help me understand the key concepts.`
      : `I am reading a ${note.contentType} note titled "${note.title}" (${note.subject}, Grade ${note.grade}, Chapter: ${note.chapter}). Please explain this topic to me and tell me what key things I should know about it.`;
    setLocation(`/ai?q=${encodeURIComponent(ctx)}`);
  };

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        {metaDesc && <meta name="description" content={metaDesc} />}
        {metaKeywords && <meta name="keywords" content={metaKeywords} />}
        {seoMeta?.noIndex && <meta name="robots" content="noindex,nofollow" />}
        {note && <meta property="og:title" content={seoMeta?.seoTitle || `${note.title} — Student Hub`} />}
        {metaDesc && <meta property="og:description" content={metaDesc} />}
        {note && <link rel="canonical" href={`https://studenthub.np/notes/${id}-${canonicalSlug}`} />}
      </Helmet>

      {focusMode && note && (
        <FocusReaderOverlay note={note} onClose={() => setFocusMode(false)} onAskAi={handleAskAi} />
      )}

      {imgZoomed && note && (
        <ZoomLightbox src={note.content} alt={note.title} onClose={() => setImgZoomed(false)} />
      )}

      <div ref={mainRef} className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto">
        {note && (
          <div className="mb-4 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${scrollPct}%` }} />
          </div>
        )}

        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5 flex-wrap">
          <Link href="/notes" className="hover:text-blue-600 transition-colors">Notes</Link>
          {note && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-500">Grade {note.grade}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-500">{note.subject}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-900 font-medium truncate max-w-[160px] sm:max-w-xs">{note.title}</span>
            </>
          )}
        </nav>

        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-100 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
            <div className="h-64 bg-gray-100 rounded-2xl mt-6" />
          </div>
        )}

        {isError && !loading && (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">Note not found</p>
            <Link href="/notes" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Notes
            </Link>
          </div>
        )}

        {note && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
              <div className="flex items-start gap-3">
                <Link href="/notes" className="p-2 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0 mt-0.5">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      note.contentType === "pdf"   ? "bg-red-50 text-red-600"    :
                      note.contentType === "image" ? "bg-purple-50 text-purple-600" :
                                                     "bg-blue-50 text-blue-600"
                    }`}>
                      {note.contentType === "pdf"   ? <FileText className="w-3 h-3" /> :
                       note.contentType === "image" ? <Image    className="w-3 h-3" /> :
                                                      <Type     className="w-3 h-3" />}
                      {note.contentType.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">{note.subject} · {note.chapter} · Grade {note.grade}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">{note.title}</h1>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {user && <SaveButton noteId={id} uid={user.uid} />}
                  <button onClick={handleAskAi}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white rounded-xl text-xs font-semibold hover:bg-indigo-600 transition-all">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ask AI</span>
                  </button>
                  <button onClick={() => setFocusMode(true)}
                    className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all" title="Focus mode">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50">
                <Link href="/notes" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                  <ArrowLeft className="w-3 h-3" /> All Notes
                </Link>
                <span className="text-gray-200">·</span>
                <Link href="/notes" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                  More {note.subject} notes
                </Link>
                <span className="text-gray-200">·</span>
                <a href={note.contentType !== "text" ? note.content : undefined}
                   target="_blank" rel="noopener noreferrer"
                   className={`inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors ${note.contentType === "text" ? "pointer-events-none opacity-40" : ""}`}>
                  <ExternalLink className="w-3 h-3" /> Open file
                </a>
              </div>
            </div>

            {!user && (
              <div className="mb-5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white text-sm">Get full access — it's free!</p>
                  <p className="text-blue-100 text-xs mt-0.5">Nep AI tutor · Track your progress · Pomodoro · Leaderboard</p>
                </div>
                <Link href="/login"
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-all flex-shrink-0 w-full sm:w-auto justify-center">
                  Register Free →
                </Link>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              {note.contentType === "text" && (
                <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
                  <article className="prose prose-gray max-w-none text-gray-800 text-[16px] leading-[1.9] whitespace-pre-wrap">
                    {note.content}
                  </article>
                </div>
              )}
              {note.contentType === "pdf" && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">PDF Document</p>
                    <a href={note.content} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
                    </a>
                  </div>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(note.content)}&embedded=true`}
                    className="w-full rounded-2xl border border-gray-100 min-h-[500px] sm:min-h-[640px]"
                    title={note.title}
                  />
                </div>
              )}
              {note.contentType === "image" && (
                <div className="flex flex-col items-center gap-4 p-8">
                  <div className="relative group cursor-zoom-in" onClick={() => setImgZoomed(true)}>
                    <img src={note.content} alt={note.title}
                      className="max-w-full rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                      style={{ maxHeight: "70vh", objectFit: "contain" }} />
                    <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <ZoomIn className="w-3 h-3" /> Click image to zoom · Press Maximize for fullscreen reading
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Don't understand something?</p>
                  <p className="text-xs text-gray-500">Ask Nep AI to explain this note to you</p>
                </div>
              </div>
              <button onClick={handleAskAi}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-all flex-shrink-0">
                <Sparkles className="w-4 h-4" /> Ask AI
              </button>
            </div>

            {!user && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-center mb-6">
                <h2 className="text-lg font-bold text-white mb-1">Want more? Get full access — free.</h2>
                <p className="text-blue-100 text-sm mb-4">Nep AI tutor, progress tracking, Report Card, and thousands more notes.</p>
                <Link href="/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all">
                  Login / Register — It's Free
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
