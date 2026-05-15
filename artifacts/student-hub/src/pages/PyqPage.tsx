import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { collection, doc, getDoc, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, FileText, ImageIcon, ExternalLink, X, BookOpen, Bookmark, Download, ChevronRight, Plus, Minus, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface FirePyq {
  id: string;
  grade: number;
  subject: string;
  title: string;
  year: number;
  pdfUrl: string;
  fileType?: string;
  contentType?: "file" | "rich";
  content?: string;
  createdAt: string;
}

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveButton({ pyqId, uid }: { pyqId: string; uid: string }) {
  const savedDocId = `${uid}_pyq_${pyqId}`;
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "saved_items", savedDocId))
      .then(snap => setSaved(snap.exists()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savedDocId]);

  const toggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (saved) {
        await deleteDoc(doc(db, "saved_items", savedDocId));
        setSaved(false);
      } else {
        await setDoc(doc(db, "saved_items", savedDocId), {
          uid, itemType: "pyq", itemId: pyqId,
          savedAt: new Date().toISOString(),
        });
        setSaved(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      title={saved ? "Remove from saved" : "Save this paper"}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl transition-all disabled:opacity-50 ${
        saved ? "bg-blue-500 text-white hover:bg-blue-600" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      <Bookmark className={`w-3.5 h-3.5 ${saved ? "fill-white" : ""}`} />
      <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
    </button>
  );
}

// ─── Suggested Papers ─────────────────────────────────────────────────────────

function SuggestedPyqs({ current }: { current: FirePyq }) {
  const [suggestions, setSuggestions] = useState<FirePyq[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    getDocs(collection(db, "pyqs"))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as FirePyq));
        const scored = all
          .filter(p => p.id !== current.id)
          .map(p => ({
            pyq: p,
            score:
              (p.year    === current.year    ? 3 : 0) +
              (p.subject === current.subject ? 2 : 0) +
              (p.grade   === current.grade   ? 1 : 0),
          }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score || b.pyq.year - a.pyq.year)
          .slice(0, 5)
          .map(x => x.pyq);
        setSuggestions(scored);
      })
      .catch(console.error);
  }, [current.id, current.year, current.subject, current.grade]);

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Related Papers</h2>
      <div className="space-y-2">
        {suggestions.map(p => {
          const isImg  = p.contentType === "rich" ? false : p.fileType === "image";
          const isRich = p.contentType === "rich";
          return (
            <button
              key={p.id}
              onClick={() => setLocation(`/pyq/${p.id}`)}
              className="w-full flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all text-left"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isRich ? "bg-indigo-50 dark:bg-indigo-950" : isImg ? "bg-purple-50 dark:bg-purple-950" : "bg-orange-50 dark:bg-orange-950"
              }`}>
                {isRich
                  ? <BookOpen className="w-4 h-4 text-indigo-500" />
                  : isImg
                    ? <ImageIcon className="w-4 h-4 text-purple-500" />
                    : <FileText className="w-4 h-4 text-orange-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{p.subject} · Grade {p.grade} · {p.year}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PyqPage() {
  const params = useParams<{ id: string }>();
  const id = params.id || "";
  const [imgZoomed, setImgZoomed] = useState(false);
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const openLightbox = () => { setImgZoomed(true); setZoom(1); setPan({ x: 0, y: 0 }); };
  const closeLightbox = () => { setImgZoomed(false); setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoom(prev => Math.max(1, Math.min(5, prev * (e.deltaY < 0 ? 1.12 : 0.89))));
  };

  const handleDblClick = () => setZoom(prev => prev > 1.2 ? 1 : 2.5);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.x, y: dragStart.current.py + e.clientY - dragStart.current.y });
  };
  const handleMouseUp = () => { isDragging.current = false; };

  const getTouchDist = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { lastTouchDist.current = getTouchDist(e); lastPanPos.current = null; }
    else if (e.touches.length === 1) { lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const d = getTouchDist(e);
      if (d && lastTouchDist.current) setZoom(prev => Math.max(1, Math.min(5, prev * d / lastTouchDist.current!)));
      lastTouchDist.current = d;
    } else if (e.touches.length === 1 && lastPanPos.current && zoom > 1) {
      const dx = e.touches[0].clientX - lastPanPos.current.x;
      const dy = e.touches[0].clientY - lastPanPos.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = () => { lastTouchDist.current = null; lastPanPos.current = null; };
  const [pyq, setPyq] = useState<FirePyq | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getDoc(doc(db, "pyqs", id))
      .then(snap => {
        if (snap.exists()) setPyq({ id: snap.id, ...snap.data() } as FirePyq);
        else setPyq(null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const isRich  = pyq?.contentType === "rich" || pyq?.fileType === "rich";
  const isImage = !isRich && pyq?.fileType === "image";

  return (
    <>
      {/* Image lightbox — for both standalone images and images inside rich text */}
      {zoomedSrc && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
          onClick={() => setZoomedSrc(null)}
        >
          <img src={zoomedSrc} alt="" className="max-w-full max-h-full object-contain p-6 select-none" />
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
            onClick={(e) => { e.stopPropagation(); setZoomedSrc(null); }}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {pyq && (
        <Helmet>
          <title>{`${pyq.title} — Grade ${pyq.grade} ${pyq.subject} PYQ ${pyq.year} | Student Hub`}</title>
          <meta name="description" content={`Previous year question paper: ${pyq.subject}, Grade ${pyq.grade}, ${pyq.year}. ${pyq.title}. Free to view and download.`} />
          <meta name="keywords" content={`${pyq.subject} PYQ, grade ${pyq.grade} past paper, ${pyq.year} exam paper, Nepal SEE NEB question paper`} />
          <meta property="og:title" content={`${pyq.title} — Student Hub`} />
          <meta property="og:description" content={`${pyq.subject} | Grade ${pyq.grade} | ${pyq.year}`} />
          <link rel="canonical" href={`https://studenthub.np/pyq/${id}`} />
        </Helmet>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
          <Link href="/pyqs" className="hover:text-blue-600 transition-colors">Previous Year Questions</Link>
          {pyq && (
            <>
              <span>/</span>
              <span className="text-gray-600 dark:text-gray-400">Grade {pyq.grade}</span>
              <span>/</span>
              <span className="text-gray-600 dark:text-gray-400">{pyq.subject}</span>
              <span>/</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{pyq.title}</span>
            </>
          )}
        </nav>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-100 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
            <div className="h-96 bg-gray-100 rounded-2xl mt-6" />
          </div>
        )}

        {/* Not found */}
        {!loading && !pyq && (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-600">Paper not found</p>
            <Link href="/pyqs" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to PYQs
            </Link>
          </div>
        )}

        {pyq && (
          <>
            {/* Header card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
              <div className="flex items-start gap-3">
                <Link href="/pyqs" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex-shrink-0 mt-0.5">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      isRich  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400" :
                      isImage ? "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400" :
                               "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                    }`}>
                      {isRich  ? <BookOpen className="w-3 h-3" /> :
                       isImage ? <ImageIcon className="w-3 h-3" /> :
                                 <FileText  className="w-3 h-3" />}
                      {isRich ? "Text" : isImage ? "Image" : "PDF"}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{pyq.subject} · {pyq.year} · Grade {pyq.grade}</span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{pyq.title}</h1>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {user && <SaveButton pyqId={id} uid={user.uid} />}
                  {isImage && pyq.pdfUrl && (
                    <a href={pyq.pdfUrl} download
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-600 border border-green-200 rounded-xl hover:bg-green-50 transition-all">
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                  )}
                  {!isRich && pyq.pdfUrl && (
                    <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-all">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Open</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Content area */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-6">

              {/* Rich text content — clicking any image zooms it */}
              {isRich && pyq.content && (
                <div
                  className="prose prose-sm sm:prose max-w-none p-6 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: pyq.content }}
                  onClick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.tagName === "IMG") setZoomedSrc((t as HTMLImageElement).src);
                  }}
                  style={{ cursor: "default" }}
                />
              )}

              {/* Image content */}
              {isImage && pyq.pdfUrl && (
                <div className="flex flex-col items-center gap-4 p-8">
                  <img
                    src={pyq.pdfUrl}
                    alt={pyq.title}
                    onClick={openLightbox}
                    className="max-w-full rounded-2xl shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity"
                    style={{ maxHeight: "70vh", objectFit: "contain" }}
                  />
                  <p className="text-xs text-gray-400">Click to open · Scroll or pinch to zoom · Drag to pan</p>
                  {imgZoomed && (
                    <div
                      className="fixed inset-0 bg-black/92 z-[60] flex items-center justify-center select-none"
                      style={{ cursor: zoom > 1 ? "grab" : "default" }}
                      onWheel={handleWheel}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      <img
                        src={pyq.pdfUrl}
                        alt={pyq.title}
                        onDoubleClick={handleDblClick}
                        draggable={false}
                        style={{
                          maxWidth: "90vw",
                          maxHeight: "88vh",
                          objectFit: "contain",
                          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                          transformOrigin: "center center",
                          transition: isDragging.current ? "none" : "transform 0.12s ease-out",
                          touchAction: "none",
                          userSelect: "none",
                        }}
                      />

                      {/* Top bar */}
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                        <button onClick={e => { e.stopPropagation(); setZoom(prev => Math.max(1, +(prev / 1.3).toFixed(2))); }}
                          className="w-7 h-7 flex items-center justify-center text-white hover:text-gray-300 transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-white text-xs font-medium w-10 text-center">{Math.round(zoom * 100)}%</span>
                        <button onClick={e => { e.stopPropagation(); setZoom(prev => Math.min(5, +(prev * 1.3).toFixed(2))); }}
                          className="w-7 h-7 flex items-center justify-center text-white hover:text-gray-300 transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-4 bg-white/20 mx-0.5" />
                        <button onClick={e => { e.stopPropagation(); setZoom(1); setPan({ x: 0, y: 0 }); }}
                          className="w-7 h-7 flex items-center justify-center text-white hover:text-gray-300 transition-colors">
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Close */}
                      <button
                        className="absolute top-4 right-4 w-9 h-9 bg-white/15 rounded-full flex items-center justify-center hover:bg-white/25 transition-colors"
                        onClick={e => { e.stopPropagation(); closeLightbox(); }}
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>

                      {/* Download */}
                      <a href={pyq.pdfUrl} download onClick={e => e.stopPropagation()}
                        className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 bg-white/15 text-white rounded-xl text-sm hover:bg-white/25 transition-colors backdrop-blur-sm">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>

                      {/* Hint */}
                      <p className="absolute bottom-4 left-4 text-white/40 text-xs">Double-tap to zoom · Pinch to zoom on mobile</p>
                    </div>
                  )}
                </div>
              )}

              {/* PDF content */}
              {!isRich && !isImage && pyq.pdfUrl && (
                <div className="p-6 space-y-3">
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(pyq.pdfUrl)}&embedded=true`}
                    className="w-full rounded-2xl border border-gray-100 min-h-[500px] sm:min-h-[640px]"
                    title={pyq.title}
                  />
                  <p className="text-xs text-center text-gray-400">
                    If the PDF doesn't load,{" "}
                    <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      open it directly
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Suggested papers */}
            <SuggestedPyqs current={pyq} />

            {/* CTA for logged-out users */}
            {!user && !profile && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-center mt-6">
                <h2 className="text-lg font-bold text-white mb-1">Get full access — it's free</h2>
                <p className="text-blue-100 text-sm mb-4">Access Nep AI, Pomodoro timer, progress tracking, and more.</p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all"
                >
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
