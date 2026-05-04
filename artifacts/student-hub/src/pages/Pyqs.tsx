import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { PublicLayout } from "@/components/PublicLayout";
import { useListPyqs, getListPyqsQueryKey } from "@workspace/api-client-react";
import { FileText, Image, Search, X, ExternalLink, Filter, LogIn } from "lucide-react";

type Pyq = {
  id: number;
  grade: number;
  subject: string;
  title: string;
  year: number;
  pdfUrl: string;
  fileType?: string | null;
};

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

function PyqViewer({ pyq, onClose }: { pyq: Pyq; onClose: () => void }) {
  const isImage = pyq.fileType === "image";
  const [imgZoomed, setImgZoomed] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${isImage ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}`}>
                {isImage ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                {isImage ? "Image" : "PDF"}
              </span>
              <span className="text-xs text-gray-400">{pyq.subject} · {pyq.year}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">{pyq.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-all">
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-all">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6 min-h-0">
          {isImage ? (
            <div className="flex flex-col items-center gap-3 h-full">
              <img src={pyq.pdfUrl} alt={pyq.title} onClick={() => setImgZoomed(true)}
                   className="max-w-full rounded-2xl shadow-sm cursor-zoom-in hover:opacity-95"
                   style={{ maxHeight: "65vh", objectFit: "contain" }} />
              <p className="text-xs text-gray-400">Click to zoom</p>
              {imgZoomed && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center cursor-zoom-out" onClick={() => setImgZoomed(false)}>
                  <img src={pyq.pdfUrl} alt={pyq.title} className="max-w-full max-h-full object-contain p-4" />
                  <button className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30" onClick={() => setImgZoomed(false)}>
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 h-full min-h-[400px] sm:min-h-[520px]">
              <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(pyq.pdfUrl)}&embedded=true`}
                      className="flex-1 w-full rounded-2xl border border-gray-100 min-h-[400px]" title={pyq.title} />
              <p className="text-xs text-center text-gray-400">
                If the PDF doesn't load, <a href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">open it directly</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PyqsContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { profile } = useAuth();
  const [grade, setGrade] = useState<number>(profile?.grade || 10);
  const [subject, setSubject] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [viewer, setViewer] = useState<Pyq | null>(null);

  const { data: pyqs, isLoading } = useListPyqs(
    { grade, ...(subject ? { subject } : {}) },
    { query: { queryKey: getListPyqsQueryKey({ grade, subject }) } }
  );

  const subjects = useMemo(() => [...new Set((pyqs || []).map(p => p.subject))].sort(), [pyqs]);
  const years = useMemo(
    () => [...new Set((pyqs || []).map(p => String(p.year)))].sort((a, b) => Number(b) - Number(a)),
    [pyqs]
  );

  const filtered = useMemo(() => {
    return (pyqs || []).filter(p => {
      if (yearFilter && String(p.year) !== yearFilter) return false;
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [pyqs, yearFilter, search]);

  return (
    <>
      {viewer && <PyqViewer pyq={viewer as Pyq} onClose={() => setViewer(null)} />}

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Previous Year Questions</h1>
          <p className="text-gray-500 text-sm">Past exam papers — click any card to view</p>
        </div>

        {/* Login CTA for unauthenticated users */}
        {!isLoggedIn && (
          <div className="mb-5 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-blue-900 text-sm">Get full access — free</p>
              <p className="text-blue-700 text-xs mt-0.5">MCQ practice, AI tools, progress tracking &amp; more</p>
            </div>
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-all flex-shrink-0 w-full sm:w-auto justify-center"
            >
              <LogIn className="w-3.5 h-3.5" /> Login / Register
            </Link>
          </div>
        )}

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-5">
          <select data-testid="select-grade-pyq" value={grade}
            onChange={(e) => { setGrade(Number(e.target.value)); setSubject(""); setYearFilter(""); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>

          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title…"
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Subject chips */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-5">
          <button onClick={() => setSubject("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            All Subjects
          </button>
          {subjects.map((s) => (
            <button key={s} onClick={() => setSubject(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>

        {!isLoading && (
          <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            {filtered.length} paper{filtered.length !== 1 ? "s" : ""} found
            {search && <span className="ml-1 text-blue-500 font-medium">for "{search}"</span>}
          </p>
        )}

        {/* Cards */}
        {isLoading ? (
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
              const isImage = pyq.fileType === "image";
              return (
                <div key={pyq.id} className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md hover:border-blue-100 transition-all group w-full">
                  <button
                    data-testid={`pyq-item-${pyq.id}`}
                    onClick={() => setViewer(pyq as Pyq)}
                    className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 text-left"
                  >
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isImage ? "bg-purple-50" : "bg-orange-50"}`}>
                      {isImage ? <Image className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" /> : <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                        <HighlightedText text={pyq.title} query={search} />
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{pyq.subject} · {pyq.year}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2 sm:ml-3">
                    <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${isImage ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}`}>
                      {isImage ? "Image" : "PDF"}
                    </span>
                    <Link
                      href={`/pyq/${pyq.id}`}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      title="Open page"
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
  const { user, loading } = useAuth();

  const meta = (
    <Helmet>
      <title>Previous Year Questions (PYQ) — Grade 9, 10, 11, 12 | Student Hub</title>
      <meta name="description" content="Free previous year exam papers for Nepal students in Grades 9–12. Browse by grade, subject, and year. PDF and image formats available." />
      <meta name="keywords" content="PYQ nepal, previous year questions, SEE question paper, NEB past paper, grade 10 exam paper" />
      <meta property="og:title" content="Previous Year Questions — Student Hub" />
      <meta property="og:description" content="Free PYQs for Grade 9–12 students in Nepal. Browse by grade, subject, and year." />
    </Helmet>
  );

  if (loading) return null;

  if (!user) {
    return (
      <>
        {meta}
        <PublicLayout>
          <PyqsContent isLoggedIn={false} />
        </PublicLayout>
      </>
    );
  }

  return (
    <>
      {meta}
      <Layout>
        <PyqsContent isLoggedIn={true} />
      </Layout>
    </>
  );
}
