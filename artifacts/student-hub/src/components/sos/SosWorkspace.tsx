/**
 * SOS Workspace — Full-screen collaborative session overlay.
 *
 * Desktop: side-by-side Canvas (left) + Chat (right)
 * Mobile:  tab bar bottom — Chat | Canvas — BOTH stay mounted (CSS hide/show)
 *          so chat messages survive tab switches.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneOff, MessageCircle, PenLine, Clock, Wifi, WifiOff } from "lucide-react";
import { SosCanvas } from "./SosCanvas";
import { SosChat } from "./SosChat";
import { useSos, type SosSession } from "@/context/SosContext";
import { useTimer } from "@/context/TimerContext";
import { getSocket } from "@/lib/socket";

function pad(n: number) { return String(n).padStart(2, "0"); }

function getGradeLabel(g: unknown): string {
  const s = String(g ?? "").toLowerCase();
  if (s === "cee" || s === "13") return "CEE/Medical";
  if (s === "ioe" || s === "14") return "IOE/Engineering";
  if (s === "15") return "Bachelor's";
  const n = Number(s);
  if (n >= 9 && n <= 12) return `Grade ${n}`;
  return s ? `Grade ${s}` : "—";
}

const SUBJECT_LABELS: Record<string, string> = {
  math: "Math", physics: "Physics", chemistry: "Chemistry", biology: "Biology",
  english: "English", nepali: "Nepali", social: "Social", computer: "Computer",
  accounts: "Accounts", economics: "Economics", general: "General",
};

// ── End-confirm modal ─────────────────────────────────────────────────────────

function EndConfirmModal({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-7 w-full max-w-xs text-center">
        <div className="text-3xl mb-2">🛑</div>
        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">End Session?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          This will close the session and prompt ratings for both of you.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Continue
          </button>
          <button
            onClick={onYes}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors active:scale-95"
          >
            End
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main workspace component ──────────────────────────────────────────────────

export function SosWorkspace({ session }: { session: SosSession }) {
  const { requestEndSession, confirmEndSession, cancelEndSession } = useSos();
  const { pause, start, running } = useTimer();
  const wasRunningRef = useRef(false);

  const [elapsed, setElapsed]     = useState(0);
  const startTimeRef              = useRef(Date.now());
  const [activeTab, setActiveTab] = useState<"chat" | "canvas">("chat");
  const [connected, setConnected] = useState(() => getSocket().connected);

  // ── Pause timer for helper on mount, resume on unmount ──────────────────
  useEffect(() => {
    if (session.role === "helper") {
      wasRunningRef.current = running;
      if (running) pause();
    }
    return () => {
      if (session.role === "helper" && wasRunningRef.current) start();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Session elapsed timer ────────────────────────────────────────────────
  useEffect(() => {
    startTimeRef.current = Date.now();
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Socket connection indicator ──────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const elapsedStr = `${pad(Math.floor(elapsed / 60))}:${pad(elapsed % 60)}`;
  const handleEndClick = useCallback(() => requestEndSession(), [requestEndSession]);

  const partnerGradeLabel  = getGradeLabel(session.partner.grade);
  const subjectLabel       = SUBJECT_LABELS[session.subject?.toLowerCase() ?? ""] ?? session.subject ?? "";

  const overlay = (
    <div className="fixed inset-0 z-[9996] flex flex-col bg-gray-50 dark:bg-gray-950">

      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">

        {/* Live badge */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[11px] font-bold shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </span>

        {/* Partner info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-white text-sm truncate leading-tight">
            {session.topicTitle}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              with {session.partner.name}
            </span>
            {partnerGradeLabel && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shrink-0">
                {partnerGradeLabel}
              </span>
            )}
            {subjectLabel && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shrink-0">
                {subjectLabel}
              </span>
            )}
          </div>
        </div>

        {/* Session timer */}
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-sm font-mono font-semibold tabular-nums">{elapsedStr}</span>
        </div>

        {/* Connection indicator */}
        <div className="shrink-0" title={connected ? "Connected" : "Reconnecting…"}>
          {connected
            ? <Wifi className="w-4 h-4 text-green-500" />
            : <WifiOff className="w-4 h-4 text-red-400 animate-pulse" />
          }
        </div>

        {/* End button */}
        <button
          onClick={handleEndClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors active:scale-95 shadow-sm shrink-0"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">End</span>
        </button>
      </div>

      {/* ── Desktop: side-by-side layout ─────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-1 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          <SosCanvas />
        </div>
        <div className="w-80 lg:w-96 shrink-0 overflow-hidden">
          <SosChat session={session} />
        </div>
      </div>

      {/* ── Mobile: both mounted, hidden/shown via CSS (keeps messages) ── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          {/* Chat — always mounted */}
          <div className={`absolute inset-0 overflow-hidden ${activeTab === "chat" ? "" : "invisible pointer-events-none"}`}>
            <SosChat session={session} />
          </div>
          {/* Canvas — always mounted */}
          <div className={`absolute inset-0 overflow-hidden ${activeTab === "canvas" ? "" : "invisible pointer-events-none"}`}>
            <SosCanvas />
          </div>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {(["chat", "canvas"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "text-blue-600 dark:text-blue-400 border-t-2 border-blue-500 -mt-px"
                  : "text-gray-500 dark:text-gray-400 border-t-2 border-transparent"
              }`}
            >
              {tab === "chat"
                ? <MessageCircle className="w-5 h-5" />
                : <PenLine className="w-5 h-5" />
              }
              {tab === "chat" ? "Chat" : "Canvas"}
            </button>
          ))}
        </div>
      </div>

      {/* End-session confirmation prompt */}
      {session.showEndPrompt && (
        <EndConfirmModal onYes={confirmEndSession} onNo={cancelEndSession} />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
