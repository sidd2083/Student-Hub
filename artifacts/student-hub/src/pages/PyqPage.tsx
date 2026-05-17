import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft, FileText, ImageIcon, ExternalLink, ZoomIn, X,
  BookOpen, Maximize2, Minimize2, ChevronRight, Bookmark,
  ZoomOut, Maximize,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  getDoc, doc, setDoc, deleteDoc, getDocs, collection,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { createPortal } from "react-dom";

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
  createdAt?: string;
}

interface SeoMeta {
  seoTitle: string;
  description: string;
  keywords: string;
  noIndex: boolean;
  canonicalUrl: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
  twitterImage: string;
  structuredData: string;
}

// ── Full-screen image lightbox ────────────────────────────────────────────────
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale]         = useState(1);
  const [offset, setOffset]       = useState({ x: 0, y: 0 });
  const [isDragging, setDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const scaleRef    = useRef(1);
  const offsetRef   = useRef({ x: 0, y: 0 });
  const mouseStart  = useRef<{ cx: number; cy: number; ox: number; oy: number } | null>(null);
  const lastPinch   = useRef<number | null>(null);
  const dragStart   = useRef<{ cx: number; cy: number; ox: number; oy: number } | null>(null);
  const imgBox      = useRef<HTMLDivElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);

  const applyScale = (s: number) => {
    const v = Math.min(6, Math.max(1, s));
    scaleRef.current = v;
    setScale(v);
    if (v <= 1) { offsetRef.current = { x: 0, y: 0 }; setOffset({ x: 0, y: 0 }); }
  };
  const applyOffset = (o: { x: number; y: number }) => { offsetRef.current = o; setOffset(o); };

  // Lock scroll + prevent viewport pinch-zoom
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevTA = document.body.style.touchAction;
    document.body.style.overflow    = "hidden";
    document.body.style.touchAction = "none";
    const block = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    document.addEventListener("touchmove", block, { passive: false });
    return () => {
      document.body.style.overflow    = prev;
      document.body.style.touchAction = prevTA;
      document.removeEventListener("touchmove", block);
    };
  }, []);

  // Escape + fullscreen listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (document.fullscreenElement) document.exitFullscreen(); else onClose(); }
    };
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFs); };
  }, [onClose]);

  // Non-passive touch: pinch-zoom + pan
  useEffect(() => {
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
    const onEnd = () => { lastPinch.current = dragStart.current = null; if (scaleRef.current <= 1) applyScale(1); };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove",  onMove,  { passive: false });
    el.addEventListener("touchend",   onEnd);
    return () => { el.removeEventListener("touchstart", onStart); el.removeEventListener("touchmove", onMove); el.removeEventListener("touchend", onEnd); };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await overlayRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };

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
  const handleImgClick = () => { if (!isDragging) applyScale(scaleRef.current > 1 ? 1 : 2.5); };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black flex flex-col select-none"
      style={{ zIndex: 9999, touchAction: "none" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 flex-shrink-0"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top,0px))", paddingBottom: "2.5rem", background: "linear-gradient(to bottom,rgba(0,0,0,0.85) 0%,transparent 100%)" }}>
        <p className="text-white font-semibold text-sm truncate flex-1 mr-2">{alt}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer"
            className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all">
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={onClose} className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div ref={imgBox}
        className="flex-1 flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
      >
        <img
          src={src}
          alt={alt}
          onClick={handleImgClick}
          draggable={false}
          style={{
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
            display: "block", userSelect: "none", pointerEvents: "none",
            transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
            transformOrigin: "center center",
            transition: (isDragging || mouseStart.current) ? "none" : "transform 0.15s ease",
          }}
        />
      </div>

      {/* Bottom zoom controls */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom,0px))", paddingTop: "3rem", background: "linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 100%)" }}>
        {scale === 1 && <p className="text-white/40 text-[10px] mb-2">Tap · pinch · scroll to zoom</p>}
        <div className="flex items-center gap-3 bg-black/50 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10">
          <button onClick={() => applyScale(scaleRef.current / 1.5)} disabled={scale <= 1}
            className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 transition-all">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => applyScale(1)}
            className="text-white/70 text-xs font-mono min-w-[42px] text-center hover:text-white transition-colors">
            {Math.round(scale * 100)}%
          </button>
          <button onClick={() => applyScale(scaleRef.current * 1.5)} disabled={scale >= 6}
            className="p-1.5 rounded-full hover:bg-white/15 text-white disabled:opacity-30 transition-all">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Focus/fullscreen reader overlay ──────────────────────────────────────────
function FocusReaderOverlay({ pyq, onClose }: { pyq: FirePyq; onClose: () => void }) {
  const [scrollPct, setScrollPct] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = el.scrollHeight <= el.clientHeight ? 100 : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
    setScrollPct(pct);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isRich  = pyq.contentType === "rich" || pyq.fileType === "rich";
  const isImage = !isRich && pyq.fileType === "image";
  const content = isRich ? (pyq.content ?? "") : pyq.pdfUrl;

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
          <p className="text-xs text-gray-400">{pyq.subject} · Grade {pyq.grade} · {pyq.year}</p>
          <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">{pyq.title}</h1>
        </div>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {isRich && (
          <div className="max-w-2xl mx-auto px-5 sm:px-10 py-10">
            <article className="prose prose-gray max-w-none text-gray-800 text-[16px] leading-[1.9]"
              dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        )}
        {isImage && (
          <div className="flex flex-col items-center gap-4 p-8">
            {lightboxOpen && <ImageLightbox src={content} alt={pyq.title} onClose={() => setLightboxOpen(false)} />}
            <div className="relative group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
              <img src={content} alt={pyq.title} className="max-w-full rounded-2xl shadow-sm" style={{ maxHeight: "80vh", objectFit: "contain" }} />
              <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </div>
          </div>
        )}
        {!isRich && !isImage && (
          <div className="h-full p-4 flex flex-col gap-3">
            <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(content)}&embedded=true`}
              className="flex-1 w-full rounded-2xl border border-gray-100 min-h-[80vh]" title={pyq.title} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Save button ───────────────────────────────────────────────────────────────
function SaveButton({ pyqId, uid }: { pyqId: string; uid: string }) {
  const savedDocId = `${uid}_pyq_${pyqId}`;
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(true);
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
      if (saved) { await deleteDoc(doc(db, "saved_items", savedDocId)); setSaved(false); }
      else { await setDoc(doc(db, "saved_items", savedDocId), { uid, itemType: "pyq", itemId: pyqId, savedAt: new Date().toISOString() }); setSaved(true); }
    } catch (e) { console.error(e); }
    finally { setToggling(false); }
  };

  if (loading) return <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />;
  return (
    <button onClick={toggle} disabled={toggling}
      title={saved ? "Remove from saved" : "Save this paper"}
      className={`p-2 rounded-xl transition-all disabled:opacity-50 ${saved ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
      <Bookmark className={`w-4 h-4 ${saved ? "fill-white" : ""}`} />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PyqPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();

  const [pyq, setPyq]         = useState<FirePyq | null>(null);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [seoMeta, setSeoMeta] = useState<SeoMeta | null>(null);
  const mainRef   = useRef<HTMLDivElement>(null);
  const richRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "seo_meta", `pyq_${id}`))
      .then(snap => { if (snap.exists()) setSeoMeta(snap.data() as SeoMeta); })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) { setIsError(true); setLoading(false); return; }
    setLoading(true);
    getDoc(doc(db, "pyqs", id))
      .then(snap => {
        if (!snap.exists()) { setIsError(true); return; }
        setPyq({ id: snap.id, ...snap.data() } as FirePyq);
      })
      .catch(() => setIsError(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = () => {
      const pct = el.scrollHeight <= el.clientHeight ? 100 : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
      setScrollPct(pct);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [pyq]);

  // Image clicks inside rich content are handled via React event delegation on the article element below.
  // (Imperative addEventListener approach broke on re-render because dangerouslySetInnerHTML
  //  replaces DOM nodes, discarding the old handlers; event delegation is immune to this.)

  const ft      = (pyq?.fileType ?? "").toLowerCase();
  const isRich  = ft === "rich" || ft === "text" || pyq?.contentType === "rich";
  const isImage = !isRich && (() => {
    if (ft === "image" || ft.startsWith("image/")) return true;
    if (ft === "pdf" || ft.startsWith("application/pdf")) return false;
    if (!pyq?.pdfUrl) return false;
    try {
      const raw  = pyq.pdfUrl.split("?")[0].toLowerCase();
      const path = decodeURIComponent(raw);
      return /\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff|avif)(\s|$)/.test(path) ||
             /\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff|avif)(\s|$)/.test(raw);
    } catch { return false; }
  })();
  const fileUrl = isRich ? undefined : pyq?.pdfUrl;
  const richContent = isRich ? (pyq?.content ?? "") : "";

  return (
    <>
      {pyq && (
        <Helmet>
          <title>{seoMeta?.seoTitle || `${pyq.title} — Grade ${pyq.grade} ${pyq.subject} PYQ ${pyq.year} | Student Hub`}</title>
          <meta name="description" content={seoMeta?.description || `Previous year question paper: ${pyq.subject}, Grade ${pyq.grade}, ${pyq.year}. Free to view and download.`} />
          {seoMeta?.keywords && <meta name="keywords" content={seoMeta.keywords} />}
          {seoMeta?.noIndex ? <meta name="robots" content="noindex,nofollow" /> : <meta name="robots" content="index,follow" />}
          <meta property="og:title" content={seoMeta?.seoTitle || `${pyq.title} — Student Hub`} />
          <meta property="og:description" content={seoMeta?.description || `Grade ${pyq.grade} ${pyq.subject} PYQ ${pyq.year}`} />
          <meta property="og:type" content={seoMeta?.ogType || "article"} />
          {seoMeta?.ogImage && <meta property="og:image" content={seoMeta.ogImage} />}
          <meta name="twitter:card" content={seoMeta?.twitterCard || "summary_large_image"} />
          {(seoMeta?.twitterImage || seoMeta?.ogImage) && (
            <meta name="twitter:image" content={seoMeta!.twitterImage || seoMeta!.ogImage} />
          )}
          <link rel="canonical" href={seoMeta?.canonicalUrl || `https://studenthubnp.com/pyq/${id}`} />
          {seoMeta?.structuredData && (() => {
            try { JSON.parse(seoMeta.structuredData); return <script type="application/ld+json">{seoMeta.structuredData}</script>; }
            catch { return null; }
          })()}
        </Helmet>
      )}

      {focusMode && pyq && <FocusReaderOverlay pyq={pyq} onClose={() => setFocusMode(false)} />}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt={pyq?.title ?? "Image"} onClose={() => setLightboxSrc(null)} />}

      <div ref={mainRef} className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto">
        {/* Progress bar */}
        {pyq && (
          <div className="mb-4 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${scrollPct}%` }} />
          </div>
        )}

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-5 flex-wrap">
          <Link href="/pyqs" className="hover:text-blue-600 transition-colors">PYQs</Link>
          {pyq && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-500">Grade {pyq.grade}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-500">{pyq.subject}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-900 font-medium truncate max-w-[160px] sm:max-w-xs">{pyq.title}</span>
            </>
          )}
        </nav>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-100 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
            <div className="h-64 bg-gray-100 rounded-2xl mt-6" />
          </div>
        )}

        {/* Not found */}
        {isError && !loading && (
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
            {/* Header card — exactly like NotePage */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
              <div className="flex items-start gap-3">
                <Link href="/pyqs" className="p-2 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0 mt-0.5">
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      isRich  ? "bg-indigo-50 text-indigo-600" :
                      isImage ? "bg-purple-50 text-purple-600" :
                                "bg-orange-50 text-orange-600"
                    }`}>
                      {isRich  ? <BookOpen   className="w-3 h-3" /> :
                       isImage ? <ImageIcon  className="w-3 h-3" /> :
                                 <FileText   className="w-3 h-3" />}
                      {isRich ? "TEXT" : isImage ? "IMAGE" : "PDF"}
                    </span>
                    <span className="text-xs text-gray-400">{pyq.subject} · {pyq.year} · Grade {pyq.grade}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">{pyq.title}</h1>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {user && <SaveButton pyqId={id} uid={user.uid} />}
                  <button onClick={() => setFocusMode(true)}
                    className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all" title="Fullscreen / Focus mode">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50">
                <Link href="/pyqs" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                  <ArrowLeft className="w-3 h-3" /> All PYQs
                </Link>
                <span className="text-gray-200">·</span>
                {fileUrl && (
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                    <ExternalLink className="w-3 h-3" /> Open file
                  </a>
                )}
              </div>
            </div>

            {/* Guest banner */}
            {!user && !profile && (
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

            {/* Content card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">

              {/* Rich text */}
              {isRich && (
                <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
                  <article
                    ref={richRef}
                    className="prose prose-gray max-w-none text-gray-800 text-[16px] leading-[1.9] prose-img-zoomable"
                    dangerouslySetInnerHTML={{ __html: richContent }}
                    onClick={(e) => {
                      const t = e.target as HTMLElement;
                      if (t.tagName === "IMG") {
                        const src = (t as HTMLImageElement).src;
                        if (src) setLightboxSrc(src);
                      }
                    }}
                  />
                </div>
              )}

              {/* Image — thumbnail + click to open proper lightbox */}
              {isImage && pyq.pdfUrl && (
                <div className="flex flex-col items-center gap-4 p-8">
                  <div className="relative group cursor-zoom-in" onClick={() => setLightboxSrc(pyq.pdfUrl)}>
                    <img
                      src={pyq.pdfUrl}
                      alt={pyq.title}
                      className="max-w-full rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                      style={{ maxHeight: "70vh", objectFit: "contain" }}
                    />
                    <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <ZoomIn className="w-3 h-3" /> Click image to open gallery · Use Maximize for fullscreen reading
                  </p>
                </div>
              )}

              {/* PDF */}
              {!isRich && !isImage && pyq.pdfUrl && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">PDF Document</p>
                    <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
                    </a>
                  </div>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(pyq.pdfUrl)}&embedded=true`}
                    className="w-full rounded-2xl border border-gray-100 min-h-[500px] sm:min-h-[640px]"
                    title={pyq.title}
                  />
                  <p className="text-xs text-center text-gray-400">
                    PDF not loading?{" "}
                    <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Open directly</a>
                  </p>
                </div>
              )}
            </div>

            {/* Bottom CTA for guests */}
            {!user && !profile && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-center mb-6">
                <h2 className="text-lg font-bold text-white mb-1">Want more? Get full access — free.</h2>
                <p className="text-blue-100 text-sm mb-4">Nep AI tutor, progress tracking, and thousands more PYQs and notes.</p>
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
