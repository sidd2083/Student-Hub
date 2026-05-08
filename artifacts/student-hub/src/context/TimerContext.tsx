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
  sessionsBeforeLongBreak: number;
  sessionsBeforeShortBreak: number;
}

const DEFAULT_SETTINGS: TimerSettings = {
  workMins: 25,
  shortBreakMins: 5,
  longBreakMins: 15,
  sessionsBeforeLongBreak: 4,
  sessionsBeforeShortBreak: 2,
};

interface TimerContextType {
  phase: Phase;
  seconds: number;
  running: boolean;
  sessionsCompleted: number;
  settings: TimerSettings;
  savedMinutesToday: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skipPhase: () => void;
  updateSettings: (s: Partial<TimerSettings>) => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_KEY = "studenthub_timer_state";

interface PersistedState {
  phase: Phase;
  seconds: number;
  running: boolean;
  sessionsCompleted: number;
  settings: TimerSettings;
  savedMinutesToday: number;
  totalWorkSeconds: number;
  savedMinutes: number;
  updatedAt: number; // timestamp for cross-tab sync
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PersistedState;
    if (!s.updatedAt) return null;

    // Adjust seconds for elapsed time if timer was running
    const elapsed = Math.floor((Date.now() - s.updatedAt) / 1000);
    if (s.running && elapsed > 0 && elapsed < 3600) {
      // Advance the timer state forward by elapsed seconds
      s.totalWorkSeconds = s.phase === "work" ? s.totalWorkSeconds + elapsed : s.totalWorkSeconds;
      s.seconds = Math.max(0, s.seconds - elapsed);
    }
    return s;
  } catch {
    return null;
  }
}

function saveState(s: PersistedState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...s, updatedAt: Date.now() }));
  } catch {}
}

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

  // Load persisted state on mount
  const persisted = loadState();

  const [settings, setSettings] = useState<TimerSettings>(persisted?.settings ?? DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>(persisted?.phase ?? "work");
  const [seconds, setSeconds] = useState(persisted?.seconds ?? (DEFAULT_SETTINGS.workMins * 60));
  const [running, setRunning] = useState(persisted?.running ?? false);
  const [sessionsCompleted, setSessionsCompleted] = useState(persisted?.sessionsCompleted ?? 0);
  const [savedMinutesToday, setSavedMinutesToday] = useState(persisted?.savedMinutesToday ?? 0);

  const totalWorkSecondsRef = useRef(persisted?.totalWorkSeconds ?? 0);
  const savedMinutesRef = useRef(persisted?.savedMinutes ?? 0);
  const phaseRef = useRef<Phase>(persisted?.phase ?? "work");
  const runningRef = useRef(persisted?.running ?? false);
  const userRef = useRef<string | null>(null);
  const settingsRef = useRef(persisted?.settings ?? DEFAULT_SETTINGS);
  const sessionsRef = useRef(persisted?.sessionsCompleted ?? 0);

  useEffect(() => { userRef.current = user?.id ?? null; }, [user]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Persist state to localStorage on every tick ──────────────────────────────
  const persistState = useCallback(() => {
    saveState({
      phase: phaseRef.current,
      seconds: 0, // will be overwritten by caller
      running: runningRef.current,
      sessionsCompleted: sessionsRef.current,
      settings: settingsRef.current,
      savedMinutesToday: savedMinutesRef.current,
      totalWorkSeconds: totalWorkSecondsRef.current,
      savedMinutes: savedMinutesRef.current,
      updatedAt: Date.now(),
    });
  }, []);

  // ── Cross-tab sync via storage event ─────────────────────────────────────────
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== LS_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as PersistedState;
        // Only sync non-running state changes from other tabs (pause/reset)
        // to avoid fighting over the tick
        if (!s.running && runningRef.current) {
          runningRef.current = false;
          setRunning(false);
        }
        // Sync sessions / saved minutes
        if (s.sessionsCompleted !== sessionsRef.current) {
          sessionsRef.current = s.sessionsCompleted;
          setSessionsCompleted(s.sessionsCompleted);
        }
        if (s.savedMinutesToday !== savedMinutesRef.current) {
          setSavedMinutesToday(s.savedMinutesToday);
        }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // ── Save work minutes to backend ─────────────────────────────────────────────
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

  // ── Phase durations ───────────────────────────────────────────────────────────
  const phaseSeconds = useCallback((p: Phase, s: TimerSettings) => {
    if (p === "work") return s.workMins * 60;
    if (p === "shortBreak") return s.shortBreakMins * 60;
    return s.longBreakMins * 60;
  }, []);

  // ── Transition to next phase ──────────────────────────────────────────────────
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
      phaseRef.current = "work";
      setPhase("work");
      setSeconds(phaseSeconds("work", s));
      playBeep("work");
    }
  }, [phaseSeconds]);

  // ── Main tick ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      if (phaseRef.current === "work") {
        totalWorkSecondsRef.current += 1;
        const earnedMinutes = Math.floor(totalWorkSecondsRef.current / 60);
        const toSave = earnedMinutes - savedMinutesRef.current;
        if (toSave >= 1) {
          saveMinutes(toSave);
        }
      }

      setSeconds(prev => {
        const next = prev <= 1 ? 0 : prev - 1;

        // Persist every 5 seconds to avoid too much I/O
        if (totalWorkSecondsRef.current % 5 === 0) {
          saveState({
            phase: phaseRef.current,
            seconds: next,
            running: runningRef.current,
            sessionsCompleted: sessionsRef.current,
            settings: settingsRef.current,
            savedMinutesToday: savedMinutesRef.current,
            totalWorkSeconds: totalWorkSecondsRef.current,
            savedMinutes: savedMinutesRef.current,
            updatedAt: Date.now(),
          });
        }

        if (prev <= 1) {
          runningRef.current = false;
          setRunning(false);

          if (phaseRef.current === "work") {
            const remainingWorkSecs = totalWorkSecondsRef.current % 60;
            if (remainingWorkSecs >= 30) {
              saveMinutes(1);
            }
          }

          nextPhase(phaseRef.current, sessionsRef.current, settingsRef.current);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [running, saveMinutes, nextPhase]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (running) return;
    runningRef.current = true;
    setRunning(true);
    persistState();
  }, [running, persistState]);

  const pause = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    persistState();
  }, [persistState]);

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
    saveState({
      phase: "work",
      seconds: settingsRef.current.workMins * 60,
      running: false,
      sessionsCompleted: 0,
      settings: settingsRef.current,
      savedMinutesToday: 0,
      totalWorkSeconds: 0,
      savedMinutes: 0,
      updatedAt: Date.now(),
    });
  }, []);

  const skipPhase = useCallback(() => {
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
