import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { useAuth } from "./AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Phase = "work" | "shortBreak" | "longBreak";

export interface TimerSettings {
  workMins: number;
  shortBreakMins: number;
  longBreakMins: number;
  sessionsBeforeLongBreak: number; // e.g. 4 → long break after every 4 work sessions
  sessionsBeforeShortBreak: number; // e.g. 2 → short break after every 2 sessions (if < longBreak threshold)
}

const DEFAULT_SETTINGS: TimerSettings = {
  workMins: 25,
  shortBreakMins: 5,
  longBreakMins: 15,
  sessionsBeforeLongBreak: 4,
  sessionsBeforeShortBreak: 2,
};

interface TimerContextType {
  // State
  phase: Phase;
  seconds: number;
  running: boolean;
  sessionsCompleted: number;
  settings: TimerSettings;
  savedMinutesToday: number;

  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  skipPhase: () => void;
  updateSettings: (s: Partial<TimerSettings>) => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

// ─── Sound ───────────────────────────────────────────────────────────────────

function playBeep(type: "work" | "break" = "work") {
  try {
    const ctx = new AudioContext();
    const freqs = type === "work" ? [880, 1100, 880] : [523, 659, 784];
    let t = ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.4, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.3);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.35);
    });
  } catch {
    // AudioContext not available (e.g. SSR)
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>("work");
  const [seconds, setSeconds] = useState(DEFAULT_SETTINGS.workMins * 60);
  const [running, setRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [savedMinutesToday, setSavedMinutesToday] = useState(0);

  // Refs for live saving — don't need re-renders
  const totalWorkSecondsRef = useRef(0); // cumulative work seconds elapsed
  const savedMinutesRef = useRef(0);     // minutes already POSTed to backend
  const phaseRef = useRef<Phase>("work");
  const runningRef = useRef(false);
  const userRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  const sessionsRef = useRef(0);

  useEffect(() => { userRef.current = user?.uid ?? null; }, [user]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Save work minutes to backend ────────────────────────────────────────────
  const saveMinutes = useCallback(async (mins: number) => {
    const uid = userRef.current;
    if (!uid || mins < 1) return;
    try {
      const res = await fetch("/api/study/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, minutes: mins }),
      });
      if (res.ok) {
        const data = await res.json();
        savedMinutesRef.current += mins;
        setSavedMinutesToday(data.todayStudyTime ?? savedMinutesRef.current);
        console.log(`[Timer] Saved ${mins} min. Total today: ${data.todayStudyTime}`);
      }
    } catch (err) {
      console.error("[Timer] Save failed:", err);
    }
  }, []);

  // ── Phase durations ──────────────────────────────────────────────────────────
  const phaseSeconds = useCallback((p: Phase, s: TimerSettings) => {
    if (p === "work") return s.workMins * 60;
    if (p === "shortBreak") return s.shortBreakMins * 60;
    return s.longBreakMins * 60;
  }, []);

  // ── Transition to next phase ─────────────────────────────────────────────────
  const nextPhase = useCallback((currentPhase: Phase, currentSessions: number, s: TimerSettings) => {
    if (currentPhase === "work") {
      const newSessions = currentSessions + 1;
      setSessionsCompleted(newSessions);
      sessionsRef.current = newSessions;

      const isLongBreak = newSessions % s.sessionsBeforeLongBreak === 0;
      const nextP: Phase = isLongBreak ? "longBreak" : "shortBreak";
      phaseRef.current = nextP;
      setPhase(nextP);
      setSeconds(phaseSeconds(nextP, s));
      playBeep("break");
    } else {
      // Break ended → back to work
      phaseRef.current = "work";
      setPhase("work");
      setSeconds(phaseSeconds("work", s));
      playBeep("work");
    }
  }, [phaseSeconds]);

  // ── Main tick ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      // Live-save work minutes
      if (phaseRef.current === "work") {
        totalWorkSecondsRef.current += 1;
        const earnedMinutes = Math.floor(totalWorkSecondsRef.current / 60);
        const toSave = earnedMinutes - savedMinutesRef.current;
        if (toSave >= 1) {
          saveMinutes(toSave);
        }
      }

      setSeconds(prev => {
        if (prev <= 1) {
          // Phase complete
          runningRef.current = false;
          setRunning(false);

          // Save any remaining work seconds as a fraction round-up
          if (phaseRef.current === "work") {
            const remainingWorkSecs = totalWorkSecondsRef.current % 60;
            if (remainingWorkSecs > 0) {
              // Already saved the whole minutes; the last partial minute
              // gets saved only if ≥ 30 seconds (round-half-up)
              if (remainingWorkSecs >= 30) {
                saveMinutes(1);
              }
            }
          }

          nextPhase(phaseRef.current, sessionsRef.current, settingsRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [running, saveMinutes, nextPhase]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (running) return;
    runningRef.current = true;
    setRunning(true);
  }, [running]);

  const pause = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    totalWorkSecondsRef.current = 0;
    savedMinutesRef.current = 0;
    phaseRef.current = "work";
    sessionsRef.current = 0;
    setPhase("work");
    setSessionsCompleted(0);
    setSeconds(settingsRef.current.workMins * 60);
  }, []);

  const skipPhase = useCallback(() => {
    // Skip to next phase (save remaining work time first)
    if (phaseRef.current === "work") {
      const toSave = Math.floor(totalWorkSecondsRef.current / 60) - savedMinutesRef.current;
      if (toSave > 0) saveMinutes(toSave);
    }
    runningRef.current = false;
    setRunning(false);
    nextPhase(phaseRef.current, sessionsRef.current, settingsRef.current);
  }, [saveMinutes, nextPhase]);

  const updateSettings = useCallback((partial: Partial<TimerSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      settingsRef.current = next;
      // Reset timer with new work minutes if in work phase and not running
      if (!runningRef.current && phaseRef.current === "work") {
        setSeconds(next.workMins * 60);
      }
      return next;
    });
  }, []);

  return (
    <TimerContext.Provider value={{
      phase, seconds, running, sessionsCompleted, settings, savedMinutesToday,
      start, pause, reset, skipPhase, updateSettings,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
