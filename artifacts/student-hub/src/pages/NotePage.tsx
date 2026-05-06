import { useRef, useCallback, useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useGetNote } from "@workspace/api-client-react";
import { ArrowLeft, FileText, Image, Type, ExternalLink, ZoomIn, X, BookOpen } from "lucide-react";
import { db } from "@/lib/firebase";
import { getDoc, doc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface SeoMeta {
  seoTitle: string;
  description: string;
  keywords: string;
  noIndex: boolean;
}

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function NotePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const [imgZoomed, setImgZoomed] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [seoMeta, setSeoMeta] = useState<SeoMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: note, isLoading, isError } = useGetNote(
    id,
    { query: { enabled: !isNaN(id) && id > 0 } }
  );

  useEffect(() => {
    if (!id || isNaN(id)) return;
    getDoc(doc(db, "seo_meta", `note_${id}`))
      .then(snap => { if (snap.exists()) setSeoMeta(snap.data() as SeoMeta); })
      .catch(() => {});
  }, [id]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = el.scrollHeight <= el.clientHeight
      ? 100
      : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
    setScrollPct(pct);
  }, []);

  const canonicalSlug = note
    ? `grade-${note.grade}-${toSlug(note.subject)}-${toSlug(note.title)}`
    : "";

  const metaTitle = seoMeta?.seoTitle || (note
    ? `${note.title} — Grade ${note.grade} ${note.subject} Notes | Student Hub`
    : "Note | Student Hub");
  const metaDesc = seoMeta?.description || (note
    ? `Study notes for ${note.subject}, Grade ${note.grade} — ${note.chapter}. ${note.contentType === "text" ? note.content.slice(0, 120) + "…" : "Download or view the PDF/image."}`
    : "");
  const metaKeywords = seoMeta?.keywords || (note
    ? `${note.subject} notes, grade ${note.grade} notes, ${note.chapter}, Nepal SEE NEB notes`
    : "");

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

      <>
        {/* Scroll progress */}
        <div className="h-1 bg-gray-100 fixed top-14 left-0 right-0 z-20">
          <div className="h-full bg-blue-500 transition-all duration-150" style={{ width: `${scrollPct}%` }} />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
            <Link href="/notes" className="hover:text-blue-600 transition-colors">Notes</Link>
            {note && (
              <>
                <span>/</span>
                <span className="text-gray-600">Grade {note.grade}</span>
                <span>/</span>
                <span className="text-gray-600">{note.subject}</span>
                <span>/</span>
                <span className="text-gray-900 font-medium truncate">{note.title}</span>
              </>
            )}
          </nav>

          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 bg-gray-100 rounded-xl w-3/4" />
              <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
              <div className="h-64 bg-gray-100 rounded-2xl mt-6" />
            </div>
          )}

          {isError && (
            <div className="text-center py-16 text-gray-400">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-600">Note not found</p>
              <Link href="/notes" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Notes
              </Link>
            </div>
          )}

          {note && (
            <div ref={scrollRef} onScroll={handleScroll} className="overflow-auto">
              {/* Sticky header */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 sticky top-16 z-10">
                <div className="flex items-start gap-3">
                  <Link
                    href="/notes"
                    className="p-2 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0 mt-0.5"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-500" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        note.contentType === "pdf" ? "bg-red-50 text-red-600"
                        : note.contentType === "image" ? "bg-purple-50 text-purple-600"
                        : "bg-blue-50 text-blue-600"
                      }`}>
                        {note.contentType === "pdf" ? <FileText className="w-3 h-3" /> : note.contentType === "image" ? <Image className="w-3 h-3" /> : <Type className="w-3 h-3" />}
                        {note.contentType.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">{note.subject} · {note.chapter} · Grade {note.grade}</span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{note.title}</h1>
                  </div>
                </div>
              </div>

              {/* Back / See other notes bar */}
              <div className="flex items-center gap-4 mb-4">
                <Link
                  href="/notes"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Notes
                </Link>
                <span className="text-gray-200">|</span>
                <Link
                  href="/notes"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                  See other {note.subject} notes
                </Link>
              </div>

              {/* Content */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {note.contentType === "text" && (
                  <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
                    <article className="prose prose-gray max-w-none text-gray-800 text-[16px] leading-[1.9] whitespace-pre-wrap">
                      {note.content}
                    </article>
                  </div>
                )}

                {note.contentType === "pdf" && (
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500">PDF Document</p>
                      <a
                        href={note.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open in new tab
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
                    <div
                      className="relative group cursor-zoom-in"
                      onClick={() => setImgZoomed(true)}
                    >
                      <img
                        src={note.content}
                        alt={note.title}
                        className="max-w-full rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                        style={{ maxHeight: "68vh", objectFit: "contain" }}
                      />
                      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                        <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" /> Click to zoom
                    </p>

                    {imgZoomed && (
                      <div
                        className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center cursor-zoom-out"
                        onClick={() => setImgZoomed(false)}
                      >
                        <img
                          src={note.content}
                          alt={note.title}
                          className="max-w-full max-h-full object-contain p-6"
                        />
                        <button
                          className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all"
                          onClick={() => setImgZoomed(false)}
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CTA — only shown to guests */}
              {!user && (
                <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-center">
                  <h2 className="text-lg font-bold text-white mb-1">Want more? Get full access — free.</h2>
                  <p className="text-blue-100 text-sm mb-4">Nep AI tutor, progress tracking, Report Card, and thousands more notes.</p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all"
                  >
                    Login / Register — It's Free
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    </>
  );
}
