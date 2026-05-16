import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FileText, ImageIcon, Search, X, ExternalLink, Filter, LogIn,
  Bookmark, ZoomIn, ZoomOut, Maximize, Minimize,
} from "lucide-react";

type Pyq = {
  id: string;
  grade: number;
  subject: string;
  title: string;
  year: number;
  pdfUrl: string;
  fileType?: string | null;
};

function isRichText(pyq: Pyq): boolean {
  const ft = (pyq.fileType ?? "").toLowerCase();
  return ft === "rich" || ft === "text" || ft.startsWith("text/html");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ─── Full-screen image gallery ────────────────────────────────────────────────
// Opens for ANY PYQ that isn't rich/text type.
// Tries to load the URL as an image first; if it fails (onError) falls back to
// a PDF iframe so it always shows something useful.
function PyqGallery({ pyq, onClose, uid }: { pyq: Pyq; onClose: () => void; uid?: string }) {
  const [scale, setScale]         = useState(1);
  const [offset, setOffset]       = useState({ x: 0, y: 0 });
  const [isDragging, setDragging] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [savingToggle, setSaving] = useState(false);
  const [isFullscreen, setFullscreen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const scaleRef   = useRef(1);
  const offsetRef  = useRef({ x: 0, y: 0 });
  const lastPinch  = useRef<number | null>(null);
  const dragStart  = useRef<{ cx: number; cy: number; ox: number; oy: number } | null>(null);
  const mouseStart = useRef<{ cx: number; cy: number; ox: number; oy: number } | null>(null);
  const imgBox     = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const savedDocId = uid ? `${uid}_pyq_${pyq.id}` : null;

  const applyScale = (s: number) => {
    const v = Math.min(6, Math.max(1, s));
    scaleRef.current = v;
    setScale(v);
    if (v <= 1) { offsetRef.current = { x: 0, y: 0 }; setOffset({ x: 0, y: 0 }); }
  };
  const applyOffset = (o: { x: number; y: number }) => { offsetRef.current = o; setOffset(o); };

  // Lock scroll + block browser pinch-zoom
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const area = document.querySelector(".main-scroll-area") as HTMLElement | null;
    const prevBodyOvf = body.style.overflow;
    const prevHtmlOvf = html.style.overflow;
    const prevTA      = body.style.touchAction;
    const prevUS      = body.style.userSelect;
    const aOvf = area?.style.overflowY ?? "";
    const aPE  = area?.style.pointerEvents ?? "";

    body.style.overflow    = html.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.userSelect  = "none";
    if (area) { area.style.overflowY = "hidden"; area.style.pointerEvents = "none"; }

    const blockPinch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    document.addEventListener("touchmove", blockPinch, { passive: false });

    return () => {
      body.style.overflow    = prevBodyOvf;
      html.style.overflow    = prevHtmlOvf;
      body.style.touchAction = prevTA;
      body.style.userSelect  = prevUS;
      if (area) { area.style.overflowY = aOvf; area.style.pointerEvents = aPE; }
      document.removeEventListener("touchmove", blockPinch);
    };
  }, []);

  // Escape + fullscreen listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else onClose(); }
    };
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, [onClose]);

  // Check saved state
  useEffect(() => {
    if (!savedDocId) return;
    getDoc(doc(db, "saved_items", savedDocId)).then(s => setSaved(s.exists())).catch(() => {});
  }, [savedDocId]);

  // Non-passive touch: pinch + pan for image
  useEffect(() => {
    if (imgFailed) return;
    const el = imgBox.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastPinch.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        dragStart.current = null;
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        dragStart.current = { cx: e.touches[0].clientX, cy: e.touches[0].clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
      }
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinch.current !== null) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        applyScale(scaleRef.current * (d / lastPinch.current));
        lastPinch.current = d;
      } else if (e.touches.length === 1 && dragStart.current && scaleRef.current > 1) {
        applyOffset({
          x: dragStart.current.ox + (e.touches[0].clientX - dragStart.current.cx) / scaleRef.current,
          y: dragStart.current.oy + (e.touches[0].clientY - dragStart.current.cy) / scaleRef.current,
        });
      }
    };
    const onEnd = () => { lastPinch.current = dragStart.current = null; };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove",  onMove,  { passive: false });
    el.addEventListener("touchend",   onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
    };
  }, [imgFailed]);

  const toggleSave = async () => {
    if (!uid || !savedDocId || savingToggle) return;
    setSaving(true);
    try {
      if (saved) { await deleteDoc(doc(db, "saved_items", savedDocId)); setSaved(false); }
      else { await setDoc(doc(db, "saved_items", savedDocId), { uid, itemType: "pyq", itemId: pyq.id, savedAt: new Date().toISOString() }); setSaved(true); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await overlayRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); applyScale(scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.89)); };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    e.preventDefault();
    mouseStart.current = { cx: e.clientX, cy: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
    setDragging(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStart.current) return;
    applyOffset({ x: mouseStart.current.ox + (e.clientX - mouseStart.current.cx) / scaleRef.current, y: mouseStart.current.oy + (e.clientY - mouseStart.current.cy) / scaleRef.current });
  };
  const handleMouseUp = () => { mouseStart.current = null; setDragging(false); };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black flex flex-col select-none"
      style={{ zIndex: 9999, touchAction: imgFailed ? "auto" : "none" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 flex-shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top,0px))", paddingBottom: "2.5rem", background: "linear-gradient(to bottom,rgba(0,0,0,0.85) 0%,transparent 100%)" }}>
        <div className="flex-1 min-w-0 mr-2">
          <p className="text-white font-semibold text-sm truncate">{pyq.title}</p>
          <p className="text-white/60 text-xs mt-0.5">{pyq.subject} · {pyq.year}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {uid && (
            <button onClick={toggleSave} disabled={savingToggle}
              className={`p-2.5 rounded-full transition-all ${saved ? "bg-blue-500 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}>
              <Bookmark className={`w-4 h-4 ${saved ? "fill-white" : ""}`} />
            </button>
          )}
          <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer"
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onClose}
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content: try image first, fallback to PDF iframe */}
      {!imgFailed ? (
        <div
          ref={imgBox}
          className="flex-1 flex items-center justify-center overflow-hidden"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
          onClick={() => { if (!isDragging) applyScale(scaleRef.current > 1 ? 1 : 2.5); }}
        >
          <img
            src={pyq.pdfUrl}
            alt={pyq.title}
            onError={() => setImgFailed(true)}
            draggable={false}
            style={{
              maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
              display: "block", userSelect: "none", pointerEvents: "none",
              transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.15s ease",
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col" style={{ paddingTop: "56px" }}>
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(pyq.pdfUrl)}&embedded=true`}
            className="flex-1 w-full border-0"
            title={pyq.title}
          />
          <p className="text-center text-xs text-white/40 py-2">
            Not loading?{" "}
            <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              Open directly ↗
            </a>
          </p>
        </div>
      )}

      {/* Zoom bar (only when showing image successfully) */}
      {!imgFailed && (
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom,0px))", paddingTop: "3rem", background: "linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 100%)" }}>
          {scale === 1 && <p className="text-white/40 text-[10px] mb-2">Tap · pinch · scroll to zoom</p>}
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10">
            <button onClick={(e) => { e.stopPropagation(); applyScale(scaleRef.current / 1.5); }} disabled={scale <= 1}
              className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 transition-all">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); applyScale(1); }}
              className="text-white/70 text-xs font-mono min-w-[42px] text-center hover:text-white transition-colors">
              {Math.round(scale * 100)}%
            </button>
            <button onClick={(e) => { e.stopPropagation(); applyScale(scaleRef.current * 1.5); }} disabled={scale >= 6}
              className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 transition-all">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function PyqsContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { profile, user } = useAuth();
  const [, setLocation] = useLocation();
  const [grade, setGrade]         = useState<number>(profile?.grade || 10);
  const [subject, setSubject]     = useState("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [search, setSearch]       = useState("");
  const [viewer, setViewer]       = useState<Pyq | null>(null);
  const [pyqs, setPyqs]           = useState<Pyq[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    setSubject("");
    setYearFilter("");
    const q = query(collection(db, "pyqs"), where("grade", "==", grade));
    getDocs(q)
      .then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Pyq)).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        setPyqs(list);
      })
      .catch(e => { console.error("[Pyqs]", e); setPyqs([]); })
      .finally(() => setLoading(false));
  }, [grade]);

  const subjects = useMemo(() => [...new Set(pyqs.map(p => p.subject))].sort(), [pyqs]);
  const years    = useMemo(() => [...new Set(pyqs.map(p => String(p.year)))].sort((a, b) => Number(b) - Number(a)), [pyqs]);
  const filtered = useMemo(() => pyqs.filter(p => {
    if (subject && p.subject !== subject) return false;
    if (yearFilter && String(p.year) !== yearFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [pyqs, subject, yearFilter, search]);

  return (
    <>
      {viewer && <PyqGallery pyq={viewer} onClose={() => setViewer(null)} uid={user?.uid} />}

      <div className="p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Previous Year Questions</h1>
          <p className="text-gray-500 text-sm">Past exam papers — tap any card to view</p>
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

        <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-5">
          <select value={grade}
            onChange={e => { setGrade(Number(e.target.value)); setSubject(""); setYearFilter(""); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[9, 10, 11, 12].map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>

          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by title…"
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-5">
          <button onClick={() => setSubject("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All Subjects
          </button>
          {subjects.map(s => (
            <button key={s} onClick={() => setSubject(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>

        {!loading && (
          <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            {filtered.length} paper{filtered.length !== 1 ? "s" : ""} found
            {search && <span className="ml-1 text-blue-500 font-medium">for "{search}"</span>}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-[72px] bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No papers found</p>
            <p className="text-sm mt-1">{search ? `No results for "${search}"` : "Try adjusting your filters"}</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:gap-3">
            {filtered.map(pyq => {
              const rich = isRichText(pyq);
              return (
                <button
                  key={pyq.id}
                  onClick={() => {
                    if (rich) {
                      setLocation(`/pyq/${pyq.id}`);
                    } else {
                      setViewer(pyq);
                    }
                  }}
                  className="flex items-center gap-3 sm:gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md hover:border-blue-100 transition-all w-full min-w-0 overflow-hidden text-left"
                >
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${rich ? "bg-indigo-50" : "bg-purple-50"}`}>
                    {rich
                      ? <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                      : <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                      <HighlightedText text={pyq.title} query={search} />
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{pyq.subject} · {pyq.year}</p>
                  </div>
                  <span className={`hidden sm:inline flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${rich ? "bg-indigo-50 text-indigo-600" : "bg-purple-50 text-purple-600"}`}>
                    {rich ? "Article" : "View"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function Pyqs() {
  const { user, profile } = useAuth();

  return (
    <>
      <Helmet>
        <title>Previous Year Questions (PYQ) — Grade 9, 10, 11, 12 | Student Hub</title>
        <meta name="description" content="Free previous year exam papers for Nepal students in Grades 9–12. Browse by grade, subject, and year. PDF and image formats available." />
        <meta name="keywords" content="PYQ nepal, previous year questions, SEE question paper, NEB past paper, grade 10 exam paper" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://studenthub.np/pyqs" />
        <meta property="og:title" content="Previous Year Questions — Grade 9–12 | Student Hub" />
        <meta property="og:description" content="Free PYQs for Grade 9–12 students in Nepal. Browse by grade, subject, and year." />
        <meta property="og:image" content="https://studenthub.np/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PYQ Papers — Student Hub Nepal" />
        <meta name="twitter:description" content="Free previous year question papers for Grade 9–12 Nepal students." />
        <meta name="twitter:image" content="https://studenthub.np/og-image.png" />
        <link rel="canonical" href="https://studenthub.np/pyqs" />
      </Helmet>
      <PyqsContent isLoggedIn={!!(user || profile)} />
    </>
  );
}
