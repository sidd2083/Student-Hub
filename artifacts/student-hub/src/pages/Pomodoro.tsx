import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { useListTasks, getListTasksQueryKey } from "@workspace/api-client-react";
import { Play, Pause, RotateCcw, Timer, CheckSquare } from "lucide-react";

type Preset = 25 | 50 | "custom";

async function saveStudySession(uid: string, minutesStudied: number): Promise<{
  streak: number;
  totalStudyTime: number;
  todayStudyTime: number;
} | null> {
  try {
    console.log(`[Pomodoro] Saving ${minutesStudied} min for user ${uid}`);
    const res = await fetch("/api/study/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, minutes: minutesStudied }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`[Pomodoro] Saved ✅ streak=${data.streak} total=${data.totalStudyTime} today=${data.todayStudyTime}`);
    return data;
  } catch (err) {
    console.error("[Pomodoro] Failed to save study time:", err);
    return null;
  }
}

function PomodoroContent() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<Preset>(25);
  const [customMins, setCustomMins] = useState<string>("30");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [activeTask, setActiveTask] = useState<string>("");
  const [savedStats, setSavedStats] = useState<{ streak: number; totalStudyTime: number; todayStudyTime: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSecondsRef = useRef<number>(25 * 60);

  const { data: tasks } = useListTasks(
    { uid: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: getListTasksQueryKey({ uid: user?.uid || "" }) } }
  );
  const pendingTasks = (Array.isArray(tasks) ? tasks : []).filter(t => !t.completed);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            setRunning(false);
            setDone(true);
            clearInterval(intervalRef.current!);
            if (user?.uid) {
              const minsStudied = Math.max(1, Math.ceil(startSecondsRef.current / 60));
              saveStudySession(user.uid, minsStudied).then(stats => {
                if (stats) setSavedStats(stats);
              });
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, user]);

  const getPresetSeconds = (p: Preset): number => {
    if (p === 25) return 25 * 60;
    if (p === 50) return 50 * 60;
    const m = parseInt(customMins, 10);
    return isNaN(m) || m < 1 ? 30 * 60 : m * 60;
  };

  const switchPreset = (p: Preset) => {
    setPreset(p); setRunning(false); setDone(false); setSavedStats(null);
    if (p !== "custom") {
      const s = getPresetSeconds(p);
      setSeconds(s);
      startSecondsRef.current = s;
    }
  };

  const applyCustom = () => {
    const m = parseInt(customMins, 10);
    if (isNaN(m) || m < 1) return;
    const s = m * 60;
    setSeconds(s);
    startSecondsRef.current = s;
    setRunning(false);
    setDone(false);
    setSavedStats(null);
  };

  const reset = () => {
    setRunning(false);
    setDone(false);
    setSavedStats(null);
    const s = getPresetSeconds(preset);
    setSeconds(s);
    startSecondsRef.current = s;
  };

  const handleStart = () => {
    if (done) return;
    if (!running) startSecondsRef.current = seconds;
    setDone(false);
    setRunning(r => !r);
  };

  const currentTotal = preset === "custom" ? (parseInt(customMins, 10) || 30) * 60 : getPresetSeconds(preset);
  const progress = currentTotal > 0 ? ((currentTotal - seconds) / currentTotal) * 100 : 0;
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const circumference = 2 * Math.PI * 44;

  const fmtTime = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Pomodoro Timer</h1>
        <p className="text-gray-500 text-sm">Stay focused — study time is saved to the leaderboard</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center mb-5">
        <div className="flex gap-2 justify-center mb-8">
          {([25, 50] as const).map((m) => (
            <button key={m} data-testid={`mode-${m}`} onClick={() => switchPreset(m)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${preset === m ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {m} min
            </button>
          ))}
          <button onClick={() => switchPreset("custom")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${preset === "custom" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            Custom
          </button>
        </div>

        {preset === "custom" && (
          <div className="flex items-center gap-2 justify-center mb-7">
            <input type="number" min={1} max={180} value={customMins} onChange={(e) => setCustomMins(e.target.value)}
              className="w-20 text-center border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="min" />
            <span className="text-sm text-gray-500">minutes</span>
            <button onClick={applyCustom} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition-all">Set</button>
          </div>
        )}

        <div className="relative w-52 h-52 mx-auto mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#f3f4f6" strokeWidth="7" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={done ? "#22c55e" : "#3b82f6"} strokeWidth="7"
              strokeDasharray={`${circumference}`} strokeDashoffset={`${circumference * (1 - progress / 100)}`}
              strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {done ? (
              <><span className="text-3xl mb-1">🎉</span><span className="text-sm font-medium text-green-600">Session complete!</span></>
            ) : (
              <span className="text-4xl font-bold text-gray-900 tabular-nums">{mins}:{secs}</span>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button data-testid="btn-reset-timer" onClick={reset} className="p-3.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all" title="Reset">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button data-testid="btn-toggle-timer" onClick={handleStart} disabled={done}
            className={`px-10 py-3.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${done ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"}`}>
            {running ? <><Pause className="w-5 h-5" /> Pause</> : <><Play className="w-5 h-5" /> Start</>}
          </button>
        </div>

        {done && savedStats && (
          <div className="mt-5 space-y-2">
            <p className="text-xs text-green-600 font-semibold">✓ Saved to leaderboard!</p>
            <div className="flex justify-center gap-6 mt-2">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">{fmtTime(savedStats.totalStudyTime)}</p>
                <p className="text-xs text-gray-400">total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{fmtTime(savedStats.todayStudyTime)}</p>
                <p className="text-xs text-gray-400">today</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-500">🔥 {savedStats.streak}d</p>
                <p className="text-xs text-gray-400">streak</p>
              </div>
            </div>
          </div>
        )}

        {done && !savedStats && (
          <p className="mt-4 text-xs text-gray-400">Saving your study time…</p>
        )}
      </div>

      {pendingTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-500" /> Focus on a task
          </h3>
          <select data-testid="select-active-task" value={activeTask} onChange={(e) => setActiveTask(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
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
        <meta name="description" content="Focus timer for study sessions. 25 or 50 minute sessions tracked to your report card." />
      </Helmet>
      <SoftGate feature="the Pomodoro timer">
        <PomodoroContent />
      </SoftGate>
    </>
  );
}
