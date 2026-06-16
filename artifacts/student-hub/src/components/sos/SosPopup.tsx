/**
 * SOS Popup — shown to potential helpers when a student sends an SOS.
 * Renders as a high-priority floating alert with a 30-second countdown.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X, Check, BookOpen, FlaskConical, Calculator, Globe, Cpu } from "lucide-react";
import type { SosIncomingRequest } from "@/context/SosContext";
import { useSos } from "@/context/SosContext";

const SUBJECT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  math:      { label: "Math",         icon: <Calculator className="w-4 h-4" />, color: "bg-blue-100 text-blue-700"   },
  physics:   { label: "Physics",      icon: <FlaskConical className="w-4 h-4" />, color: "bg-purple-100 text-purple-700" },
  chemistry: { label: "Chemistry",    icon: <FlaskConical className="w-4 h-4" />, color: "bg-green-100 text-green-700"  },
  biology:   { label: "Biology",      icon: <BookOpen className="w-4 h-4" />, color: "bg-emerald-100 text-emerald-700" },
  english:   { label: "English",      icon: <Globe className="w-4 h-4" />,    color: "bg-orange-100 text-orange-700"  },
  nepali:    { label: "Nepali",       icon: <BookOpen className="w-4 h-4" />, color: "bg-red-100 text-red-700"       },
  social:    { label: "Social",       icon: <Globe className="w-4 h-4" />,    color: "bg-yellow-100 text-yellow-700" },
  computer:  { label: "Computer",     icon: <Cpu className="w-4 h-4" />,      color: "bg-indigo-100 text-indigo-700" },
  accounts:  { label: "Accounts",     icon: <Calculator className="w-4 h-4" />, color: "bg-teal-100 text-teal-700"  },
  economics: { label: "Economics",    icon: <Globe className="w-4 h-4" />,    color: "bg-amber-100 text-amber-700"   },
  general:   { label: "General",      icon: <BookOpen className="w-4 h-4" />, color: "bg-gray-100 text-gray-700"    },
};

function getSubjectMeta(subject: string) {
  return SUBJECT_META[subject.toLowerCase()] ?? SUBJECT_META.general!;
}

export function SosPopup({ request }: { request: SosIncomingRequest }) {
  const { acceptSos, rejectSos } = useSos();
  const totalSecs = Math.round(request.timeoutMs / 1000);
  const [secondsLeft, setSecondsLeft] = useState(totalSecs);
  const [entering, setEntering] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRejectedRef = useRef(false);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 50);
    return () => clearTimeout(t);
  }, []);

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (!autoRejectedRef.current) {
            autoRejectedRef.current = true;
            rejectSos(request.requestId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [request.requestId, rejectSos]);

  const handleAccept = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setLeaving(true);
    setTimeout(() => acceptSos(request.requestId), 200);
  };

  const handleReject = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setLeaving(true);
    setTimeout(() => rejectSos(request.requestId), 200);
  };

  const subjectMeta = getSubjectMeta(request.subject);
  const progress = (secondsLeft / totalSecs) * 100;

  const popup = (
    <div
      className="fixed bottom-6 right-6 z-[9997] w-full max-w-sm"
      style={{
        transform: entering || leaving ? "translateY(120%) scale(0.9)" : "translateY(0) scale(1)",
        opacity: entering || leaving ? 0 : 1,
        transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Countdown progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  ⚡ SOS Help Request
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Grade {request.requesterGrade} · {request.requesterName}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0">
              <span className={`text-sm font-bold ${secondsLeft <= 10 ? "text-red-500" : "text-gray-600 dark:text-gray-300"}`}>
                {secondsLeft}
              </span>
            </div>
          </div>

          {/* Topic */}
          <div className="mb-3">
            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2">
              {request.topicTitle}
            </p>
          </div>

          {/* Subject badge */}
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${subjectMeta.color}`}>
              {subjectMeta.icon}
              {subjectMeta.label}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-95"
            >
              <X className="w-4 h-4" />
              Pass
            </button>
            <button
              onClick={handleAccept}
              className="flex-2 flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors active:scale-95 shadow-lg shadow-green-500/30"
            >
              <Check className="w-4 h-4" />
              Help Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
