import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListScores, getListScoresQueryKey } from "@workspace/api-client-react";
import { Trophy } from "lucide-react";

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"daily" | "alltime">("daily");

  const { data: scores, isLoading } = useListScores(
    { period },
    { query: { queryKey: getListScoresQueryKey({ period }) } }
  );

  const medal = (i: number) => {
    if (i === 0) return "bg-yellow-100 text-yellow-700";
    if (i === 1) return "bg-gray-100 text-gray-600";
    if (i === 2) return "bg-orange-100 text-orange-700";
    return "bg-white text-gray-600";
  };

  const rankLabel = (i: number) => {
    if (i === 0) return "1st";
    if (i === 1) return "2nd";
    if (i === 2) return "3rd";
    return `${i + 1}th`;
  };

  return (
    <>
      <Helmet>
        <title>Leaderboard — Student Hub</title>
        <meta name="description" content="Top MCQ scorers on Student Hub. Daily and all-time leaderboard for Grade 9–12 students." />
      </Helmet>
    <Layout>
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Leaderboard</h1>
          <p className="text-gray-500">Top scorers in MCQ practice</p>
        </div>
        <div className="flex gap-2 mb-6">
          {(["daily", "alltime"] as const).map((p) => (
            <button
              key={p}
              data-testid={`period-${p}`}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${period === p ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {p === "daily" ? "Today" : "All Time"}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (scores || []).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No scores yet. Take a quiz to appear here!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(scores || []).map((s, i) => {
              const isMe = s.uid === user?.uid;
              return (
                <div
                  key={s.id}
                  data-testid={`score-row-${s.id}`}
                  className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all ${isMe ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${medal(i)}`}>
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : rankLabel(i)}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${isMe ? "text-blue-700" : "text-gray-900"}`}>
                      {s.userName} {isMe && <span className="text-xs">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-500">Grade {s.grade} · {s.subject}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{s.score}/{s.totalQuestions}</p>
                    <p className="text-xs text-gray-500">{Math.round((s.score / s.totalQuestions) * 100)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
    </>
  );
}
