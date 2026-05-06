import { useState } from "react";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useListPyqs } from "@workspace/api-client-react";
import { ArrowLeft, FileText, Image, ExternalLink, X, BookOpen } from "lucide-react";

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function PyqPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [imgZoomed, setImgZoomed] = useState(false);

  const { data: allPyqs, isLoading } = useListPyqs(
    {},
    { query: { enabled: !isNaN(id) && id > 0 } }
  );

  const pyq = allPyqs?.find(p => p.id === id);
  const isImage = pyq?.fileType === "image";

  const canonicalSlug = pyq
    ? `grade-${pyq.grade}-${toSlug(pyq.subject)}-${toSlug(pyq.title)}-${pyq.year}`
    : "";

  return (
    <>
      {pyq && (
        <Helmet>
          <title>{`${pyq.title} — Grade ${pyq.grade} ${pyq.subject} PYQ ${pyq.year} | Student Hub`}</title>
          <meta name="description" content={`Previous year question paper: ${pyq.subject}, Grade ${pyq.grade}, ${pyq.year}. ${pyq.title}. Free to view and download.`} />
          <meta name="keywords" content={`${pyq.subject} PYQ, grade ${pyq.grade} past paper, ${pyq.year} exam paper, Nepal SEE NEB question paper`} />
          <meta property="og:title" content={`${pyq.title} — Student Hub`} />
          <meta property="og:description" content={`${pyq.subject} | Grade ${pyq.grade} | ${pyq.year}`} />
          <link rel="canonical" href={`https://studenthub.np/pyq/${id}-${canonicalSlug}`} />
        </Helmet>
      )}

      <>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
            <Link href="/pyqs" className="hover:text-blue-600 transition-colors">Previous Year Questions</Link>
            {pyq && (
              <>
                <span>/</span>
                <span className="text-gray-600">Grade {pyq.grade}</span>
                <span>/</span>
                <span className="text-gray-600">{pyq.subject}</span>
                <span>/</span>
                <span className="text-gray-900 font-medium truncate">{pyq.title}</span>
              </>
            )}
          </nav>

          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-8 bg-gray-100 rounded-xl w-3/4" />
              <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
              <div className="h-96 bg-gray-100 rounded-2xl mt-6" />
            </div>
          )}

          {!isLoading && !pyq && (
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
              {/* Header */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                <div className="flex items-start gap-3">
                  <Link
                    href="/pyqs"
                    className="p-2 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0 mt-0.5"
                  >
                    <ArrowLeft className="w-4 h-4 text-gray-500" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        isImage ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"
                      }`}>
                        {isImage ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {isImage ? "Image" : "PDF"}
                      </span>
                      <span className="text-xs text-gray-400">{pyq.subject} · {pyq.year} · Grade {pyq.grade}</span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900">{pyq.title}</h1>
                  </div>
                  <a
                    href={pyq.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-all flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open</span>
                  </a>
                </div>
              </div>

              {/* Viewer */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                {isImage ? (
                  <div className="flex flex-col items-center gap-4 p-8">
                    <img
                      src={pyq.pdfUrl}
                      alt={pyq.title}
                      onClick={() => setImgZoomed(true)}
                      className="max-w-full rounded-2xl shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity"
                      style={{ maxHeight: "70vh", objectFit: "contain" }}
                    />
                    <p className="text-xs text-gray-400">Click to zoom</p>
                    {imgZoomed && (
                      <div
                        className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center cursor-zoom-out"
                        onClick={() => setImgZoomed(false)}
                      >
                        <img src={pyq.pdfUrl} alt={pyq.title} className="max-w-full max-h-full object-contain p-4" />
                        <button
                          className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"
                          onClick={() => setImgZoomed(false)}
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
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

              {/* CTA */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-center">
                <h2 className="text-lg font-bold text-white mb-1">Get full access — it's free</h2>
                <p className="text-blue-100 text-sm mb-4">Access Nep AI, Pomodoro timer, progress tracking, and more — all free.</p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:bg-blue-50 transition-all"
                >
                  Login / Register — It's Free
                </Link>
              </div>
            </>
          )}
        </div>
      </>
    </>
  );
}
