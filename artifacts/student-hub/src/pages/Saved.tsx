import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { Bookmark, BookOpen, FileText, Trash2, ExternalLink, Download } from "lucide-react";

interface SavedItem {
  id: number;
  itemType: "note" | "pyq";
  itemId: number;
  createdAt: string;
  title?: string;
  subject?: string;
  grade?: number;
  contentType?: string;
  content?: string;
  year?: number;
  fileType?: string;
  pdfUrl?: string;
}

function SavedContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/saved?uid=${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const remove = async (id: number) => {
    if (!user?.uid) return;
    try {
      await fetch(`/api/saved/${id}?uid=${user.uid}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const notes = items.filter(i => i.itemType === "note");
  const pyqs  = items.filter(i => i.itemType === "pyq");

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-blue-500" /> Saved
        </h1>
        <p className="text-gray-500 text-sm">Your saved notes and past year questions</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-gray-600">No saved items yet</p>
          <p className="text-sm mt-1 mb-6">Tap the bookmark icon on any note or past paper to save it here</p>
          <div className="flex gap-3 justify-center">
            <Link href="/notes">
              <a className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-all">
                <BookOpen className="w-4 h-4" /> Browse Notes
              </a>
            </Link>
            <Link href="/pyqs">
              <a className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">
                <FileText className="w-4 h-4" /> Browse PYQs
              </a>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {notes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" /> Notes · {notes.length}
              </h2>
              <div className="space-y-2">
                {notes.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:shadow-sm transition-all group">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/notes/${item.itemId}`}>
                        <a className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate block">
                          {item.title || `Note #${item.itemId}`}
                        </a>
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[item.subject, item.grade ? `Grade ${item.grade}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/notes/${item.itemId}`}>
                        <a className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Link>
                      <button onClick={() => remove(item.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pyqs.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Past Year Questions · {pyqs.length}
              </h2>
              <div className="space-y-2">
                {pyqs.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:shadow-sm transition-all group">
                    <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/pyq/${item.itemId}`}>
                        <a className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate block">
                          {item.title || `PYQ #${item.itemId}`}
                        </a>
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[item.subject, item.grade ? `Grade ${item.grade}` : null, item.year ? String(item.year) : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.pdfUrl && (
                        <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" download
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all"
                          title="Download">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <Link href={`/pyq/${item.itemId}`}>
                        <a className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Link>
                      <button onClick={() => remove(item.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Saved() {
  return (
    <>
      <Helmet>
        <title>Saved — Student Hub</title>
        <meta name="description" content="Your saved notes and past year questions on Student Hub." />
      </Helmet>
      <SoftGate feature="Saved items">
        <SavedContent />
      </SoftGate>
    </>
  );
}
