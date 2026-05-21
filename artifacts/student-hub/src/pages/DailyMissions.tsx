import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useDailyMissions } from "@/hooks/useDailyMissions";
import { useTimer } from "@/context/TimerContext";
import { SoftGate } from "@/components/SoftGate";
import {
  CheckCircle2, Circle, Zap, BookOpen,
  AlertTriangle, Trophy, ChevronRight, Sparkles, Timer, ArrowRight, ShieldAlert, RotateCcw, ExternalLink,
} from "lucide-react";
import type { Mission, MissionDifficulty, MissionLevel } from "@/hooks/useDailyMissions";

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

// ─── Pomodoro Mission Card ────────────────────────────────────────────────────
function PomodoroMissionCard({
  mission, progress, onStart,
}: {
  mission: Mission;
  progress: number;
  onStart: (id: string, text: string, mins: number) => void;
}) {
  const [, navigate] = useLocation();
  const { naturalSessionsCompleted, running, restartForMission } = useTimer();

  // Cycle missions (pomodoro_cycle) are tracked by sessions — skip-proof.
  // Other pomodoro missions (subject_study) are tracked by minutes.
  const isSessionMission = mission.id === "pomodoro_cycle" && !!mission.targetSessions;
  const targetSessions   = mission.targetSessions ?? 2;
  const cycles           = targetSessions / 2;
  const sessionsAtStart  = mission.sessionsAtStart ?? naturalSessionsCompleted;
  const sessionsDone     = Math.max(0, naturalSessionsCompleted - sessionsAtStart);
  const displayProgress  = isSessionMission
    ? Math.min(100, (sessionsDone / targetSessions) * 100)
    : Math.min(100, progress);

  const mins = mission.targetMinutes ?? targetSessions * 25;
  const cycleLabel = cycles === 1 ? "1 cycle" : `${cycles} cycles`;

  const handleGo = () => {
    // If the timer isn't running, reset it to a clean work phase with auto-switch on
    // so the student arrives at a ready 25:00 timer — no confusion.
    if (!running) {
      restartForMission();
    }
    onStart(mission.id, mission.text, mins);
    navigate("/pomodoro");
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      mission.completed ? "bg-green-50 border-green-100" : "bg-white border-gray-100 shadow-sm"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 ${mission.completed ? "text-green-500" : "text-blue-300"}`}>
          {mission.completed ? <CheckCircle2 className="w-6 h-6" /> : <Timer className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-lg leading-none">{mission.emoji}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffBadge(mission.difficulty)}`}>
              {diffLabel(mission.difficulty)}
            </span>
            {isSessionMission ? (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Timer className="w-2.5 h-2.5" /> {cycleLabel} · 25+5+25 min
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Timer className="w-2.5 h-2.5" /> {mins} min focus
              </span>
            )}
          </div>

          <p className={`text-sm font-medium leading-snug mb-2.5 ${
            mission.completed ? "line-through text-gray-400" : "text-gray-800"
          }`}>
            {mission.text}
          </p>

          {!mission.completed && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                {isSessionMission ? (
                  <span className="text-[10px] text-gray-400">
                    {sessionsDone}/{targetSessions} sessions · skip does not count
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">Auto-tracked from Pomodoro timer</span>
                )}
                <span className="text-[10px] font-semibold text-blue-600">{Math.round(displayProgress)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
              {isSessionMission && (
                <div className="mt-1.5 flex gap-1">
                  {Array.from({ length: targetSessions }, (_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-all ${
                        i < sessionsDone ? "bg-blue-500" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!mission.completed && (
            <button
              onClick={handleGo}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all"
            >
              <Timer className="w-3.5 h-3.5" />
              {sessionsDone > 0 ? "Continue in Pomodoro" : "Start Pomodoro Timer"}
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {mission.completed && mission.completedAt && (
            <p className="text-[10px] text-green-500 mt-1">
              ✓ Completed at {new Date(mission.completedAt).toLocaleTimeString("en-NP", {
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual Mission Card ──────────────────────────────────────────────────────
function ManualMissionCard({
  mission, onComplete, blockedUntil,
}: {
  mission: Mission;
  onComplete: (id: string) => void;
  blockedUntil: number;
}) {
  const [confirming, setConfirming]           = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(3);
  const [blockSecsLeft, setBlockSecsLeft]     = useState(() =>
    Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000))
  );

  useEffect(() => {
    if (!confirming) { setConfirmCountdown(3); return; }
    setConfirmCountdown(3);
    const id = setInterval(() => {
      setConfirmCountdown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [confirming]);

  useEffect(() => {
    if (!blockedUntil) return;
    const update = () => setBlockSecsLeft(Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [blockedUntil]);

  const isBlocked = blockSecsLeft > 0;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      mission.completed ? "bg-green-50 border-green-100"
      : isBlocked ? "bg-red-50 border-red-100"
      : "bg-white border-gray-100 shadow-sm"
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => !mission.completed && !isBlocked && setConfirming(true)}
          disabled={mission.completed || isBlocked}
          className={`mt-0.5 flex-shrink-0 transition-transform ${
            mission.completed ? "text-green-500"
            : isBlocked ? "text-red-300 cursor-not-allowed"
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

          {/* Action link button — e.g. Open Notes or Open Important Questions */}
          {mission.actionLink && !mission.completed && (
            <Link href={mission.actionLink}>
              <button className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 text-gray-600 hover:text-blue-600 text-[11px] font-semibold rounded-lg transition-all active:scale-95">
                <ExternalLink className="w-3 h-3" />
                {mission.actionLabel ?? "Open"}
              </button>
            </Link>
          )}

          {mission.completed && mission.completedAt && (
            <p className="text-[10px] text-green-500 mt-1">
              ✓ Done at {new Date(mission.completedAt).toLocaleTimeString("en-NP", {
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}

          {isBlocked && !mission.completed && (
            <div className="mt-2 flex items-center gap-2 bg-red-100 border border-red-200 rounded-xl px-3 py-2">
              <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-700">
                Too fast! Wait {blockSecsLeft}s before marking another task done.
              </p>
            </div>
          )}
        </div>
      </div>

      {confirming && !mission.completed && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-800 mb-0.5">Did you actually do this?</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                The only person you cheat is yourself. Be honest.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (confirmCountdown === 0) { setConfirming(false); onComplete(mission.id); }
              }}
              disabled={confirmCountdown > 0}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                confirmCountdown > 0
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
            >
              {confirmCountdown > 0 ? `Yes, I did it! (${confirmCountdown}s)` : "Yes, I did it! ✓"}
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

// ─── Mission type label ───────────────────────────────────────────────────────
function missionTypeLabel(id: string): string {
  if (id === "pomodoro_cycle") return "Pomodoro";
  if (id === "school_task")    return "School";
  if (id === "subject_study")  return "Study";
  if (id === "wellness")       return "Wellness";
  if (id === "grade_mission")  return "Special";
  return "";
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function DailyMissionsContent() {
  const {
    missions, loading, completeMission, startMission, missionProgress, resetMissions,
    completedCount, allCompleted, progressPct,
    isSaturday, level, date, blockedUntil,
  } = useDailyMissions();

  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    await resetMissions();
    setResetting(false);
    setShowResetConfirm(false);
  };

  if (loading && missions.length === 0) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <Helmet><title>Daily Missions — Student Hub</title></Helmet>

      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Daily Missions</h1>
          {allCompleted && <Sparkles className="w-5 h-5 text-yellow-400 animate-bounce" />}
        </div>
        <p className="text-sm text-gray-500">{date} · {levelLabel(level)}</p>
      </div>

      {isSaturday && (
        <div className="mb-5 bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-0.5">🎉 Saturday — take it a little easier!</p>
          <p className="text-xs text-amber-600">Just 2 light missions today. Rest well and come back strong tomorrow.</p>
        </div>
      )}

      {allCompleted && (
        <div
          className="mb-5 rounded-2xl p-4 text-center"
          style={{ background: "linear-gradient(135deg,#7c3aed 0%,#2563eb 100%)" }}
        >
          <div className="text-3xl mb-1">🏆</div>
          <p className="text-white font-bold text-base mb-0.5">All missions done!</p>
          <p className="text-purple-200 text-xs">Your name is glowing on the leaderboard 🔥</p>
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
          <p className="text-sm font-semibold text-gray-800">{completedCount}/{missions.length} done</p>
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
              title={missionTypeLabel(m.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                m.completed ? "bg-green-500 text-white"
                : i === completedCount ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
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
            <PomodoroMissionCard key={m.id} mission={m} progress={missionProgress(m)} onStart={startMission} />
          ) : (
            <ManualMissionCard key={m.id} mission={m} onComplete={completeMission} blockedUntil={blockedUntil} />
          )
        )}
      </div>

      {/* Honesty note */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">A note on honesty</p>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Ticking something you didn't do only cheats one person — <strong className="text-gray-700">you</strong>. Pomodoro missions are tracked automatically so there's nothing to fake there. For manual ones, the 3-second confirm is your moment of real reflection — use it well.
        </p>
      </div>

      {/* Rewards */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Complete all missions to:
        </p>
        <ul className="space-y-1 text-xs text-blue-600">
          <li>🔥 Get an animated gold glow on the leaderboard</li>
          <li>📈 Level up: Beginner → Intermediate → Advanced</li>
          <li>🎯 Build a daily study habit that actually sticks</li>
        </ul>
      </div>

      {/* Reset missions */}
      <div className="border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Reset today's missions
        </p>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          Clears today's missions and generates a fresh set. Useful if something went wrong.
        </p>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-xs font-semibold text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-200 px-4 py-2 rounded-xl transition-all"
          >
            Reset today's missions
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex-1 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all disabled:opacity-60"
            >
              {resetting ? "Resetting…" : "Yes, reset now"}
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        )}
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
