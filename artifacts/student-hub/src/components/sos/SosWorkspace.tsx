/**
 * SOS Workspace — Full-screen collaborative session overlay.
 *
 * Desktop: side-by-side canvas (left) + chat (right)
 * Mobile:  tab slider (Chat | Canvas)
 *
 * Automatically pauses the Pomodoro timer for helpers on mount
 * and resumes it on unmount.
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

// ── End-confirm modal ─────────────────────────────────────────────────────────

function EndConfirmModal({
  onYes,
  onNo,
}: {
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-7 w-full max-w-xs mx-4 text-center">
        <div className="text-3xl mb-2">🛑</div>
        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">End Session?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Do you want to end this session and submit ratings?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            No, Continue
          </button>
          <button
            onClick={onYes}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors active:scale-95"
          >
            Yes, End
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

  // Elapsed session timer
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Mobile tab state
  const [activeTab, setActiveTab] = useState<"chat" | "canvas">("chat");

  // Connection indicator
  const [connected, setConnected] = useState(() => getSocket().connected);

  // ── Pause timer for helper ──────────────────────────────────────────────
  useEffect(() => {
    if (session.role === "helper") {
      wasRunningRef.current = running;
      if (running) pause();
    }
    return () => {
      if (session.role === "helper" && wasRunningRef.current) {
        start();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Elapsed timer ───────────────────────────────────────────────────────
  useEffect(() => {
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Socket connection indicator ─────────────────────────────────────────
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

  const handleEndClick = useCallback(() => {
    requestEndSession();
  }, [requestEndSession]);

  const overlay = (
    <div className="fixed inset-0 z-[9996] flex flex-col bg-gray-50 dark:bg-gray-950">

      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
        {/* SOS badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            SOS
          </span>
        </div>

        {/* Topic */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
            {session.topicTitle}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            With {session.partner.name} · Grade {session.partner.grade ?? "–"}
          </p>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-sm font-mono font-medium">{elapsedStr}</span>
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
          End
        </button>
      </div>

      {/* ── Desktop: split layout ────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left: Canvas */}
        <div className="flex-1 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          <SosCanvas />
        </div>
        {/* Right: Chat */}
        <div className="w-80 lg:w-96 shrink-0 overflow-hidden">
          <SosChat session={session} />
        </div>
      </div>

      {/* ── Mobile: tab layout ───────────────────────────────────────────── */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "chat"
            ? <SosChat session={session} />
            : <SosCanvas />
          }
        </div>

        {/* Fixed bottom tab bar */}
        <div className="shrink-0 flex border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {(["chat", "canvas"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "text-blue-600 dark:text-blue-400 border-t-2 border-blue-500"
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

      {/* ── End-confirm prompt (shown on both screens) ───────────────────── */}
      {session.showEndPrompt && (
        <EndConfirmModal
          onYes={confirmEndSession}
          onNo={cancelEndSession}
        />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
