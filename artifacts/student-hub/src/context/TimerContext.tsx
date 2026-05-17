import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "./AuthContext";
import { getNepaliDate } from "@/lib/nepaliDate";

export type Phase = "work" | "shortBreak" | "longBreak";

export interface TimerSettings {
  workMins: number;
  shortBreakMins: number;
  longBreakMins: number;
  sessionsBeforeLongBreak: number;
  sessionsBeforeShortBreak: number;
  autoSwitch: boolean;
}

const DEFAULT_SETTINGS: TimerSettings = {
  workMins: 25,
  shortBreakMins: 5,
  longBreakMins: 15,
  sessionsBeforeLongBreak: 4,
  sessionsBeforeShortBreak: 2,
  autoSwitch: false,
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
  updatedAt: number;
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PersistedState;
    if (!s.updatedAt) return null;

    const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
    const savedNptDay = new Date(s.updatedAt + NPT_OFFSET_MS).toISOString().slice(0, 10);
    const todayNptDay = new Date(Date.now() + NPT_OFFSET_MS).toISOString().slice(0, 10);

    if (savedNptDay !== todayNptDay) {
      s.savedMinutesToday = 0;
      s.savedMinutes = 0;
      s.totalWorkSeconds = 0;
      s.running = false;
    }

    // If was running when app closed, advance using wall-clock elapsed time
    if (s.running) {
      const elapsed = (Date.now() - s.updatedAt) / 1000;
      if (elapsed > 0 && elapsed < 3600) {
        if (s.phase === "work") {
          s.totalWorkSeconds += elapsed;
        }
        s.seconds = Math.max(0, s.seconds - Math.floor(elapsed));
        // If timer ran out while app was closed, mark it as stopped
        if (s.seconds <= 0) {
          s.running = false;
          s.seconds = 0;
        }
      } else {
        s.running = false;
      }
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
  } catch {}
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const persisted = loadState();

  const [settings, setSettings] = useState<TimerSettings>(persisted?.settings ?? DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<Phase>(persisted?.phase ?? "work");
  const [seconds, setSeconds] = useState(persisted?.seconds ?? (DEFAULT_SETTINGS.workMins * 60));
  const [running, setRunning] = useState(persisted?.running ?? false);
  const [sessionsCompleted, setSessionsCompleted] = useState(persisted?.sessionsCompleted ?? 0);
  const [savedMinutesToday, setSavedMinutesToday] = useState(persisted?.savedMinutesToday ?? 0);

  // Accumulated work seconds (used for minute tracking)
  const totalWorkSecondsRef = useRef(persisted?.totalWorkSeconds ?? 0);
  // How many whole minutes we've already dispatched to the server
  const savedMinutesRef = useRef(persisted?.savedMinutes ?? 0);

  // Wall-clock references — set when running starts, cleared on pause/phase change
  // These allow accurate time measurement even when the browser throttles setInterval
  const workWallStartRef   = useRef<number | null>(null); // Date.now() when work phase last resumed
  const workBaseSecsRef    = useRef(0);                   // totalWorkSecondsRef.current at that moment
  const displayWallStartRef = useRef<number | null>(null); // Date.now() when phase last resumed (display)
  const displayBaseSecsRef  = useRef(0);                  // display seconds at that moment

  const phaseRef    = useRef<Phase>(persisted?.phase ?? "work");
  const runningRef  = useRef(persisted?.running ?? false);
  const userRef     = useRef<string | null>(null);
  const settingsRef = useRef(persisted?.settings ?? DEFAULT_SETTINGS);
  const sessionsRef = useRef(persisted?.sessionsCompleted ?? 0);
  const secondsRef  = useRef(persisted?.seconds ?? (DEFAULT_SETTINGS.workMins * 60));

  useEffect(() => { userRef.current = user?.uid ?? null; }, [user]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const persistState = useCallback(() => {
    saveState({
      phase: phaseRef.current,
      seconds: secondsRef.current,
      running: runningRef.current,
      sessionsCompleted: sessionsRef.current,
      settings: settingsRef.current,
      savedMinutesToday: savedMinutesRef.current,
      totalWorkSeconds: totalWorkSecondsRef.current,
      savedMinutes: savedMinutesRef.current,
      updatedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== LS_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as PersistedState;
        if (!s.running && runningRef.current) {
          runningRef.current = false;
          setRunning(false);
        }
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

  /**
   * Save study minutes to the backend.
   *
   * IMPORTANT: savedMinutesRef is updated IMMEDIATELY (before the async calls)
   * to prevent race conditions where two ticks fire before the first API call
   * responds, causing the same minutes to be sent twice.
   */
  const saveMinutes = useCallback(async (mins: number) => {
    const uid = userRef.current;
    if (!uid || mins < 1) return;

    // Update immediately — prevents double-counting if ticks fire before API responds
    savedMinutesRef.current += mins;
    setSavedMinutesToday(prev => prev + mins);

    // Fetch the Firebase ID token to authenticate the backend call
    let token: string | undefined;
    try {
      token = await auth.currentUser?.getIdToken();
    } catch {
      // Token fetch failed; fallback will handle it
    }

    if (token) {
      try {
        const res = await fetch("/api/study/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ uid, minutes: mins }),
        });

        if (res.ok) {
          const data = await res.json() as { todayMinutes?: number };
          if (data.todayMinutes !== undefined) {
            setSavedMinutesToday(data.todayMinutes);
          }
          console.log(`[Timer] Saved ${mins} min via backend.`);
          return;
        }

        const errData = await res.json().catch(() => ({})) as { error?: string };
        console.warn("[Timer] Backend save failed, falling back to direct Firestore:", errData.error);
      } catch (networkErr) {
        console.warn("[Timer] Backend unreachable, falling back to direct Firestore:", networkErr);
      }
    }

    // ── Firestore direct fallback ─────────────────────────────────────────────
    // NOTE: This fallback intentionally does NOT modify `streak`.
    // Streak is authoritative on the server only; it will sync on the next
    // successful backend call. This prevents client-side streak manipulation.
    try {
      const today = getNepaliDate();
      const userDocRef = doc(db, "users", uid);
      const snap = await getDoc(userDocRef);

      const data = snap.exists() ? snap.data() : {};
      const lastActive: string = data.lastActiveDate ?? "";
      const prevToday: number = lastActive === today ? (data.todayStudyTime ?? 0) : 0;
      const prevTotal: number = data.totalStudyTime ?? 0;
      const newToday = prevToday + mins;

      await setDoc(userDocRef, {
        totalStudyTime: prevTotal + mins,
        todayStudyTime: newToday,
        lastActiveDate: today,
      }, { merge: true });

      setSavedMinutesToday(newToday);
      console.log(`[Timer] Saved ${mins} min to Firestore (fallback). Total today: ${newToday}`);

      const logId = `${uid}_${today}`;
      const logRef = doc(db, "study_logs", logId);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) {
        await updateDoc(logRef, { studyMinutes: (logSnap.data().studyMinutes ?? 0) + mins });
      } else {
        await setDoc(logRef, { uid, date: today, studyMinutes: mins, tasksCompleted: 0, notesViewed: 0 });
      }
    } catch (err) {
      console.error("[Timer] All save methods failed:", err);
    }
  }, []);

  const phaseSeconds = useCallback((p: Phase, s: TimerSettings) => {
    if (p === "work") return s.workMins * 60;
    if (p === "shortBreak") return s.shortBreakMins * 60;
    return s.longBreakMins * 60;
  }, []);

  const nextPhase = useCallback((currentPhase: Phase, currentSessions: number, s: TimerSettings) => {
    // Clear wall-clock tracking for the completed phase
    workWallStartRef.current   = null;
    displayWallStartRef.current = null;

    if (currentPhase === "work") {
      const newSessions = currentSessions + 1;
      setSessionsCompleted(newSessions);
      sessionsRef.current = newSessions;

      const isLongBreak = newSessions % s.sessionsBeforeLongBreak === 0;
      const nextP: Phase = isLongBreak ? "longBreak" : "shortBreak";
      const nextSecs = phaseSeconds(nextP, s);
      phaseRef.current = nextP;
      secondsRef.current = nextSecs;
      setPhase(nextP);
      setSeconds(nextSecs);
      playBeep("break");
    } else {
      const nextSecs = phaseSeconds("work", s);
      phaseRef.current = "work";
      secondsRef.current = nextSecs;
      setPhase("work");
      setSeconds(nextSecs);
      playBeep("work");
    }
  }, [phaseSeconds]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      // ── Compute wall-clock elapsed time ──────────────────────────────────
      const now = Date.now();

      // Update totalWorkSeconds using actual wall-clock time (not tick count)
      // This is accurate even if the browser throttles setInterval (background tab)
      if (phaseRef.current === "work" && workWallStartRef.current !== null) {
        const wallElapsed = (now - workWallStartRef.current) / 1000;
        totalWorkSecondsRef.current = workBaseSecsRef.current + wallElapsed;
      }

      // Compute remaining display seconds from wall clock
      let newDisplaySecs = secondsRef.current;
      if (displayWallStartRef.current !== null) {
        const wallElapsed = Math.floor((now - displayWallStartRef.current) / 1000);
        newDisplaySecs = Math.max(0, displayBaseSecsRef.current - wallElapsed);
      }

      // ── Check if a new whole minute of work has been completed ───────────
      if (phaseRef.current === "work") {
        const earnedMinutes = Math.floor(totalWorkSecondsRef.current / 60);
        const toSave = earnedMinutes - savedMinutesRef.current;
        if (toSave >= 1) {
          saveMinutes(toSave);
        }
      }

      // ── Persist state every 5 seconds ────────────────────────────────────
      if (Math.floor(totalWorkSecondsRef.current) % 5 === 0) {
        saveState({
          phase: phaseRef.current,
          seconds: newDisplaySecs,
          running: runningRef.current,
          sessionsCompleted: sessionsRef.current,
          settings: settingsRef.current,
          savedMinutesToday: savedMinutesRef.current,
          totalWorkSeconds: totalWorkSecondsRef.current,
          savedMinutes: savedMinutesRef.current,
          updatedAt: now,
        });
      }

      // ── Advance display ──────────────────────────────────────────────────
      if (newDisplaySecs <= 0 && secondsRef.current > 0) {
        // Phase just completed
        secondsRef.current = 0;
        setSeconds(0);

        // Save any remaining fractional work time
        if (phaseRef.current === "work") {
          const finalEarned = Math.floor(totalWorkSecondsRef.current / 60);
          const remaining = finalEarned - savedMinutesRef.current;
          if (remaining >= 1) {
            saveMinutes(remaining);
          } else {
            const fractional = totalWorkSecondsRef.current - savedMinutesRef.current * 60;
            if (fractional >= 30) {
              saveMinutes(1);
            }
          }
        }

        nextPhase(phaseRef.current, sessionsRef.current, settingsRef.current);

        // Auto-switch: immediately start the new phase without user action
        if (settingsRef.current.autoSwitch) {
          const nowMs = Date.now();
          runningRef.current = true;
          setRunning(true);
          displayWallStartRef.current = nowMs;
          displayBaseSecsRef.current = secondsRef.current;
          if (phaseRef.current === "work") {
            workWallStartRef.current = nowMs;
            workBaseSecsRef.current = 0;
            totalWorkSecondsRef.current = 0;
            savedMinutesRef.current = 0;
          } else {
            workWallStartRef.current = null;
          }
        } else {
          runningRef.current = false;
          setRunning(false);
        }
      } else if (newDisplaySecs !== secondsRef.current) {
        secondsRef.current = newDisplaySecs;
        setSeconds(newDisplaySecs);
      }
    }, 500); // Run every 500ms for more responsive display

    return () => clearInterval(interval);
  }, [running, saveMinutes, nextPhase]);

  // Timer keeps running when the user switches tabs.
  // StudyGuardian (mounted in App.tsx) handles smart absence detection,
  // popups, and auto-switch after 1 h away — no need to pause here.
  // The wall-clock references (workWallStartRef / displayWallStartRef) ensure
  // accurate time even when the browser throttles the setInterval in bg tabs.

  const start = useCallback(() => {
    if (running) return;
    const now = Date.now();
    // Capture wall-clock start for accurate time measurement
    workWallStartRef.current    = now;
    workBaseSecsRef.current     = totalWorkSecondsRef.current;
    displayWallStartRef.current = now;
    displayBaseSecsRef.current  = secondsRef.current;
    runningRef.current = true;
    setRunning(true);
    persistState();
  }, [running, persistState]);

  const pause = useCallback(() => {
    // Snapshot the accumulated time before pausing
    if (phaseRef.current === "work" && workWallStartRef.current !== null) {
      const elapsed = (Date.now() - workWallStartRef.current) / 1000;
      totalWorkSecondsRef.current = workBaseSecsRef.current + elapsed;
    }
    if (displayWallStartRef.current !== null) {
      const elapsed = Math.floor((Date.now() - displayWallStartRef.current) / 1000);
      const newSecs = Math.max(0, displayBaseSecsRef.current - elapsed);
      secondsRef.current = newSecs;
      setSeconds(newSecs);
    }
    workWallStartRef.current    = null;
    displayWallStartRef.current = null;
    runningRef.current = false;
    setRunning(false);
    persistState();
  }, [persistState]);

  const reset = useCallback(() => {
    workWallStartRef.current    = null;
    displayWallStartRef.current = null;
    runningRef.current = false;
    setRunning(false);
    totalWorkSecondsRef.current = 0;
    savedMinutesRef.current = 0;
    phaseRef.current = "work";
    sessionsRef.current = 0;
    const resetSecs = settingsRef.current.workMins * 60;
    secondsRef.current = resetSecs;
    setPhase("work");
    setSessionsCompleted(0);
    setSeconds(resetSecs);
    saveState({
      phase: "work",
      seconds: resetSecs,
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
      // Snapshot current wall time before saving
      if (workWallStartRef.current !== null) {
        const elapsed = (Date.now() - workWallStartRef.current) / 1000;
        totalWorkSecondsRef.current = workBaseSecsRef.current + elapsed;
      }
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
        const newSecs = next.workMins * 60;
        secondsRef.current = newSecs;
        setSeconds(newSecs);
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
