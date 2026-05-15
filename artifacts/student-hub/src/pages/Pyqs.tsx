import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FileText, Image, Search, X, ExternalLink, Filter, LogIn,
  Bookmark, ZoomIn, ZoomOut,
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

function detectIsImage(pyq: Pyq): boolean {
  if (pyq.fileType === "image") return true;
  if (pyq.fileType === "pdf" || pyq.fileType === "rich") return false;
  if (pyq.pdfUrl) {
    const clean = pyq.pdfUrl.split("?")[0].toLowerCase();
    return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/.test(clean);
  }
  return false;
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

function PyqGallery({ pyq, onClose, uid }: { pyq: Pyq; onClose: () => void; uid?: string }) {
  const isImage = detectIsImage(pyq);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);

  const lastPinchRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ cx: number; cy: number; ox: number; oy: number } | null>(null);

  const savedDocId = uid ? `${uid}_pyq_${pyq.id}` : null;

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
          uid, itemType: "pyq", itemId: pyq.id, savedAt: new Date().toISOString(),
        });
        setSaved(true);
      }
    } catch (e) { console.error("[PyqGallery save]", e); }
    finally { setSavingToggle(false); }
  };

  const clampScale = (s: number) => Math.min(6, Math.max(1, s));

  const zoomIn  = () => setScale(s => clampScale(s * 1.35));
  const zoomOut = () => setScale(s => {
    const next = clampScale(s / 1.35);
    if (next <= 1) setOffset({ x: 0, y: 0 });
    return next;
  });
  const resetZoom = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setScale(s => {
      const next = clampScale(s * factor);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastPinchRef.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    } else if (e.touches.length === 1 && scale > 1) {
      dragStartRef.current = {
        cx: e.touches[0].clientX, cy: e.touches[0].clientY,
        ox: offset.x, oy: offset.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinchRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = dist / lastPinchRef.current;
      setScale(s => clampScale(s * ratio));
      lastPinchRef.current = dist;
    } else if (e.touches.length === 1 && dragStartRef.current && scale > 1) {
      const dx = (e.touches[0].clientX - dragStartRef.current.cx) / scale;
      const dy = (e.touches[0].clientY - dragStartRef.current.cy) / scale;
      setOffset({ x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy });
    }
  };

  const handleTouchEnd = () => {
    lastPinchRef.current = null;
    dragStartRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { cx: e.clientX, cy: e.clientY, ox: offset.x, oy: offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current || !isDragging) return;
    const dx = (e.clientX - dragStartRef.current.cx) / scale;
    const dy = (e.clientY - dragStartRef.current.cy) / scale;
    setOffset({ x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleImgClick = () => {
    if (scale === 1) setScale(2.5);
    else resetZoom();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
      >
        <div className="flex-1 min-w-0 mr-3">
          <p className="text-white font-semibold text-sm truncate leading-tight">{pyq.title}</p>
          <p className="text-white/60 text-xs mt-0.5">{pyq.subject} · {pyq.year}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {uid && (
            <button
              onClick={toggleSave}
              disabled={savingToggle}
              className={`p-2 rounded-full transition-all ${saved ? "bg-blue-500 text-white" : "bg-white/15 text-white hover:bg-white/25"}`}
            >
              <Bookmark className={`w-4 h-4 ${saved ? "fill-white" : ""}`} />
            </button>
          )}
          <a
            href={pyq.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image / PDF viewer */}
      {isImage ? (
        <div
          className="flex-1 flex items-center justify-center overflow-hidden"
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            touchAction: "none",
            cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
          }}
        >
          <img
            src={pyq.pdfUrl}
            alt={pyq.title}
            onClick={isDragging ? undefined : handleImgClick}
            draggable={false}
            style={{
              transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
              transformOrigin: "center center",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transition: isDragging ? "none" : "transform 0.18s cubic-bezier(0.22,1,0.36,1)",
              userSelect: "none",
              display: "block",
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col pt-14 pb-2">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(pyq.pdfUrl)}&embedded=true`}
            className="flex-1 w-full border-0"
            title={pyq.title}
          />
          <p className="text-center text-xs text-white/40 py-2">
            If PDF doesn't load,{" "}
            <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              open directly
            </a>
          </p>
        </div>
      )}

      {/* Bottom zoom bar — image only */}
      {isImage && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-6 pt-8"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
        >
          <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10">
            <button
              onClick={zoomOut}
              disabled={scale <= 1}
              className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              className="text-white/70 text-xs font-mono min-w-[42px] text-center hover:text-white transition-colors tabular-nums"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={scale >= 6}
              className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          {scale === 1 && (
            <p className="absolute bottom-1 text-white/35 text-[10px]">
              Tap · pinch · scroll to zoom
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PyqsContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { profile, user } = useAuth();
  const [grade, setGrade] = useState<number>(profile?.grade || 10);
  const [subject, setSubject] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [viewer, setViewer] = useState<Pyq | null>(null);
  const [pyqs, setPyqs] = useState<Pyq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSubject("");
    setYearFilter("");
    const q = query(collection(db, "pyqs"), where("grade", "==", grade));
    getDocs(q).then(snap => {
      const list: Pyq[] = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Pyq))
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      setPyqs(list);
    }).catch(e => {
      console.error("[Pyqs] Load failed:", e);
      setPyqs([]);
    }).finally(() => setLoading(false));
  }, [grade]);

  const subjects = useMemo(() => [...new Set(pyqs.map(p => p.subject))].sort(), [pyqs]);
  const years = useMemo(
    () => [...new Set(pyqs.map(p => String(p.year)))].sort((a, b) => Number(b) - Number(a)),
    [pyqs]
  );

  const filtered = useMemo(() => {
    return pyqs.filter(p => {
      if (subject && p.subject !== subject) return false;
      if (yearFilter && String(p.year) !== yearFilter) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [pyqs, subject, yearFilter, search]);

  return (
    <>
      {viewer && <PyqGallery pyq={viewer} onClose={() => setViewer(null)} uid={user?.uid} />}

      <div className="p-4 sm:p-6 lg:p-8">
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
          <select
            data-testid="select-grade-pyq"
            value={grade}
            onChange={(e) => { setGrade(Number(e.target.value)); setSubject(""); setYearFilter(""); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title…"
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-5">
          <button
            onClick={() => setSubject("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            All Subjects
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
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
            {filtered.map((pyq) => {
              const isImg = detectIsImage(pyq);
              return (
                <div
                  key={pyq.id}
                  className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md hover:border-blue-100 transition-all group w-full"
                >
                  <button
                    data-testid={`pyq-item-${pyq.id}`}
                    onClick={() => setViewer(pyq)}
                    className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 text-left"
                  >
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isImg ? "bg-purple-50" : "bg-orange-50"}`}>
                      {isImg
                        ? <Image className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                        : <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                        <HighlightedText text={pyq.title} query={search} />
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{pyq.subject} · {pyq.year}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2 sm:ml-3">
                    <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${isImg ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}`}>
                      {isImg ? "Image" : "PDF"}
                    </span>
                    <Link
                      href={`/pyq/${pyq.id}`}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      title="Open full page"
                      className="p-1 text-gray-300 hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
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
        <meta property="og:title" content="Previous Year Questions — Student Hub" />
        <meta property="og:description" content="Free PYQs for Grade 9–12 students in Nepal. Browse by grade, subject, and year." />
      </Helmet>
      <PyqsContent isLoggedIn={!!(user || profile)} />
    </>
  );
}
