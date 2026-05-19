import { useState } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useDailyMissions } from "@/hooks/useDailyMissions";
import { SoftGate } from "@/components/SoftGate";
import {
  CheckCircle2, Circle, Zap, Timer, BookOpen,
  AlertTriangle, Trophy, ChevronRight, Sparkles,
} from "lucide-react";
import type { Mission, MissionDifficulty, MissionLevel } from "@/hooks/useDailyMissions";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function diffBadge(d: MissionDifficulty) {
  if (d === "easy") return "bg-green-100 text-green-700";
  if (d === "mid")  return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}
function diffLabel(d: MissionDifficulty) {
  if (d === "easy") return "Easy";
  if (d === "mid")  return "Medium";
  return "Hard";
}
function levelLabel(l: MissionLevel) {
  if (l === "beginner")     return "🌱 Beginner";
  if (l === "intermediate") return "⚡ Intermediate";
  return "🔥 Advanced";
}

const CONFIRM_LINES: Record<string, string> = {
  school_task: "Did you actually finish your homework? That discipline is real. 📚",
  focus:       "No phone, no distractions — truly? That focus is your superpower. 🎯",
  fun:         "Small healthy habits today, huge life wins tomorrow. Honest? ✨",
  academic:    "Your brain just got stronger. Real work builds real results. 🧠",
};

// ─── Mission Card ─────────────────────────────────────────────────────────────
function MissionCard({
  mission,
  studyProgress,
  onComplete,
}: {
  mission: Mission;
  studyProgress: number;
  onComplete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isPomodoro = mission.type === "pomodoro";

  const handleTick = () => {
    if (mission.completed || isPomodoro) return;
    setConfirming(true);
  };

  const handleConfirm = () => {
    setConfirming(false);
    onComplete(mission.id);
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        mission.completed
          ? "bg-green-50 border-green-100"
          : "bg-white border-gray-100 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Tick / status icon */}
        <button
          onClick={handleTick}
          disabled={mission.completed || isPomodoro}
          className={`mt-0.5 flex-shrink-0 transition-transform ${
            mission.completed
              ? "text-green-500"
              : isPomodoro
              ? "text-gray-300 cursor-default"
              : "text-gray-300 hover:text-blue-400 hover:scale-110 active:scale-95 cursor-pointer"
          }`}
          aria-label={mission.completed ? "Done" : "Mark complete"}
        >
          {mission.completed ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <Circle className="w-6 h-6" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-lg leading-none">{mission.emoji}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffBadge(mission.difficulty)}`}>
              {diffLabel(mission.difficulty)}
            </span>
            {isPomodoro && (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Timer className="w-2.5 h-2.5" /> Auto-tracked
              </span>
            )}
          </div>

          <p className={`text-sm font-medium leading-snug ${mission.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
            {mission.text}
          </p>

          {/* Pomodoro progress bar */}
          {isPomodoro && !mission.completed && (
            <div className="mt-2.5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-400">Pomodoro progress</span>
                <span className="text-[10px] font-medium text-blue-600">{Math.round(studyProgress)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, studyProgress)}%` }}
                />
              </div>
              <Link href="/pomodoro">
                <span className="text-[10px] text-blue-500 hover:underline cursor-pointer mt-1 inline-block">
                  Open Pomodoro timer →
                </span>
              </Link>
            </div>
          )}

          {mission.completed && mission.completedAt && (
            <p className="text-[10px] text-green-500 mt-1">
              ✓ Completed at {new Date(mission.completedAt).toLocaleTimeString("en-NP", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirming && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-800 mb-0.5">Are you sure you completed this?</p>
              <p className="text-xs text-gray-500 leading-relaxed italic">
                {CONFIRM_LINES[mission.id] ?? "Your honesty is your biggest strength. Be real with yourself. 💪"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all"
            >
              Yes, I did it! ✓
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all"
            >
              Not yet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function DailyMissionsContent() {
  const {
    missions, loading, completeMission,
    completedCount, allCompleted, progressPct,
    isSaturday, level, studyProgress, date,
  } = useDailyMissions();

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const todayLabel = new Date(date).toLocaleDateString("en-NP", {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <Helmet><title>Daily Missions — Student Hub</title></Helmet>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Daily Missions</h1>
          {allCompleted && <Sparkles className="w-5 h-5 text-yellow-400 animate-bounce" />}
        </div>
        <p className="text-sm text-gray-500">{todayLabel} · {levelLabel(level)}</p>
      </div>

      {/* Saturday holiday banner */}
      {isSaturday && (
        <div className="mb-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-0.5">🎉 It's Saturday — enjoy your day!</p>
          <p className="text-xs text-amber-600 leading-relaxed">
            Just 2 light missions today. Rest, recharge, and come back stronger tomorrow. You deserve it!
          </p>
        </div>
      )}

      {/* All complete celebration */}
      {allCompleted && (
        <div
          className="mb-5 rounded-2xl p-4 text-center"
          style={{ background: "linear-gradient(135deg,#7c3aed 0%,#2563eb 100%)" }}
        >
          <div className="text-3xl mb-1">🏆</div>
          <p className="text-white font-bold text-base mb-0.5">All missions complete!</p>
          <p className="text-purple-200 text-xs leading-relaxed">
            Your name on the leaderboard is now glowing 🔥. Incredible discipline — see you tomorrow!
          </p>
          <Link href="/leaderboard">
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-full transition-all cursor-pointer">
              View Leaderboard <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-gray-800">
            {completedCount}/{missions.length} missions done
          </p>
          <span className="text-xs font-bold text-blue-600">{Math.round(progressPct)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: allCompleted
                ? "linear-gradient(90deg,#7c3aed,#2563eb)"
                : "linear-gradient(90deg,#3b82f6,#60a5fa)",
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {missions.map((m, i) => (
            <div
              key={m.id}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                m.completed
                  ? "bg-green-500 text-white"
                  : i === completedCount
                  ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {m.completed ? "✓" : i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Mission cards */}
      <div className="space-y-3 mb-6">
        {missions.map(m => (
          <MissionCard
            key={m.id}
            mission={m}
            studyProgress={studyProgress}
            onComplete={completeMission}
          />
        ))}
      </div>

      {/* Anti-cheat / honesty section */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">A note on honesty</p>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mb-2">
          These missions don't have cameras or verification — that's intentional. We trust you. 
          Ticking a mission you didn't complete only cheats one person: <strong className="text-gray-700">you</strong>.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-2">
          We are just a platform pushing you toward your goals. If you lie to us, that's fine — 
          we'll never know. But if you lie to <em>yourself</em>, your grades and your future will know.
        </p>
        <p className="text-xs font-semibold text-gray-700">
          Study smart. Be real. Your effort compounds. 💪
        </p>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Complete all missions to:
        </p>
        <ul className="space-y-1 text-xs text-blue-600">
          <li>🔥 Get a special glow on the leaderboard</li>
          <li>⚡ Build a powerful daily study habit</li>
          <li>📈 Level up from Beginner → Intermediate → Advanced</li>
          <li>🎯 Stay ahead of your class — every single day</li>
        </ul>
      </div>
    </div>
  );
}

export default function DailyMissions() {
  return (
    <SoftGate feature="Daily Missions">
      <DailyMissionsContent />
    </SoftGate>
  );
}
