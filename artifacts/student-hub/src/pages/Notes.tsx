import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListNotes, useListNoteSubjects, getListNotesQueryKey } from "@workspace/api-client-react";
import { BookOpen, ChevronRight } from "lucide-react";

export default function Notes() {
  const { profile } = useAuth();
  const [grade, setGrade] = useState<number>(profile?.grade || 10);
  const [subject, setSubject] = useState<string>("");
  const [selectedNote, setSelectedNote] = useState<null | { id: number; title: string; contentType: string; content: string }>(null);

  const { data: subjects, isLoading: loadingSubjects } = useListNoteSubjects(
    { grade },
    { query: { queryKey: getListNotesQueryKey({ grade }) } }
  );
  const { data: notes, isLoading: loadingNotes } = useListNotes(
    { grade, ...(subject ? { subject } : {}) },
    { query: { queryKey: getListNotesQueryKey({ grade, subject }) } }
  );

  const chapters = [...new Set((notes || []).filter(n => !subject || n.subject === subject).map(n => n.chapter))];

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Notes</h1>
          <p className="text-gray-500">Study materials organized by grade and subject</p>
        </div>

        {selectedNote ? (
          <div>
            <button
              data-testid="btn-back-notes"
              onClick={() => setSelectedNote(null)}
              className="flex items-center gap-2 text-sm text-blue-600 mb-6 hover:underline"
            >
              Back to notes
            </button>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-3xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{selectedNote.title}</h2>
              {selectedNote.contentType === "text" && (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedNote.content}
                </div>
              )}
              {selectedNote.contentType === "pdf" && (
                <a href={selectedNote.content} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:underline">
                  Open PDF
                </a>
              )}
              {selectedNote.contentType === "image" && (
                <img src={selectedNote.content} alt={selectedNote.title} className="max-w-full rounded-xl" />
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-6">
              <div>
                <select
                  data-testid="select-grade-notes"
                  value={grade}
                  onChange={(e) => { setGrade(Number(e.target.value)); setSubject(""); }}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSubject("")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  All
                </button>
                {(subjects || []).map((s) => (
                  <button
                    key={s}
                    data-testid={`filter-subject-${s}`}
                    onClick={() => setSubject(s)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {loadingNotes ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            ) : (notes || []).length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notes found for this selection.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(notes || []).map((note) => (
                  <button
                    key={note.id}
                    data-testid={`note-item-${note.id}`}
                    onClick={() => setSelectedNote(note)}
                    className="w-full flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm hover:border-blue-100 transition-all text-left"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{note.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{note.subject} · {note.chapter}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full capitalize">{note.contentType}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
