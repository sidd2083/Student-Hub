import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListNotes, useListNoteSubjects, getListNotesQueryKey } from "@workspace/api-client-react";
import { BookOpen, ChevronRight, FileText, Image, Type, X, ExternalLink, ZoomIn } from "lucide-react";

type NoteView = {
  id: number;
  title: string;
  subject: string;
  chapter: string;
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

function NoteViewer({ note, onClose }: { note: NoteView; onClose: () => void }) {
  const [imgZoomed, setImgZoomed] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = el.scrollHeight <= el.clientHeight
      ? 100
      : Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
    setScrollPct(pct);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Scroll progress bar */}
        <div className="h-0.5 bg-gray-100 flex-shrink-0">
          <div
            className="h-full bg-blue-500 transition-all duration-150"
            style={{ width: `${scrollPct}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <ContentTypeBadge type={note.contentType} />
              <span className="text-xs text-gray-400">{note.subject} · {note.chapter}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{note.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-all flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto"
        >
          {note.contentType === "text" && (
            <div className="max-w-2xl mx-auto px-8 py-10">
              <article className="text-gray-800 text-[16px] leading-[1.85] space-y-4 whitespace-pre-wrap font-[system-ui]">
                {note.content}
              </article>
            </div>
          )}

          {note.contentType === "pdf" && (
            <div className="flex flex-col h-full min-h-[540px] p-6 gap-3">
              <div className="flex items-center justify-between flex-shrink-0">
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
                className="flex-1 w-full rounded-2xl border border-gray-100 min-h-[500px]"
                title={note.title}
              />
            </div>
          )}

          {note.contentType === "image" && (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="relative group cursor-zoom-in" onClick={() => setImgZoomed(true)}>
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
                <ZoomIn className="w-3 h-3" /> Click image to zoom
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
      </div>
    </div>
  );
}

export default function Notes() {
  const { profile } = useAuth();
  const [grade, setGrade] = useState<number>(profile?.grade || 10);
  const [subject, setSubject] = useState<string>("");
  const [selectedNote, setSelectedNote] = useState<NoteView | null>(null);

  const { data: subjects, isLoading: loadingSubjects } = useListNoteSubjects(
    { grade },
    { query: { queryKey: getListNotesQueryKey({ grade }) } }
  );
  const { data: notes, isLoading: loadingNotes } = useListNotes(
    { grade, ...(subject ? { subject } : {}) },
    { query: { queryKey: getListNotesQueryKey({ grade, subject }) } }
  );

  return (
    <Layout>
      {selectedNote && (
        <NoteViewer note={selectedNote} onClose={() => setSelectedNote(null)} />
      )}

      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Notes</h1>
          <p className="text-gray-500 text-sm">Study materials organised by grade and subject</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            data-testid="select-grade-notes"
            value={grade}
            onChange={(e) => { setGrade(Number(e.target.value)); setSubject(""); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSubject("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              All
            </button>
            {loadingSubjects
              ? [1, 2, 3].map(i => <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />)
              : (subjects || []).map((s) => (
                <button
                  key={s}
                  data-testid={`filter-subject-${s}`}
                  onClick={() => setSubject(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {s}
                </button>
              ))
            }
          </div>
        </div>

        {/* Note list */}
        {loadingNotes ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (notes || []).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No notes found for this selection</p>
            <p className="text-sm mt-1">Try a different grade or subject</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(notes || []).map((note) => (
              <button
                key={note.id}
                data-testid={`note-item-${note.id}`}
                onClick={() => setSelectedNote(note)}
                className="w-full flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm hover:border-blue-100 transition-all text-left group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    note.contentType === "pdf" ? "bg-red-50" : note.contentType === "image" ? "bg-purple-50" : "bg-blue-50"
                  }`}>
                    {note.contentType === "pdf"   && <FileText className="w-5 h-5 text-red-500"    />}
                    {note.contentType === "image" && <Image    className="w-5 h-5 text-purple-500" />}
                    {note.contentType === "text"  && <Type     className="w-5 h-5 text-blue-500"   />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{note.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{note.subject} · {note.chapter}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <ContentTypeBadge type={note.contentType} />
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
