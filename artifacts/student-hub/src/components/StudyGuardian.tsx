import { useEffect, useRef, useState } from "react";
import { useTimer } from "@/context/TimerContext";
import type { Phase } from "@/context/TimerContext";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNepaliDate } from "@/lib/nepaliDate";

// ─── Focus tracker — module-level so Pomodoro can read it ────────────────────
// Tracks focused vs distracted time for the current session.
export const focusTracker = {
  sessionStartMs: 0,
  totalDistractedMs: 0,
  active: false,
  start()                  { this.sessionStartMs = Date.now(); this.totalDistractedMs = 0; this.active = true; },
  stop()                   { this.active = false; },
  addDistracted(ms: number){ this.totalDistractedMs = Math.min(this.totalDistractedMs + ms, Date.now() - this.sessionStartMs); },
  score(): number {
    if (!this.active || !this.sessionStartMs) return 100;
    const elapsed = Date.now() - this.sessionStartMs;
    if (elapsed < 90_000) return 100; // < 90s — don't show yet
    return Math.max(0, Math.round(((elapsed - this.totalDistractedMs) / elapsed) * 100));
  },
  elapsedMins(): number {
    if (!this.sessionStartMs) return 0;
    return Math.round((Date.now() - this.sessionStartMs) / 60_000);
  },
};

// ─── Shared AudioContext ──────────────────────────────────────────────────────
// One context per page-load. Browsers require a user gesture to unlock audio —
// starting the Pomodoro timer counts as that gesture so this is always safe.
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  const Ctor =
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ?? AudioContext;
  if (!_ctx || _ctx.state === "closed") _ctx = new Ctor();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ─── Background keepalive ─────────────────────────────────────────────────────
// Browsers SUSPEND the AudioContext when a tab goes to the background, which
// stops ctx.currentTime from advancing — so pre-scheduled alarms never fire.
// Keeping a completely-silent oscillator running prevents that suspension,
// meaning the alarm bursts play on time even while the user is on YouTube/
// Instagram/any other tab.
let _keepaliveOsc: OscillatorNode | null = null;
let _keepaliveGain: GainNode | null = null;

function startAudioKeepalive() {
  try {
    if (_keepaliveOsc) return;             // already running
    const ctx = getCtx();
    _keepaliveGain = ctx.createGain();
    _keepaliveGain.gain.value = 0;         // completely inaudible
    _keepaliveGain.connect(ctx.destination);
    _keepaliveOsc = ctx.createOscillator();
    _keepaliveOsc.frequency.value = 1;     // 1 Hz — imperceptibly slow
    _keepaliveOsc.connect(_keepaliveGain);
    _keepaliveOsc.start();
    ctx.resume();                           // ensure ctx is not suspended
  } catch { /* Safari/old browser — fail silently */ }
}

function stopAudioKeepalive() {
  try {
    _keepaliveOsc?.stop();
    _keepaliveOsc?.disconnect();
    _keepaliveGain?.disconnect();
  } catch {}
  _keepaliveOsc  = null;
  _keepaliveGain = null;
}

// ─── Pre-schedule beeps at future AudioContext times ─────────────────────────
// The Web Audio scheduler runs in a dedicated real-time thread that keeps
// ticking even when the browser throttles JS in background tabs.
// This means the sounds fire at the correct wall-clock moment regardless of
// whether the user is on this tab or not.
interface AlarmHandle { oscs: OscillatorNode[] }

function scheduleAlarms(delayMinutes: number[]): AlarmHandle {
  const oscs: OscillatorNode[] = [];
  try {
    const ctx  = getCtx();
    const now  = ctx.currentTime;
    delayMinutes.forEach((min) => {
      const base = now + min * 60;
      // Five-beep burst: escalating pitches, square wave = harsh & attention-grabbing
      // Louder gain (0.85) so it cuts through even when the device is in another tab
      [
        { freq: 880,  off: 0.00 },
        { freq: 1100, off: 0.28 },
        { freq: 1320, off: 0.56 },
        { freq: 1100, off: 0.84 },
        { freq: 880,  off: 1.12 },
      ].forEach(({ freq, off }) => {
        const t = base + off;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.85, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.start(t);
        osc.stop(t + 0.28);
        oscs.push(osc);
      });
    });
  } catch { /* AudioContext blocked (e.g. unit tests) — fail silently */ }
  return { oscs };
}

function cancelAlarms(handle: AlarmHandle | null) {
  if (!handle) return;
  handle.oscs.forEach((osc) => {
    try { osc.stop(0); }  catch { /* already stopped — fine */ }
    try { osc.disconnect(); } catch {}
  });
}

// ─── Immediate alert beep (plays when user returns to tab) ───────────────────
// 5-beep burst at max volume so the user definitely notices the popup
function playImmediateAlert() {
  try {
    const ctx = getCtx();
    [
      { freq: 660,  t: 0.00 },
      { freq: 880,  t: 0.24 },
      { freq: 1100, t: 0.48 },
      { freq: 880,  t: 0.72 },
      { freq: 1100, t: 0.96 },
    ].forEach(({ freq, t }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.85, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.20);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.24);
    });
  } catch {}
}

// ─── Wellness chime ───────────────────────────────────────────────────────────
function playWellnessChime() {
  try {
    const ctx = getCtx();
    [{ freq: 523, t: 0 }, { freq: 659, t: 0.22 }].forEach(({ freq, t }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.55);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.6);
    });
  } catch {}
}

// ─── Browser notifications ────────────────────────────────────────────────────
let _permAsked = false;
function requestNotifPermission() {
  if (_permAsked) return;
  _permAsked = true;
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
function sendNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/icon-192.png", tag: "study-guardian" });
    } catch {}
  }
}

// ─── Wellness messages ────────────────────────────────────────────────────────
const WELLNESS = [
  { emoji: "💧", msg: "Did you drink any water in the last hour?" },
  { emoji: "👀", msg: "20-20-20 rule — look at something 20 feet away for 20 seconds!" },
  { emoji: "🧘", msg: "Quick neck roll — left, right, forward, back. Feel better?" },
  { emoji: "🪑", msg: "How's your posture? Sit up straight and relax your shoulders!" },
  { emoji: "🌬️", msg: "Slow deep breath in... hold... and out. You're doing great!" },
  { emoji: "🤸", msg: "Shake out your wrists and fingers — they've been working hard!" },
  { emoji: "🍎", msg: "Have you eaten anything recently? Your brain needs fuel!" },
  { emoji: "🌟", msg: "You've been studying for a really long time. You're crushing it!" },
  { emoji: "📖", msg: "Quick brain check — what's one thing you've learned in the last hour?" },
];

// ─── Popup types ──────────────────────────────────────────────────────────────
type PopupKind =
  | { kind: "absent"; phase: Phase; awayMins: number }
  | { kind: "wellness"; idx: number }
  | { kind: "idle_on_page"; idleMins: number }
  | null;

// ─── AbsentPopup ──────────────────────────────────────────────────────────────
function AbsentPopup({
  isWork, awayMins, onYes, onNo,
}: { isWork: boolean; awayMins: number; onYes: () => void; onNo: () => void }) {
  const awayText =
    awayMins >= 60
      ? `${Math.floor(awayMins / 60)}h ${awayMins % 60}m`
      : `${awayMins} min`;

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-7 text-center"
        style={{ animation: "pageFadeIn 0.2s ease both" }}
      >
        <div className="text-5xl mb-3">{isWork ? "⚠️" : "☕"}</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {isWork ? "Where did you go?" : "Break is over!"}
        </h2>
        <p className="text-xs font-medium text-gray-400 mb-4 uppercase tracking-wide">
          Away for {awayText}
        </p>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {isWork
            ? "Your timer kept running while you were away. Were you actually studying, or did you wander off?"
            : "You've been on break longer than planned. Ready to get back to it?"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-all text-sm"
          >
            {isWork ? "I was distracted 😅" : "Skip to work ⏩"}
          </button>
          <button
            onClick={onYes}
            className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all text-sm shadow-lg shadow-blue-200"
          >
            {isWork ? "I was studying 💪" : "Still on break 🛋️"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          {isWork
            ? "Distracted → timer switches to break mode"
            : "'Skip' → start next work session now"}
        </p>
      </div>
    </div>
  );
}

// ─── WellnessPopup ────────────────────────────────────────────────────────────
function WellnessPopup({
  emoji, message, onDismiss,
}: { emoji: string; message: string; onDismiss: () => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[9500] max-w-xs w-full"
      style={{ animation: "pageFadeIn 0.25s ease both" }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-5 flex items-start gap-4">
        <span className="text-3xl flex-shrink-0 mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug mb-3">{message}</p>
          <button
            onClick={onDismiss}
            className="text-xs font-semibold px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
          >
            I'm good! 👍
          </button>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 text-lg leading-none mt-0.5"
          aria-label="Dismiss"
        >×</button>
      </div>
    </div>
  );
}

// ─── Persistent mission auto-complete (runs from app root, not DailyMissions) ─
// useDailyMissions auto-complete only fires when the DailyMissions page is mounted.
// This hook watches savedMinutesToday from TimerContext (which persists across
// navigation) and completes missions directly in localStorage + Firestore so the
// update is visible even while the user is on the Pomodoro page.
// It dispatches "sh:missionCompleted" so the DailyMissions hook refreshes from cache.
function useMissionAutoComplete() {
  const { user } = useAuth();
  const { savedMinutesToday } = useTimer();

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    const date = getNepaliDate();
    const cacheKey = `sh_dm_${uid}_${date}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const cache = JSON.parse(raw) as { missions: any[]; allCompleted: boolean };
      const missions: any[] = cache.missions ?? [];

      let changed = false;
      const updated = missions.map(m => {
        if (m.type !== "pomodoro" || m.completed) return m;
        let shouldComplete = false;
        if (m.targetMinutes && m.startedAt !== undefined) {
          const done = Math.max(0, savedMinutesToday - m.startedAt);
          shouldComplete = done >= m.targetMinutes;
        }
        if (shouldComplete) {
          changed = true;
          return { ...m, completed: true, completedAt: new Date().toISOString() };
        }
        return m;
      });

      if (!changed) return;

      const completedCount = updated.filter((m: any) => m.completed).length;
      const allCompleted = completedCount === updated.length && updated.length > 0;

      // Persist completion to localStorage immediately
      localStorage.setItem(cacheKey, JSON.stringify({ ...cache, missions: updated, allCompleted }));
      // Notify the DailyMissions hook to refresh from cache
      window.dispatchEvent(new CustomEvent("sh:missionCompleted"));
      // Sync to Firestore in background
      updateDoc(doc(db, "daily_missions", `${uid}_${date}`), {
        missions: updated, completedCount, allCompleted,
      }).catch(() => {});
      if (allCompleted) {
        updateDoc(doc(db, "users", uid), { lastMissionsCompletedDate: date }).catch(() => {});
      }
    } catch { /* ignore parse errors */ }
  }, [savedMinutesToday, user?.uid]);
}

// ─── Main StudyGuardian ───────────────────────────────────────────────────────
export function StudyGuardian() {
  const { phase, running, settings, skipPhase, pause, start } = useTimer();
  const [popup, setPopup] = useState<PopupKind>(null);
  const wasRunningRef = useRef(false);

  // Persistent mission completion checker — runs regardless of which page is active
  useMissionAutoComplete();

  // Request notification permission the moment the timer starts
  useEffect(() => { if (running) requestNotifPermission(); }, [running]);

  // ── Stable refs (avoid stale closures in event handlers) ──────────────────
  const runningRef        = useRef(running);
  const phaseRef          = useRef<Phase>(phase);
  const settingsRef       = useRef(settings);
  const popupRef          = useRef<PopupKind>(null);

  // Tab-away state
  const hiddenAtRef       = useRef<number | null>(null);
  const alarmHandleRef    = useRef<AlarmHandle | null>(null);
  const notifTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastConfirmedRef  = useRef<number | null>(null);
  const timerStartedAtRef = useRef<number | null>(null); // when timer last became running

  // Wellness state
  const lastActivityRef   = useRef<number>(Date.now());
  const totalRunSecsRef   = useRef<number>(0);
  const lastWellnessRef   = useRef<number | null>(null);
  const wellnessIdxRef    = useRef<number>(0);

  // Idle-on-page state (timer running, tab visible, but user not interacting)
  const lastIdleCheckRef  = useRef<number | null>(null);

  // Sync refs
  useEffect(() => { runningRef.current  = running;  }, [running]);
  useEffect(() => { phaseRef.current    = phase;    }, [phase]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { popupRef.current    = popup;    }, [popup]);

  // Track when timer starts/stops — also feed the focus tracker
  useEffect(() => {
    if (running) {
      if (!timerStartedAtRef.current) {
        timerStartedAtRef.current = Date.now();
        focusTracker.start();
      }
    } else {
      timerStartedAtRef.current = null;
      focusTracker.stop();
    }
  }, [running]);

  // Accumulate run-time (for wellness threshold)
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { totalRunSecsRef.current += 1; }, 1_000);
    return () => clearInterval(id);
  }, [running]);

  // Activity tracking (mouse / keyboard / touch)
  useEffect(() => {
    const touch = () => { lastActivityRef.current = Date.now(); };
    const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    EVENTS.forEach(ev => window.addEventListener(ev, touch, { passive: true }));
    return () => EVENTS.forEach(ev => window.removeEventListener(ev, touch));
  }, []);

  // ── Pause timer when popup shows, resume when popup clears ───────────────
  useEffect(() => {
    if (popup !== null) {
      wasRunningRef.current = runningRef.current;
      if (runningRef.current) pause();
    } else {
      if (wasRunningRef.current) {
        wasRunningRef.current = false;
        start();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup]);

  // ── Wellness check — every 90 s ───────────────────────────────────────────
  // Only triggers after 1.5 h of cumulative study AND 20 min of idle,
  // at most once per 20 min. Real studiers will not see this.
  useEffect(() => {
    const id = setInterval(() => {
      if (!runningRef.current)             return;
      if (popupRef.current !== null)       return;
      if (totalRunSecsRef.current < 5_400) return; // < 1.5 h
      const idleSecs = (Date.now() - lastActivityRef.current) / 1_000;
      if (idleSecs < 20 * 60)             return;
      if (lastWellnessRef.current && Date.now() - lastWellnessRef.current < 20 * 60_000) return;

      const idx = wellnessIdxRef.current % WELLNESS.length;
      wellnessIdxRef.current++;
      lastWellnessRef.current = Date.now();
      playWellnessChime();
      sendNotification("Study Guardian 🌟", WELLNESS[idx].msg);
      setPopup({ kind: "wellness", idx });
    }, 90_000);
    return () => clearInterval(id);
  }, []);

  // ── Idle-on-page detection ────────────────────────────────────────────────
  // Catches students who start the timer on the Pomodoro page then do nothing —
  // tab stays visible so tab-away logic doesn't fire, but they're not studying.
  // Fires if: timer running + tab visible + work phase + no mouse/key/touch for 6 min.
  // Cooldown: 20 min so genuine slow readers don't get nagged repeatedly.
  useEffect(() => {
    const id = setInterval(() => {
      if (!runningRef.current)         return;
      if (document.hidden)             return; // tab-away logic handles hidden tab
      if (popupRef.current !== null)   return;
      if (phaseRef.current !== "work") return;

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 6 * 60_000) return; // < 6 min idle → still probably studying

      // Cooldown: don't show more than once per 20 min
      if (lastIdleCheckRef.current && Date.now() - lastIdleCheckRef.current < 20 * 60_000) return;

      const idleMins = Math.round(idleMs / 60_000);
      lastIdleCheckRef.current = Date.now();
      focusTracker.addDistracted(idleMs);
      playImmediateAlert();
      sendNotification(
        "⚠️ Student Hub — Still studying?",
        `No activity for ${idleMins} min while your timer runs. Still focused?`,
      );
      setPopup({ kind: "idle_on_page", idleMins });
    }, 60_000); // check every 1 minute
    return () => clearInterval(id);
  }, []);

  // ── Tab-away detection ────────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      if (document.hidden) {
        // ── Tab went hidden ──────────────────────────────────────────────
        if (!runningRef.current) return;
        hiddenAtRef.current = Date.now();

        // CRITICAL: start a silent oscillator BEFORE scheduling alarms.
        // Browsers suspend the AudioContext in background tabs, which stops
        // ctx.currentTime — meaning every pre-scheduled alarm is lost.
        // A running (but inaudible) node keeps the context alive so alarms
        // fire normally even while the user is on YouTube / Instagram / etc.
        startAudioKeepalive();

        const isWork = phaseRef.current === "work";
        const s      = settingsRef.current;

        if (isWork) {
          // Alarms every minute from 1–15 min away so the user hears them early
          const firstAlarmMin = 1;
          const alarmMinutes  = Array.from({ length: 15 }, (_, i) => firstAlarmMin + i);
          alarmHandleRef.current = scheduleAlarms(alarmMinutes);
          notifTimerRef.current = setTimeout(() => {
            if (document.hidden) {
              sendNotification(
                "⚠️ Student Hub — Focus check",
                "You've been away from your study session. Come back and stay focused!",
              );
            }
          }, firstAlarmMin * 60 * 1_000);
        } else {
          const breakMins = phaseRef.current === "shortBreak"
            ? s.shortBreakMins : s.longBreakMins;
          alarmHandleRef.current = scheduleAlarms([breakMins * 2]);
        }

      } else {
        // ── Tab came back ────────────────────────────────────────────────
        stopAudioKeepalive();          // keepalive no longer needed
        cancelAlarms(alarmHandleRef.current);
        alarmHandleRef.current = null;
        if (notifTimerRef.current) { clearTimeout(notifTimerRef.current); notifTimerRef.current = null; }

        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (!hiddenAt || !runningRef.current) return;

        const awayMs   = Date.now() - hiddenAt;
        const awayMins = Math.max(1, Math.round(awayMs / 60_000));
        const isWork   = phaseRef.current === "work";

        // ≥ 60 min away → auto-skip phase silently
        if (awayMs >= 60 * 60_000) {
          skipPhase();
          lastConfirmedRef.current = null;
          return;
        }

        if (isWork) {
          if (awayMs < 5 * 60_000) return; // brief switch — ignore

          const sinceConfirm = lastConfirmedRef.current
            ? Date.now() - lastConfirmedRef.current : Infinity;
          if (sinceConfirm < 30 * 60_000) return; // recently confirmed — don't nag

          focusTracker.addDistracted(awayMs);
          playImmediateAlert();
          sendNotification("⚠️ Student Hub — Study check", `You were away ${awayMins} min. Still studying?`);
          setPopup({ kind: "absent", phase: phaseRef.current, awayMins });
        } else {
          const breakMins = phaseRef.current === "shortBreak"
            ? settingsRef.current.shortBreakMins : settingsRef.current.longBreakMins;
          if (awayMs < breakMins * 2 * 60_000) return;
          playImmediateAlert();
          setPopup({ kind: "absent", phase: phaseRef.current, awayMins });
        }
      }
    };

    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [skipPhase]);

  // ── Popup handlers ────────────────────────────────────────────────────────
  const handleAbsentYes = () => {
    lastConfirmedRef.current = Date.now();
    lastActivityRef.current  = Date.now();
    setPopup(null);
  };
  const handleAbsentNo = () => { skipPhase(); setPopup(null); };
  const handleWellnessDismiss = () => { lastActivityRef.current = Date.now(); setPopup(null); };
  const handleIdleStillStudying = () => {
    lastConfirmedRef.current = Date.now();
    lastActivityRef.current  = Date.now();
    setPopup(null);
  };
  const handleIdlePause = () => { pause(); setPopup(null); };

  if (!popup) return null;

  if (popup.kind === "absent") {
    return (
      <AbsentPopup
        isWork={popup.phase === "work"}
        awayMins={popup.awayMins}
        onYes={handleAbsentYes}
        onNo={handleAbsentNo}
      />
    );
  }

  if (popup.kind === "wellness") {
    const { emoji, msg } = WELLNESS[popup.idx];
    return <WellnessPopup emoji={emoji} message={msg} onDismiss={handleWellnessDismiss} />;
  }

  if (popup.kind === "idle_on_page") {
    return (
      <div
        className="fixed inset-0 z-[9500] flex items-center justify-center p-4"
        style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)" }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-7 text-center"
          style={{ animation: "pageFadeIn 0.2s ease both" }}
        >
          <div className="text-5xl mb-3">👀</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Still there?</h2>
          <p className="text-xs font-medium text-gray-400 mb-4 uppercase tracking-wide">
            No activity for {popup.idleMins} minutes
          </p>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Your timer is running but nothing has happened on screen for a while.
            Are you actively studying, or did you step away?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleIdlePause}
              className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-all text-sm"
            >
              Pause timer ⏸️
            </button>
            <button
              onClick={handleIdleStillStudying}
              className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all text-sm shadow-lg shadow-blue-200"
            >
              I'm studying 📚
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Clicking "I'm studying" records you as present
          </p>
        </div>
      </div>
    );
  }

  return null;
}
