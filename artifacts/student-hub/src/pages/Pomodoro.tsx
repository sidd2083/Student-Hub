import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListTasks, getListTasksQueryKey } from "@workspace/api-client-react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

type Mode = 25 | 50;

export default function Pomodoro() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [activeTask, setActiveTask] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: tasks } = useListTasks(
    { uid: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: getListTasksQueryKey({ uid: user?.uid || "" }) } }
  );
  const pendingTasks = (tasks || []).filter(t => !t.completed);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            setRunning(false);
            clearInterval(intervalRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const reset = () => {
    setRunning(false);
    setSeconds(mode * 60);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setRunning(false);
    setSeconds(m * 60);
  };

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const total = mode * 60;
  const progress = ((total - seconds) / total) * 100;

  return (
    <Layout>
      <div className="p-8 max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pomodoro Timer</h1>
          <p className="text-gray-500">Focus and get things done</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center mb-6">
          <div className="flex gap-2 justify-center mb-8">
            {([25, 50] as Mode[]).map((m) => (
              <button
                key={m}
                data-testid={`mode-${m}`}
                onClick={() => switchMode(m)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${mode === m ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {m} min
              </button>
            ))}
          </div>

          <div className="relative w-48 h-48 mx-auto mb-8">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="44" fill="none" stroke="#3b82f6" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                strokeLinecap="round" className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold text-gray-900 tabular-nums">{mins}:{secs}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              data-testid="btn-reset-timer"
              onClick={reset}
              className="p-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              data-testid="btn-toggle-timer"
              onClick={() => setRunning(r => !r)}
              className="px-8 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-all flex items-center gap-2"
            >
              {running ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Start</>}
            </button>
          </div>
        </div>

        {pendingTasks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Timer className="w-4 h-4 text-blue-500" />
              Active Task
            </h3>
            <select
              data-testid="select-active-task"
              value={activeTask}
              onChange={(e) => setActiveTask(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a task to focus on...</option>
              {pendingTasks.map(t => <option key={t.id} value={t.text}>{t.text}</option>)}
            </select>
            {activeTask && (
              <div className="mt-3 px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-700">
                Focusing on: <strong>{activeTask}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
