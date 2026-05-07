import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { Trophy, Flame, Clock, Sun, RefreshCw } from "lucide-react";

interface LeaderEntry {
  uid: string;
  name: string;
  grade: number;
  streak: number;
  totalStudyTime: number;
  todayStudyTime: number;
  role: string;
}

type SortKey = "totalStudyTime" | "streak" | "todayStudyTime";

function fmtTime(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function medal(i: number) {
  if (i === 0) return "bg-yellow-100 text-yellow-700";
  if (i === 1) return "bg-gray-100 text-gray-500";
  if (i === 2) return "bg-orange-100 text-orange-600";
  return "bg-white text-gray-500 border border-gray-100";
}

function LeaderboardContent() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("totalStudyTime");
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/users")
      .then(r => r.json())
      .then((data: LeaderEntry[]) => {
        setEntries(data.filter(e => e.name && e.grade && e.role !== "admin"));
        setLastUpdated(new Date());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = entries
    .filter(e => gradeFilter === "all" || e.grade === gradeFilter)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const myRank = filtered.findIndex(e => e.uid === user?.uid);

  const tabBtn = (key: SortKey, label: string, icon: React.ReactNode, active: string, inactive: string) => (
    <button
      onClick={() => setSortBy(key)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${sortBy === key ? active : inactive}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Leaderboard</h1>
          <p className="text-gray-500 text-sm">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Sort + grade filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tabBtn("totalStudyTime", "All Time", <Clock className="w-3.5 h-3.5" />, "bg-blue-500 text-white shadow-sm", "bg-gray-100 text-gray-600 hover:bg-gray-200")}
        {tabBtn("todayStudyTime", "Today", <Sun className="w-3.5 h-3.5" />, "bg-green-500 text-white shadow-sm", "bg-gray-100 text-gray-600 hover:bg-gray-200")}
        {tabBtn("streak", "Streak", <Flame className="w-3.5 h-3.5" />, "bg-orange-500 text-white shadow-sm", "bg-gray-100 text-gray-600 hover:bg-gray-200")}

        <div className="w-px bg-gray-200" />

        {(["all", 9, 10, 11, 12] as const).map(g => (
          <button key={g} onClick={() => setGradeFilter(g)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              gradeFilter === g ? "bg-indigo-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {g === "all" ? "All Grades" : `Grade ${g}`}
          </button>
        ))}
      </div>

      {/* Context label */}
      <div className="mb-3 text-xs text-gray-400 font-medium uppercase tracking-wide">
        {sortBy === "totalStudyTime" && "📚 All-time study time"}
        {sortBy === "todayStudyTime" && "☀️ Today's study time"}
        {sortBy === "streak" && "🔥 Study streak (days)"}
        {gradeFilter !== "all" && ` · Grade ${gradeFilter} only`}
      </div>

      {/* My rank callout */}
      {!loading && myRank >= 0 && (
        <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
          You are ranked #{myRank + 1} {gradeFilter !== "all" ? `in Grade ${gradeFilter}` : "overall"} 🎯
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No students here yet.</p>
          <p className="text-sm mt-1">Complete a Pomodoro session to appear!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry, i) => {
            const isMe = entry.uid === user?.uid;
            return (
              <div key={entry.uid}
                className={`flex items-center gap-3 sm:gap-4 rounded-2xl border px-4 sm:px-5 py-4 transition-all ${
                  isMe ? "border-blue-200 bg-blue-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                {/* Rank badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${medal(i)}`}>
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                </div>

                {/* Name + grade */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold truncate text-sm sm:text-base ${isMe ? "text-blue-700" : "text-gray-900"}`}>
                    {entry.name} {isMe && <span className="text-xs font-normal text-blue-400">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400">Grade {entry.grade}</p>
                </div>

                {/* ONLY the primary stat for selected tab */}
                <div className="flex-shrink-0 text-right min-w-[60px]">
                  {sortBy === "totalStudyTime" && (
                    <>
                      <div className="flex items-center gap-1 text-blue-600 justify-end">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-sm font-bold">{fmtTime(entry.totalStudyTime)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">all time</p>
                    </>
                  )}
                  {sortBy === "todayStudyTime" && (
                    <>
                      <div className="flex items-center gap-1 text-green-600 justify-end">
                        <Sun className="w-3.5 h-3.5" />
                        <span className="text-sm font-bold">{fmtTime(entry.todayStudyTime)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">today</p>
                    </>
                  )}
                  {sortBy === "streak" && (
                    <>
                      <div className="flex items-center gap-1 text-orange-500 justify-end">
                        <Flame className="w-3.5 h-3.5" />
                        <span className="text-sm font-bold">{entry.streak}d</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">streak</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Leaderboard() {
  return (
    <>
      <Helmet>
        <title>Leaderboard — Student Hub</title>
        <meta name="description" content="Top students on Student Hub ranked by study time and streak." />
      </Helmet>
      <SoftGate feature="the leaderboard">
        <LeaderboardContent />
      </SoftGate>
    </>
  );
}
