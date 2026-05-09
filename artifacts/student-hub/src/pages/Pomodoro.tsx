import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { SoftGate } from "@/components/SoftGate";
import { useTimer } from "@/context/TimerContext";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Play, Pause, RotateCcw, Timer, CheckSquare,
  SkipForward, Settings, X,
} from "lucide-react";
import type { Phase } from "@/context/TimerContext";

function fmtTime(mins: number) {
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function phaseLabel(p: Phase) {
  if (p === "work") return "Focus";
  if (p === "shortBreak") return "Short Break";
  return "Long Break";
}

function phaseColor(p: Phase) {
  if (p === "work") return { ring: "#3b82f6", text: "text-blue-500", bg: "bg-blue-500" };
  if (p === "shortBreak") return { ring: "#22c55e", text: "text-green-500", bg: "bg-green-500" };
  return { ring: "#a855f7", text: "text-purple-500", bg: "bg-purple-500" };
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, running } = useTimer();

  const row = (label: string, key: keyof typeof settings, min: number, max: number, unit: string) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <button
          disabled={running || settings[key] <= min}
          onClick={() => updateSettings({ [key]: Math.max(min, (settings[key] as number) - 1) })}
          className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 font-bold text-sm flex items-center justify-center"
        >−</button>
        <span className="w-12 text-center text-sm font-semibold text-gray-900">
          {settings[key]} {unit}
        </span>
        <button
          disabled={running || settings[key] >= max}
          onClick={() => updateSettings({ [key]: Math.min(max, (settings[key] as number) + 1) })}
          className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 font-bold text-sm flex items-center justify-center"
        >+</button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Timer Settings</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      {running && <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">Pause the timer to change settings.</p>}
      {row("Focus duration", "workMins", 5, 90, "min")}
      {row("Short break", "shortBreakMins", 1, 30, "min")}
      {row("Long break", "longBreakMins", 5, 60, "min")}
      {row("Sessions before long break", "sessionsBeforeLongBreak", 2, 8, "")}
    </div>
  );
}

function PomodoroContent() {
  const { user } = useAuth();
  const {
    phase, seconds, running, sessionsCompleted,
    settings, savedMinutesToday,
    start, pause, reset, skipPhase,
  } = useTimer();
  const [activeTask, setActiveTask] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<Array<{ id: string; text: string }>>([]);

  useEffect(() => {
    if (!user?.uid) return;
    getDocs(query(collection(db, "tasks"), where("uid", "==", user.uid), where("completed", "==", false)))
      .then(snap => {
        setPendingTasks(snap.docs.map(d => ({ id: d.id, text: d.data().text })));
      })
      .catch(console.error);
  }, [user?.uid]);

  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Your Pomodoro timer is still running. If you leave, your current session progress may not be saved.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  const totalSecs = (() => {
    if (phase === "work") return settings.workMins * 60;
    if (phase === "shortBreak") return settings.shortBreakMins * 60;
    return settings.longBreakMins * 60;
  })();

  const progress = totalSecs > 0 ? ((totalSecs - seconds) / totalSecs) * 100 : 0;
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const circumference = 2 * Math.PI * 44;
  const colors = phaseColor(phase);

  return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pomodoro Timer</h1>
          <p className="text-gray-500 text-sm">Stay focused — time saves live as you study</p>
        </div>
        <button
          onClick={() => setShowSettings(s => !s)}
          className={`p-2 rounded-xl transition-colors ${showSettings ? "bg-blue-50 text-blue-500" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {savedMinutesToday > 0 && (
        <div className="flex gap-3 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-2xl">
          <span className="text-sm text-blue-700 font-medium">Today: <span className="font-bold">{fmtTime(savedMinutesToday)}</span> saved to leaderboard</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center mb-5">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6 ${
          phase === "work" ? "bg-blue-50 text-blue-600" :
          phase === "shortBreak" ? "bg-green-50 text-green-600" :
          "bg-purple-50 text-purple-600"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.bg} ${running ? "animate-pulse" : ""}`} />
          {phaseLabel(phase)}
        </div>

        <div className="flex gap-1.5 justify-center mb-6">
          {Array.from({ length: settings.sessionsBeforeLongBreak }, (_, i) => {
            const completed = sessionsCompleted % settings.sessionsBeforeLongBreak;
            const isFull = sessionsCompleted > 0 && sessionsCompleted % settings.sessionsBeforeLongBreak === 0;
            const filled = isFull ? true : i < completed;
            return (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${filled ? "bg-blue-500 scale-110" : "bg-gray-200"}`} />
            );
          })}
        </div>

        <div className="relative w-52 h-52 mx-auto mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#f3f4f6" strokeWidth="7" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke={colors.ring} strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-gray-900 tabular-nums">{mins}:{secs}</span>
            <span className="text-xs text-gray-400 mt-1">{phaseLabel(phase)}</span>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="p-3.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all" title="Reset">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={running ? pause : start}
            className={`px-10 py-3.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${
              running ? "bg-gray-800 text-white hover:bg-gray-700" : `${colors.bg} text-white hover:opacity-90`
            }`}
          >
            {running ? <><Pause className="w-5 h-5" /> Pause</> : <><Play className="w-5 h-5" /> Start</>}
          </button>
          <button onClick={skipPhase} className="p-3.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all" title="Skip to next phase">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Sessions completed: {sessionsCompleted} · Long break every {settings.sessionsBeforeLongBreak}
        </p>
      </div>

      {pendingTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-500" /> Focus on a task
          </h3>
          <select
            value={activeTask}
            onChange={e => setActiveTask(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a task…</option>
            {pendingTasks.map(t => <option key={t.id} value={t.text}>{t.text}</option>)}
          </select>
          {activeTask && (
            <div className="mt-3 px-4 py-2.5 bg-blue-50 rounded-xl text-sm text-blue-700 font-medium flex items-center gap-2">
              <Timer className="w-4 h-4 flex-shrink-0" /> {activeTask}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Pomodoro() {
  return (
    <>
      <Helmet>
        <title>Pomodoro Timer — Student Hub</title>
        <meta name="description" content="Focus timer with automatic breaks. Study time saved live to the leaderboard." />
      </Helmet>
      <SoftGate feature="the Pomodoro timer">
        <PomodoroContent />
      </SoftGate>
    </>
  );
}
