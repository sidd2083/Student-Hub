import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListMcqs, useListNoteSubjects, useSubmitScore, getListMcqsQueryKey } from "@workspace/api-client-react";
import { Brain, CheckCircle, XCircle } from "lucide-react";

type Phase = "setup" | "quiz" | "results";

interface Answer { questionId: number; selected: string; correct: boolean }

export default function McqPractice() {
  const { profile, user } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [count, setCount] = useState(10);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const grade = profile?.grade || 10;
  const { data: subjects } = useListNoteSubjects({ grade }, { query: { queryKey: getListMcqsQueryKey({ grade }) } });
  const { data: mcqs, refetch } = useListMcqs(
    { grade, ...(subject ? { subject } : {}), ...(difficulty ? { difficulty } : {}), limit: count },
    { query: { enabled: phase === "quiz", queryKey: getListMcqsQueryKey({ grade, subject, difficulty, limit: count }) } }
  );
  const submitScore = useSubmitScore();

  const startQuiz = () => {
    setCurrentIdx(0);
    setAnswers([]);
    setSelected(null);
    setRevealed(false);
    setPhase("quiz");
    refetch();
  };

  const handleSelect = (opt: string) => {
    if (revealed) return;
    setSelected(opt);
  };

  const handleConfirm = () => {
    if (!selected || !mcqs) return;
    const q = mcqs[currentIdx];
    setRevealed(true);
    setAnswers(prev => [...prev, { questionId: q.id, selected, correct: selected === q.correctAnswer }]);
  };

  const handleNext = () => {
    if (!mcqs) return;
    if (currentIdx + 1 >= mcqs.length) {
      const score = answers.filter(a => a.correct).length + (selected === mcqs[currentIdx]?.correctAnswer ? 1 : 0);
      submitScore.mutate({
        data: {
          uid: user?.uid || "",
          userName: profile?.name || "Unknown",
          grade: grade,
          score,
          totalQuestions: mcqs.length,
          subject: subject || "Mixed",
        }
      });
      setPhase("results");
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const score = answers.filter(a => a.correct).length;
  const total = mcqs?.length || count;
  const pct = Math.round((score / total) * 100);

  if (phase === "results") {
    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${pct >= 70 ? "bg-green-100" : "bg-orange-100"}`}>
              <span className="text-3xl font-bold">{pct >= 70 ? "🎉" : "📚"}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Quiz Complete</h2>
            <p className="text-5xl font-bold text-blue-500 my-4">{score}/{total}</p>
            <p className="text-gray-500 mb-6">{pct}% correct</p>
            <button
              data-testid="btn-try-again"
              onClick={() => setPhase("setup")}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all"
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "quiz") {
    const q = mcqs?.[currentIdx];
    if (!q) return <Layout><div className="p-8 text-center text-gray-500">Loading questions...</div></Layout>;
    const opts: [string, string][] = [["A", q.optionA], ["B", q.optionB], ["C", q.optionC], ["D", q.optionD]];

    return (
      <Layout>
        <div className="p-8 max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm text-gray-500">Question {currentIdx + 1} of {mcqs.length}</span>
            <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${((currentIdx + 1) / mcqs.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <p className="font-semibold text-gray-900 text-lg mb-6">{q.question}</p>
            <div className="space-y-3">
              {opts.map(([key, text]) => {
                let cls = "border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50";
                if (revealed) {
                  if (key === q.correctAnswer) cls = "border-green-400 bg-green-50 text-green-700";
                  else if (key === selected) cls = "border-red-400 bg-red-50 text-red-700";
                  else cls = "border-gray-100 text-gray-400";
                } else if (key === selected) cls = "border-blue-400 bg-blue-50 text-blue-700";
                return (
                  <button
                    key={key}
                    data-testid={`option-${key}`}
                    onClick={() => handleSelect(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${cls}`}
                  >
                    <span className="font-semibold w-6">{key}.</span>
                    <span>{text}</span>
                    {revealed && key === q.correctAnswer && <CheckCircle className="w-4 h-4 ml-auto text-green-600" />}
                    {revealed && key === selected && key !== q.correctAnswer && <XCircle className="w-4 h-4 ml-auto text-red-600" />}
                  </button>
                );
              })}
            </div>
          </div>
          {!revealed ? (
            <button
              data-testid="btn-confirm-answer"
              onClick={handleConfirm}
              disabled={!selected}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all disabled:opacity-50"
            >
              Confirm Answer
            </button>
          ) : (
            <button
              data-testid="btn-next-question"
              onClick={handleNext}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
            >
              {currentIdx + 1 >= mcqs.length ? "See Results" : "Next Question"}
            </button>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">MCQ Practice</h1>
          <p className="text-gray-500">Configure your quiz and start practicing</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              data-testid="select-subject-mcq"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {(subjects || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <div className="flex gap-2">
              {["", "easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  data-testid={`difficulty-${d || "all"}`}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${difficulty === d ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {d || "All"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  data-testid={`count-${n}`}
                  onClick={() => setCount(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${count === n ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            data-testid="btn-start-quiz"
            onClick={startQuiz}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all"
          >
            Start Quiz
          </button>
        </div>
      </div>
    </Layout>
  );
}
