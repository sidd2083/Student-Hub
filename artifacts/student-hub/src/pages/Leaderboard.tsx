import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Trophy, Flame, Clock } from "lucide-react";

interface LeaderEntry {
  uid: string;
  name: string;
  grade: number;
  streak: number;
  studyTime: number;
}

type SortKey = "studyTime" | "streak";

function LeaderboardContent() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("studyTime");
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const data: LeaderEntry[] = snap.docs
          .map(d => {
            const v = d.data();
            return {
              uid: d.id,
              name: v.name ?? "Unknown",
              grade: v.grade ?? 0,
              streak: v.streak ?? 0,
              studyTime: v.studyTime ?? 0,
            };
          })
          .filter(e => e.name && e.grade);
        setEntries(data);
      } catch (err) {
        console.error("Leaderboard load failed:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = entries
    .filter(e => gradeFilter === "all" || e.grade === gradeFilter)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const grades = [...new Set(entries.map(e => e.grade))].sort((a, b) => a - b);

  const medal = (i: number) => {
    if (i === 0) return "bg-yellow-100 text-yellow-700";
    if (i === 1) return "bg-gray-100 text-gray-600";
    if (i === 2) return "bg-orange-100 text-orange-700";
    return "bg-white text-gray-600";
  };

  const fmtTime = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Leaderboard</h1>
        <p className="text-gray-500 text-sm">Top students ranked by study time and streak</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("studyTime")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${sortBy === "studyTime" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Clock className="w-3.5 h-3.5" /> Study Time
          </button>
          <button
            onClick={() => setSortBy("streak")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${sortBy === "streak" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Flame className="w-3.5 h-3.5" /> Streak
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setGradeFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${gradeFilter === "all" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            All Grades
          </button>
          {grades.map(g => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${gradeFilter === g ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Grade {g}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No students here yet.</p>
          <p className="text-sm mt-1">Start studying to appear on the leaderboard!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry, i) => {
            const isMe = entry.uid === user?.uid;
            return (
              <div
                key={entry.uid}
                className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all ${isMe ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${medal(i)}`}>
                  {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isMe ? "text-blue-700" : "text-gray-900"}`}>
                    {entry.name} {isMe && <span className="text-xs font-normal">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-500">Grade {entry.grade}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-blue-600">
                      <Clock className="w-3 h-3" />
                      <span className="text-sm font-semibold">{fmtTime(entry.studyTime)}</span>
                    </div>
                    <p className="text-xs text-gray-400">studied</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-orange-500">
                      <Flame className="w-3 h-3" />
                      <span className="text-sm font-semibold">{entry.streak}d</span>
                    </div>
                    <p className="text-xs text-gray-400">streak</p>
                  </div>
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
        <meta name="description" content="Top students on Student Hub ranked by study time and streak. Grade-wise leaderboard for Grade 9–12 students." />
      </Helmet>
      <SoftGate feature="the leaderboard">
        <LeaderboardContent />
      </SoftGate>
    </>
  );
}
