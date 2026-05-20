import { useState } from "react";
import { Link } from "wouter";
import { useDailyMissions } from "@/hooks/useDailyMissions";
import { CheckCircle2, Circle, Zap, ChevronRight, Timer, Loader2, X, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getNepaliDate } from "@/lib/nepaliDate";
import type { MissionLevel } from "@/hooks/useDailyMissions";

function levelGradient(l: MissionLevel) {
  if (l === "beginner")     return "from-green-500 to-emerald-600";
  if (l === "intermediate") return "from-blue-500 to-indigo-600";
  return "from-purple-500 to-violet-700";
}

const DISMISS_KEY = (uid: string, date: string) => `sh_dm_done_${uid}_${date}`;

export function DailyMissionWidget() {
  const { user } = useAuth();
  const {
    missions, loading, completedCount, allCompleted, progressPct, level, isSaturday,
  } = useDailyMissions();

  const date = getNepaliDate();
  const uid  = user?.uid ?? "";

  const [dismissed, setDismissed] = useState(() => {
    if (!uid) return false;
    try { return localStorage.getItem(DISMISS_KEY(uid, date)) === "1"; } catch { return false; }
  });

  const handleDismiss = () => {
    if (uid) {
      try { localStorage.setItem(DISMISS_KEY(uid, date), "1"); } catch {}
    }
    setDismissed(true);
  };

  if (loading && missions.length === 0) {
    return (
      <div className="mb-5 sm:mb-6 rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
        <p className="text-sm text-gray-500">Loading your daily missions…</p>
      </div>
    );
  }

  if (missions.length === 0) return null;

  // If all done and dismissed — show a small compact badge instead of full widget
  if (dismissed && allCompleted) {
    return (
      <div className="mb-5 sm:mb-6 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl shadow-sm">
        <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-yellow-800 flex-1">All missions complete today! 🔥</p>
        <Link href="/missions">
          <span className="text-xs font-semibold text-yellow-600 hover:underline cursor-pointer">View →</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-5 sm:mb-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${allCompleted ? "from-yellow-500 to-orange-500" : levelGradient(level)} px-4 py-3 flex items-center gap-2`}>
        <Zap className="w-4 h-4 text-white flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">
            Daily Missions {isSaturday ? "🎉" : ""}
          </p>
          <p className="text-white/70 text-[11px] leading-tight">
            {allCompleted
              ? "All done! You're glowing on the leaderboard 🔥"
              : `${completedCount}/${missions.length} completed`}
          </p>
        </div>
        {allCompleted ? (
          <button
            onClick={handleDismiss}
            className="flex items-center justify-center w-7 h-7 bg-white/20 hover:bg-white/40 active:scale-95 transition-all rounded-full flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        ) : (
          <Link href="/missions">
            <div className="flex items-center gap-1 bg-white/20 hover:bg-white/30 active:bg-white/40 transition-all text-white text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 cursor-pointer">
              View all <ChevronRight className="w-3 h-3" />
            </div>
          </Link>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1 bg-white">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${
              allCompleted ? "from-yellow-400 to-orange-500" : levelGradient(level)
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 mb-2">
          {missions.map((m, i) => (
            <div
              key={m.id}
              title={m.text}
              className={`flex items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                m.completed
                  ? "w-5 h-5 bg-green-500 text-white"
                  : i === completedCount
                  ? "w-5 h-5 bg-blue-100 text-blue-600 ring-1 ring-blue-300"
                  : "w-5 h-5 bg-gray-100 text-gray-400"
              }`}
            >
              {m.completed ? "✓" : i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Mission list — first 3 */}
      <div className="bg-white px-4 pb-4 space-y-1.5">
        {missions.slice(0, 3).map(m => (
          <div
            key={m.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
              m.completed ? "bg-green-50" : "bg-gray-50"
            }`}
          >
            {m.completed
              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              : <Circle       className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            <span className="text-base leading-none flex-shrink-0">{m.emoji}</span>
            <span className={`flex-1 min-w-0 truncate font-medium ${
              m.completed ? "text-gray-400 line-through" : "text-gray-700"
            }`}>
              {m.text}
            </span>
            {m.type === "pomodoro" && !m.completed && (
              <Timer className="w-3 h-3 text-blue-400 flex-shrink-0" />
            )}
          </div>
        ))}
        {missions.length > 3 && !allCompleted && (
          <Link href="/missions">
            <div className="text-xs text-blue-500 hover:underline text-center py-1 cursor-pointer">
              +{missions.length - 3} more mission{missions.length - 3 > 1 ? "s" : ""} →
            </div>
          </Link>
        )}
        {allCompleted && (
          <Link href="/missions">
            <div className="text-xs text-center py-1.5 font-semibold text-orange-500 hover:underline cursor-pointer">
              🏆 View completed missions →
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
