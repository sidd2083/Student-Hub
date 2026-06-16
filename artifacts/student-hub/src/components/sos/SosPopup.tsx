/**
 * SOS Popup — shown to potential helpers when a student sends a Get Help request.
 * 30-second circular countdown, continuous beep via Web Audio API, spring entrance.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, X, Zap,
  BookOpen, FlaskConical, Calculator, Globe, Cpu,
} from "lucide-react";
import type { SosIncomingRequest } from "@/context/SosContext";
import { useSos } from "@/context/SosContext";

// ── Subject meta ───────────────────────────────────────────────────────────────

const SUBJECT_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  math:      { label: "Math",      icon: <Calculator className="w-3.5 h-3.5" />, color: "text-blue-700 dark:text-blue-300",    bg: "bg-blue-100 dark:bg-blue-900/40"    },
  physics:   { label: "Physics",   icon: <FlaskConical className="w-3.5 h-3.5" />, color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/40" },
  chemistry: { label: "Chemistry", icon: <FlaskConical className="w-3.5 h-3.5" />, color: "text-green-700 dark:text-green-300",   bg: "bg-green-100 dark:bg-green-900/40"   },
  biology:   { label: "Biology",   icon: <BookOpen className="w-3.5 h-3.5" />,     color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  english:   { label: "English",   icon: <Globe className="w-3.5 h-3.5" />,        color: "text-orange-700 dark:text-orange-300",  bg: "bg-orange-100 dark:bg-orange-900/40"  },
  nepali:    { label: "Nepali",    icon: <BookOpen className="w-3.5 h-3.5" />,     color: "text-red-700 dark:text-red-300",        bg: "bg-red-100 dark:bg-red-900/40"        },
  social:    { label: "Social",    icon: <Globe className="w-3.5 h-3.5" />,        color: "text-yellow-700 dark:text-yellow-300",  bg: "bg-yellow-100 dark:bg-yellow-900/40"  },
  computer:  { label: "Computer",  icon: <Cpu className="w-3.5 h-3.5" />,          color: "text-indigo-700 dark:text-indigo-300",  bg: "bg-indigo-100 dark:bg-indigo-900/40"  },
  accounts:  { label: "Accounts",  icon: <Calculator className="w-3.5 h-3.5" />,   color: "text-teal-700 dark:text-teal-300",      bg: "bg-teal-100 dark:bg-teal-900/40"      },
  economics: { label: "Economics", icon: <Globe className="w-3.5 h-3.5" />,        color: "text-amber-700 dark:text-amber-300",    bg: "bg-amber-100 dark:bg-amber-900/40"    },
  general:   { label: "General",   icon: <BookOpen className="w-3.5 h-3.5" />,     color: "text-gray-700 dark:text-gray-300",      bg: "bg-gray-100 dark:bg-gray-800"         },
};

function getSubjectMeta(subject: string) {
  return SUBJECT_META[subject.toLowerCase()] ?? SUBJECT_META["general"]!;
}

function getGradeLabel(g: unknown): string {
  const s = String(g ?? "").toLowerCase();
  if (s === "cee") return "CEE";
  if (s === "ioe") return "IOE";
  const n = Number(s);
  if (n >= 9 && n <= 12) return `Grade ${n}`;
  return `Grade ${s}`;
}

// ── Web Audio beep ─────────────────────────────────────────────────────────────

function playBeep(ctx: AudioContext, urgent: boolean) {
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = urgent ? 1040 : 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (urgent ? 0.12 : 0.18));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SosPopup({ request }: { request: SosIncomingRequest }) {
  const { acceptSos, rejectSos } = useSos();
  const totalSecs = Math.round(request.timeoutMs / 1000);

  const [secondsLeft,   setSecondsLeft]   = useState(totalSecs);
  const [phase,         setPhase]         = useState<"entering" | "visible" | "leaving">("entering");
  const [pulseKey,      setPulseKey]      = useState(0);

  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const autoRejectedRef  = useRef(false);
  const urgentRef        = useRef(false);

  // ── Entrance spring ──────────────────────────────────────────────────────
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("visible"));
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  // ── Web Audio beeping ─────────────────────────────────────────────────────
  useEffect(() => {
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
      ctx.resume().then(() => {
        playBeep(ctx, false);
        beepIntervalRef.current = setInterval(() => {
          playBeep(ctx, urgentRef.current);
          if (urgentRef.current) setPulseKey(k => k + 1);
        }, urgentRef.current ? 550 : 900);
      }).catch(() => {});
    } catch {}
    return () => {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Adjust beep speed when urgent changes (< 10 s)
  useEffect(() => {
    if (secondsLeft <= 10 && !urgentRef.current) {
      urgentRef.current = true;
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      const ctx = audioCtxRef.current;
      if (ctx) {
        beepIntervalRef.current = setInterval(() => {
          playBeep(ctx, true);
          setPulseKey(k => k + 1);
        }, 500);
      }
    }
  }, [secondsLeft]);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (!autoRejectedRef.current) {
            autoRejectedRef.current = true;
            stopAll();
            setPhase("leaving");
            setTimeout(() => rejectSos(request.requestId), 280);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [request.requestId, rejectSos]);

  function stopAll() {
    if (timerRef.current)        clearInterval(timerRef.current);
    if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
    audioCtxRef.current?.close().catch(() => {});
  }

  const handleAccept = () => {
    stopAll();
    setPhase("leaving");
    setTimeout(() => acceptSos(request.requestId), 280);
  };

  const handleReject = () => {
    stopAll();
    setPhase("leaving");
    setTimeout(() => rejectSos(request.requestId), 280);
  };

  // ── SVG ring ──────────────────────────────────────────────────────────────
  const isUrgent    = secondsLeft <= 10;
  const progress    = secondsLeft / totalSecs;
  const radius      = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset  = circumference * (1 - progress);

  const subjectMeta  = getSubjectMeta(request.subject);
  const gradeLabel   = getGradeLabel(request.requesterGrade);

  const isVisible  = phase === "visible";
  const isLeaving  = phase === "leaving";

  const popup = (
    <>
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 z-[9995] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at bottom right, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 100%)",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.35s ease",
        }}
      />

      {/* Card wrapper */}
      <div
        className="fixed bottom-5 right-5 z-[9997] w-full"
        style={{ maxWidth: 360 }}
      >
        {/* Animated glow ring */}
        <div
          className="absolute -inset-[3px] rounded-[24px]"
          style={{
            background: isUrgent
              ? "linear-gradient(135deg, #ef4444 0%, #f97316 50%, #ef4444 100%)"
              : "linear-gradient(135deg, #ef4444 0%, #f59e0b 50%, #ef4444 100%)",
            backgroundSize: "300% 300%",
            animation: `sosGradientShift ${isUrgent ? "0.8s" : "2s"} ease infinite`,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "scale(1)" : "scale(0.88)",
            transition: "transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
          }}
        />

        {/* Card */}
        <div
          className="relative bg-white dark:bg-gray-950 rounded-[22px] overflow-hidden shadow-2xl"
          style={{
            transform: isLeaving
              ? "translateY(120%) scale(0.88)"
              : isVisible
                ? "translateY(0) scale(1)"
                : "translateY(100%) scale(0.88)",
            opacity: isVisible ? 1 : 0,
            transition: isLeaving
              ? "transform 0.28s ease-in, opacity 0.25s ease-in"
              : "transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease",
          }}
        >
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full"
              style={{
                width: `${progress * 100}%`,
                background: isUrgent
                  ? "linear-gradient(90deg, #ef4444, #f97316)"
                  : "linear-gradient(90deg, #6366f1, #ef4444)",
                transition: "width 1s linear",
              }}
            />
          </div>

          <div className="p-5">
            {/* Top row: alert icon + label + circular timer */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                {/* Pulsing icon */}
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, #ef4444, #f97316)",
                      boxShadow: isUrgent
                        ? "0 0 0 6px rgba(239,68,68,0.3), 0 4px 14px rgba(239,68,68,0.45)"
                        : "0 4px 14px rgba(239,68,68,0.35)",
                      animation: "sosPulse 1.2s ease-in-out infinite",
                    }}
                  >
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <span
                    className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-950"
                    style={{ animation: "sosDot 1s ease-in-out infinite" }}
                  />
                </div>

                <div>
                  <p className="text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-[0.12em] leading-tight">
                    Get Help Request!
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                    {request.requesterName}
                  </p>
                </div>
              </div>

              {/* Circular countdown */}
              <div className="relative flex items-center justify-center w-[68px] h-[68px] shrink-0">
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 76 76"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  <circle
                    cx="38" cy="38" r={radius}
                    fill="none"
                    stroke={isUrgent ? "#fee2e2" : "#e5e7eb"}
                    strokeWidth="5"
                  />
                  <circle
                    cx="38" cy="38" r={radius}
                    fill="none"
                    stroke={isUrgent ? "#ef4444" : "#6366f1"}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
                  />
                </svg>
                <span
                  className="text-xl font-black tabular-nums"
                  style={{
                    color: isUrgent ? "#ef4444" : "#374151",
                    transform: secondsLeft <= 5 ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.2s, color 0.5s",
                  }}
                >
                  {secondsLeft}
                </span>
              </div>
            </div>

            {/* Topic title */}
            <div className="mb-3 px-3.5 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2">
                {request.topicTitle}
              </p>
            </div>

            {/* Grade + subject badges */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                📚 {gradeLabel}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${subjectMeta.bg} ${subjectMeta.color}`}>
                {subjectMeta.icon}
                {subjectMeta.label}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5">
              <button
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm font-semibold hover:border-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-95 select-none"
              >
                <X className="w-4 h-4" />
                Pass
              </button>
              <button
                onClick={handleAccept}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-black transition-all active:scale-95 select-none"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  boxShadow: "0 4px 18px rgba(34,197,94,0.45)",
                  letterSpacing: "0.01em",
                }}
              >
                <Zap className="w-4 h-4" />
                Help Now!
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animations (injected once) */}
      <style>{`
        @keyframes sosPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5), 0 4px 14px rgba(239,68,68,0.35); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0), 0 4px 14px rgba(239,68,68,0.35); }
        }
        @keyframes sosDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.2; transform: scale(0.7); }
        }
        @keyframes sosGradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </>
  );

  return createPortal(popup, document.body);
}
