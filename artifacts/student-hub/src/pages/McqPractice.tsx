import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { collection, query, where, getDocs, addDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Brain, CheckCircle, XCircle, Lightbulb } from "lucide-react";

interface Mcq {
  id: string;
  grade: number;
  subject: string;
  chapter: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  difficulty: string;
  explanation?: string;
}

type Phase = "setup" | "quiz" | "results";
interface Answer { questionId: string; selected: string; correct: boolean }

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function McqContent() {
  const { profile, user } = useAuth();
  const [phase, setPhase] = useState<Phase>("setup");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [count, setCount] = useState(10);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [allMcqs, setAllMcqs] = useState<Mcq[]>([]);
  const [quizMcqs, setQuizMcqs] = useState<Mcq[]>([]);
  const [loadingMcqs, setLoadingMcqs] = useState(true);

  const grade = profile?.grade || 10;

  useEffect(() => {
    setLoadingMcqs(true);
    const q = query(collection(db, "mcqs"), where("grade", "==", grade));
    getDocs(q).then(snap => {
      setAllMcqs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mcq)));
    }).catch(e => {
      console.error("[MCQ] Load failed:", e);
      setAllMcqs([]);
    }).finally(() => setLoadingMcqs(false));
  }, [grade]);

  const subjects = useMemo(() => [...new Set(allMcqs.map(m => m.subject))].sort(), [allMcqs]);

  const filteredMcqs = useMemo(() => {
    return allMcqs.filter(m => {
      if (subject && m.subject !== subject) return false;
      if (difficulty && m.difficulty !== difficulty) return false;
      return true;
    });
  }, [allMcqs, subject, difficulty]);

  const startQuiz = () => {
    const shuffled = shuffleArray(filteredMcqs).slice(0, count);
    setQuizMcqs(shuffled);
    setCurrentIdx(0);
    setAnswers([]);
    setSelected(null);
    setRevealed(false);
    setPhase("quiz");
  };

  const handleConfirm = () => {
    if (!selected) return;
    const q = quizMcqs[currentIdx];
    setRevealed(true);
    setAnswers(prev => [...prev, { questionId: q.id, selected, correct: selected === q.correctAnswer }]);
  };

  const handleNext = async () => {
    if (currentIdx + 1 >= quizMcqs.length) {
      const finalScore = answers.filter(a => a.correct).length;
      try {
        await addDoc(collection(db, "scores"), {
          uid: user?.uid || "",
          userName: profile?.name || "Unknown",
          grade,
          score: finalScore,
          totalQuestions: quizMcqs.length,
          subject: subject || "Mixed",
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[MCQ] Score submit failed:", e);
      }
      setPhase("results");
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  };

  const score = answers.filter(a => a.correct).length;
  const total = quizMcqs.length || count;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  if (phase === "results") {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${pct >= 70 ? "bg-green-100" : pct >= 40 ? "bg-orange-100" : "bg-red-100"}`}>
            <span className="text-3xl">{pct >= 70 ? "🎉" : pct >= 40 ? "📚" : "💪"}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Quiz Complete!</h2>
          <p className="text-5xl font-bold text-blue-500 my-4">{score}/{total}</p>
          <p className="text-gray-500 mb-2">{pct}% correct</p>
          <p className="text-sm text-gray-400 mb-8">{pct >= 70 ? "Excellent work! Keep it up." : pct >= 40 ? "Good effort — review topics you missed." : "Keep practising — you'll get there!"}</p>
          <div className="flex gap-3 justify-center">
            <button data-testid="btn-try-again" onClick={startQuiz} className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all">Try Again</button>
            <button onClick={() => setPhase("setup")} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all">Change Settings</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "quiz") {
    const q = quizMcqs[currentIdx];
    if (!q) return <div className="p-8 text-center text-gray-500"><Brain className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Loading questions…</p></div>;

    const opts: [string, string][] = [["A", q.optionA], ["B", q.optionB], ["C", q.optionC], ["D", q.optionD]];
    const isCorrect = revealed && selected === q.correctAnswer;

    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <span className="text-sm text-gray-500 font-medium">Question {currentIdx + 1} <span className="text-gray-400">of {quizMcqs.length}</span></span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-green-600 font-medium">{answers.filter(a => a.correct).length} ✓</span>
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / quizMcqs.length) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${q.difficulty === "easy" ? "bg-green-50 text-green-600" : q.difficulty === "hard" ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-600"}`}>{q.difficulty}</span>
            <span className="text-xs text-gray-400">{q.chapter}</span>
          </div>
          <p className="font-semibold text-gray-900 text-lg mb-6 leading-relaxed">{q.question}</p>
          <div className="space-y-3">
            {opts.map(([key, text]) => {
              let cls = "border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/50";
              if (revealed) {
                if (key === q.correctAnswer) cls = "border-green-400 bg-green-50 text-green-700";
                else if (key === selected) cls = "border-red-400 bg-red-50 text-red-700";
                else cls = "border-gray-100 text-gray-400";
              } else if (key === selected) cls = "border-blue-400 bg-blue-50 text-blue-700";
              return (
                <button key={key} data-testid={`option-${key}`} onClick={() => { if (!revealed) setSelected(key); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${cls}`}>
                  <span className="font-bold w-6 text-center flex-shrink-0">{key}</span>
                  <span className="flex-1">{text}</span>
                  {revealed && key === q.correctAnswer && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                  {revealed && key === selected && key !== q.correctAnswer && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          {revealed && (
            <div className={`mt-5 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium ${isCorrect ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {isCorrect ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {isCorrect ? "Correct! Well done." : `Incorrect — the correct answer is ${q.correctAnswer}.`}
            </div>
          )}
          {revealed && q.explanation && (
            <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Explanation</p>
                  <p className="text-sm text-amber-800 leading-relaxed">{q.explanation}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          {!revealed ? (
            <button data-testid="btn-confirm-answer" onClick={handleConfirm} disabled={!selected}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all disabled:opacity-50">Confirm Answer</button>
          ) : (
            <button data-testid="btn-next-question" onClick={handleNext}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all">Next Question</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">MCQ Practice</h1>
        <p className="text-gray-500 text-sm">Grade {grade} · Choose your settings</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSubject("")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!subject ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All Subjects
            </button>
            {loadingMcqs
              ? [1,2,3].map(i => <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />)
              : subjects.map(s => (
                <button key={s} onClick={() => setSubject(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${subject === s ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {s}
                </button>
              ))
            }
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
          <div className="flex gap-2">
            {[["", "All"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]].map(([val, label]) => (
              <button key={val} onClick={() => setDifficulty(val)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${difficulty === val ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
          <div className="flex gap-2">
            {[5, 10, 20].map(n => (
              <button key={n} onClick={() => setCount(n)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${count === n ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {!loadingMcqs && filteredMcqs.length === 0 && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
            No questions found for this selection. Try different filters.
          </div>
        )}
        {!loadingMcqs && filteredMcqs.length > 0 && (
          <p className="text-xs text-gray-400">{filteredMcqs.length} questions available</p>
        )}
      </div>

      <button
        onClick={startQuiz}
        disabled={loadingMcqs || filteredMcqs.length === 0}
        className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold text-base hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
        <Brain className="w-5 h-5" /> Start Quiz
      </button>
    </div>
  );
}

export default function McqPractice() {
  return (
    <>
      <Helmet>
        <title>MCQ Practice — Student Hub</title>
        <meta name="description" content="Practice multiple-choice questions by grade and subject. Improve your SEE and NEB exam scores." />
      </Helmet>
      <SoftGate feature="MCQ Practice">
        <McqContent />
      </SoftGate>
    </>
  );
}
