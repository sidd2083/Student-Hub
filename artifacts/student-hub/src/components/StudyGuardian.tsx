import { useEffect, useRef, useState } from "react";
import { useTimer } from "@/context/TimerContext";
import type { Phase } from "@/context/TimerContext";

type AudioCtxCtor = typeof AudioContext;
function getAudioCtx() {
  return new ((window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext || AudioContext)();
}

// ── Alert beep — loud 3 escalating tones ─────────────────────────────────────
function playAlertBeep() {
  try {
    const ctx = getAudioCtx();
    ctx.resume().then(() => {
      [{ freq: 660, t: 0.0 }, { freq: 880, t: 0.28 }, { freq: 1100, t: 0.56 }]
        .forEach(({ freq, t }) => {
          const osc = ctx.createOscillator();
          const g   = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.type = "square";
          osc.frequency.value = freq;
          g.gain.setValueAtTime(0.4, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.22);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + 0.25);
        });
    });
  } catch {}
}

// ── Wellness chime — soft 2-tone sine ────────────────────────────────────────
function playWellnessChime() {
  try {
    const ctx = getAudioCtx();
    ctx.resume().then(() => {
      [{ freq: 523, t: 0.0 }, { freq: 659, t: 0.22 }].forEach(({ freq, t }) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.22, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.55);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.6);
      });
    });
  } catch {}
}

// ── Browser notification — fires even when user is on another tab ─────────────
let _permAsked = false;
function requestNotifPermission() {
  if (_permAsked) return;
  _permAsked = true;
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
function sendStudyNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "/icon-192.png", tag: "study-guardian" }); } catch {}
  }
}

// ── Wellness messages (rotate through them) ──────────────────────────────────
const WELLNESS = [
  { emoji: "💧", msg: "Did you drink any water in the last hour?" },
  { emoji: "👀", msg: "20-20-20 rule — look at something 20 feet away for 20 seconds!" },
  { emoji: "🧘", msg: "Quick neck roll — left, right, forward, back. Feel better?" },
  { emoji: "🪑", msg: "How's your posture? Sit up straight and relax your shoulders!" },
  { emoji: "🌬️", msg: "Slow deep breath in... hold... and out. You're doing great!" },
  { emoji: "🤸", msg: "Shake out your wrists and fingers — they've been working hard!" },
  { emoji: "🍎", msg: "Have you eaten anything recently? Your brain needs fuel!" },
  { emoji: "🌟", msg: "You've been studying for a really long time. You're absolutely crushing it!" },
  { emoji: "📖", msg: "Quick brain check — what's one thing you've learned in the last hour?" },
];

// ── Popup shapes ─────────────────────────────────────────────────────────────
type PopupKind =
  | { kind: "absent"; phase: Phase }
  | { kind: "wellness"; idx: number }
  | null;

// ── Absent popup ─────────────────────────────────────────────────────────────
function AbsentPopup({
  isWork,
  onYes,
  onNo,
}: {
  isWork: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-7 text-center"
        style={{ animation: "pageFadeIn 0.2s ease both" }}
      >
        <div className="text-5xl mb-4">{isWork ? "🤔" : "☕"}</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isWork ? "Are you still studying?" : "Is your break over?"}
        </h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {isWork
            ? "You've been away for a while. If you're still focused, keep going — we won't stop your timer!"
            : "You stepped away during your break. Ready to get back to it?"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-semibold hover:bg-gray-200 transition-all text-sm"
          >
            {isWork ? "Take a break 😴" : "End break early ⏩"}
          </button>
          <button
            onClick={onYes}
            className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all text-sm shadow-lg shadow-blue-200"
          >
            {isWork ? "Yes, I'm studying! 💪" : "Still on break 🛋️"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          {isWork
            ? "Say no → timer switches to break mode"
            : "Say 'End break early' → ready for next work session"}
        </p>
      </div>
    </div>
  );
}

// ── Wellness popup ────────────────────────────────────────────────────────────
function WellnessPopup({
  emoji,
  message,
  onDismiss,
}: {
  emoji: string;
  message: string;
  onDismiss: () => void;
}) {
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
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Main StudyGuardian ────────────────────────────────────────────────────────
export function StudyGuardian() {
  const { phase, running, skipPhase } = useTimer();

  const [popup, setPopup] = useState<PopupKind>(null);

  // Request browser notification permission once when timer first starts
  useEffect(() => {
    if (running) requestNotifPermission();
  }, [running]);

  // Refs that stay stable across re-renders
  const runningRef        = useRef(running);
  const phaseRef          = useRef<Phase>(phase);
  const popupRef          = useRef<PopupKind>(null);

  // Tab-away tracking
  const hiddenAtRef       = useRef<number | null>(null);
  const lastConfirmedRef  = useRef<number | null>(null);

  // On-page activity tracking
  const lastActivityRef   = useRef<number>(Date.now());
  const totalRunSecsRef   = useRef<number>(0);   // cumulative seconds the timer was running
  const lastWellnessRef   = useRef<number | null>(null);
  const wellnessIdxRef    = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { phaseRef.current   = phase;   }, [phase]);
  useEffect(() => { popupRef.current   = popup;   }, [popup]);

  // Reset accumulated run-time when timer resets (running goes false then true)
  // We simply always increment while running — good enough for the 1.5h threshold
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { totalRunSecsRef.current += 1; }, 1_000);
    return () => clearInterval(id);
  }, [running]);

  // ── Activity detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const touch = () => { lastActivityRef.current = Date.now(); };
    const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    EVENTS.forEach(ev => window.addEventListener(ev, touch, { passive: true }));
    return () => EVENTS.forEach(ev => window.removeEventListener(ev, touch));
  }, []);

  // ── Wellness check — every 90 s ────────────────────────────────────────────
  // Triggers only when: timer has run ≥ 1.5 h AND page-idle ≥ 20 min AND no
  // wellness popup shown in the last 20 min.
  useEffect(() => {
    const id = setInterval(() => {
      if (!runningRef.current)              return;
      if (popupRef.current !== null)        return;
      if (totalRunSecsRef.current < 5_400)  return; // < 1.5 h total
      const idleSecs = (Date.now() - lastActivityRef.current) / 1_000;
      if (idleSecs < 20 * 60)              return; // < 20 min idle
      if (lastWellnessRef.current && Date.now() - lastWellnessRef.current < 20 * 60_000) return;

      const idx = wellnessIdxRef.current % WELLNESS.length;
      wellnessIdxRef.current++;
      lastWellnessRef.current = Date.now();
      playWellnessChime();
      sendStudyNotification("Study Guardian 🌟", WELLNESS[idx].msg);
      setPopup({ kind: "wellness", idx });
    }, 90_000);
    return () => clearInterval(id);
  }, []);

  // ── Tab-away detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      if (document.hidden) {
        // Tab went hidden
        if (runningRef.current) hiddenAtRef.current = Date.now();
      } else {
        // Tab came back
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (!hiddenAt || !runningRef.current) return;

        const awayMs = Date.now() - hiddenAt;

        // ≥ 60 min away → auto-switch phase, no popup
        if (awayMs >= 60 * 60_000) {
          skipPhase();
          lastConfirmedRef.current = null;
          return;
        }

        // < 10 min away → do nothing, timer kept running fine
        if (awayMs < 10 * 60_000) return;

        // 10–60 min: show popup if user hasn't confirmed in last 30 min
        const lastConfirm = lastConfirmedRef.current;
        const sinceConfirm = lastConfirm ? Date.now() - lastConfirm : Infinity;
        if (sinceConfirm >= 30 * 60_000) {
          playAlertBeep();
          sendStudyNotification(
            phaseRef.current === "work" ? "Study Guardian 🤔" : "Study Guardian ☕",
            phaseRef.current === "work"
              ? "Are you still studying? Check in to keep your timer running."
              : "Is your break over? Come back and start your next session.",
          );
          setPopup({ kind: "absent", phase: phaseRef.current });
        }
      }
    };

    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [skipPhase]);

  // ── Popup handlers ─────────────────────────────────────────────────────────
  const handleAbsentYes = () => {
    lastConfirmedRef.current = Date.now();
    lastActivityRef.current  = Date.now();
    setPopup(null);
  };

  const handleAbsentNo = () => {
    skipPhase(); // work → break ready, or break → work ready
    setPopup(null);
  };

  const handleWellnessDismiss = () => {
    lastActivityRef.current = Date.now();
    setPopup(null);
  };

  if (!popup) return null;

  if (popup.kind === "absent") {
    return (
      <AbsentPopup
        isWork={popup.phase === "work"}
        onYes={handleAbsentYes}
        onNo={handleAbsentNo}
      />
    );
  }

  if (popup.kind === "wellness") {
    const { emoji, msg } = WELLNESS[popup.idx];
    return (
      <WellnessPopup
        emoji={emoji}
        message={msg}
        onDismiss={handleWellnessDismiss}
      />
    );
  }

  return null;
}
