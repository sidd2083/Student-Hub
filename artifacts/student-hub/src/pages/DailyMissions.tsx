import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useDailyMissions } from "@/hooks/useDailyMissions";
import { SoftGate } from "@/components/SoftGate";
import {
  CheckCircle2, Circle, Zap, BookOpen,
  AlertTriangle, Trophy, ChevronRight, Sparkles, Timer, ArrowRight,
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
  school_task: "Actually finished your homework? That discipline is real. 📚",
  fun:         "Small healthy habits today — huge life changes tomorrow. Honest? ✨",
  academic:    "Your brain just got stronger. Honest work builds real results. 🧠",
};

// ─── Pomodoro Mission Card ─────────────────────────────────────────────────────
// For timed missions — shows progress bar + "Go to Pomodoro" button, NO manual tick
function PomodoroMissionCard({
  mission,
  progress,
  onStart,
}: {
  mission: Mission;
  progress: number;
  onStart: (id: string, text: string, mins: number) => void;
}) {
  const [, navigate] = useLocation();
  const isStarted = mission.startedAt !== undefined || mission.id === "study_time";
  const mins      = mission.targetMinutes ?? 30;

  const handleGo = () => {
    onStart(mission.id, mission.text, mins);
    navigate("/pomodoro");
  };

  const fmtMins = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ""}`.trim() : `${m} min`;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      mission.completed ? "bg-green-50 border-green-100" : "bg-white border-gray-100 shadow-sm"
    }`}>
      <div className="flex items-start gap-3">
        {/* Status icon — auto, no manual tick */}
        <div className={`mt-0.5 flex-shrink-0 ${mission.completed ? "text-green-500" : "text-blue-300"}`}>
          {mission.completed
            ? <CheckCircle2 className="w-6 h-6" />
            : <Timer className="w-6 h-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-lg leading-none">{mission.emoji}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffBadge(mission.difficulty)}`}>
              {diffLabel(mission.difficulty)}
            </span>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Timer className="w-2.5 h-2.5" /> Pomodoro · {fmtMins(mins)}
            </span>
          </div>

          <p className={`text-sm font-medium leading-snug mb-2.5 ${
            mission.completed ? "line-through text-gray-400" : "text-gray-800"
          }`}>
            {mission.text}
          </p>

          {/* Progress bar */}
          {!mission.completed && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-400">
                  {isStarted ? "Session progress" : "Not started yet"}
                </span>
                {isStarted && (
                  <span className="text-[10px] font-semibold text-blue-600">{Math.round(progress)}%</span>
                )}
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          )}

          {/* CTA button */}
          {!mission.completed && (
            <button
              onClick={handleGo}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all"
            >
              <Timer className="w-3.5 h-3.5" />
              {isStarted && mission.id !== "study_time" ? "Continue in Pomodoro" : "Start in Pomodoro"}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {mission.completed && mission.completedAt && (
            <p className="text-[10px] text-green-500 mt-1">
              ✓ Auto-completed at {new Date(mission.completedAt).toLocaleTimeString("en-NP", {
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual Mission Card ───────────────────────────────────────────────────────
function ManualMissionCard({
  mission,
  onComplete,
}: {
  mission: Mission;
  onComplete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      mission.completed ? "bg-green-50 border-green-100" : "bg-white border-gray-100 shadow-sm"
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => !mission.completed && setConfirming(true)}
          disabled={mission.completed}
          className={`mt-0.5 flex-shrink-0 transition-transform ${
            mission.completed
              ? "text-green-500"
              : "text-gray-300 hover:text-blue-400 hover:scale-110 active:scale-95 cursor-pointer"
          }`}
        >
          {mission.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-lg leading-none">{mission.emoji}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffBadge(mission.difficulty)}`}>
              {diffLabel(mission.difficulty)}
            </span>
          </div>

          <p className={`text-sm font-medium leading-snug ${
            mission.completed ? "line-through text-gray-400" : "text-gray-800"
          }`}>
            {mission.text}
          </p>

          {mission.completed && mission.completedAt && (
            <p className="text-[10px] text-green-500 mt-1">
              ✓ Done at {new Date(mission.completedAt).toLocaleTimeString("en-NP", {
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

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
              onClick={() => { setConfirming(false); onComplete(mission.id); }}
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
    missions, loading, completeMission, startMission, missionProgress,
    completedCount, allCompleted, progressPct,
    isSaturday, level, date,
  } = useDailyMissions();

  if (loading && missions.length === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
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
      <div className="mb-5">
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
            Just 2 light missions today. Rest, recharge, and come back stronger tomorrow!
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
            Your name on the leaderboard is now glowing 🔥. Incredible discipline!
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
              title={m.text}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
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
        {missions.map(m =>
          m.type === "pomodoro" ? (
            <PomodoroMissionCard
              key={m.id}
              mission={m}
              progress={missionProgress(m)}
              onStart={startMission}
            />
          ) : (
            <ManualMissionCard
              key={m.id}
              mission={m}
              onComplete={completeMission}
            />
          )
        )}
      </div>

      {/* Honesty section */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">A note on honesty</p>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mb-2">
          These missions have no cameras, no verification — that's intentional.
          Ticking something you didn't do only cheats one person: <strong className="text-gray-700">you</strong>.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-2">
          We are just a platform pushing you toward your goals. The Pomodoro
          missions auto-track so there's nothing to fake there. For the rest —
          your effort compounds, your results don't lie.
        </p>
        <p className="text-xs font-semibold text-gray-700">Study smart. Be real. 💪</p>
      </div>

      {/* Rewards info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Complete all missions to:
        </p>
        <ul className="space-y-1 text-xs text-blue-600">
          <li>🔥 Get a special glow + badge on the leaderboard</li>
          <li>⚡ Build a daily study habit that actually sticks</li>
          <li>📈 Level up: Beginner → Intermediate → Advanced</li>
          <li>🎯 Stay consistently ahead of your class</li>
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
