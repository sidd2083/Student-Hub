import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListPyqs, getListPyqsQueryKey } from "@workspace/api-client-react";
import { FileText, ExternalLink } from "lucide-react";

export default function Pyqs() {
  const { profile } = useAuth();
  const [grade, setGrade] = useState<number>(profile?.grade || 10);
  const [subject, setSubject] = useState("");

  const { data: pyqs, isLoading } = useListPyqs(
    { grade, ...(subject ? { subject } : {}) },
    { query: { queryKey: getListPyqsQueryKey({ grade, subject }) } }
  );

  const subjects = [...new Set((pyqs || []).map(p => p.subject))];

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Previous Year Questions</h1>
          <p className="text-gray-500">Past exam papers organized by grade and subject</p>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            data-testid="select-grade-pyq"
            value={grade}
            onChange={(e) => { setGrade(Number(e.target.value)); setSubject(""); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setSubject("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              All
            </button>
            {subjects.map((s) => (
              <button key={s} onClick={() => setSubject(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : (pyqs || []).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No previous year questions found.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {(pyqs || []).map((pyq) => (
              <a key={pyq.id} href={pyq.pdfUrl} target="_blank" rel="noopener noreferrer"
                data-testid={`pyq-item-${pyq.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-100 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{pyq.title}</p>
                    <p className="text-sm text-gray-500">{pyq.subject} · {pyq.year}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
