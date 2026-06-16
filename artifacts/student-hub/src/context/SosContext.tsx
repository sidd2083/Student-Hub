/**
 * SOS Network — Global Context
 *
 * Manages all SOS socket events, session state, and provides actions
 * to child components. Renders the global popup and workspace overlays.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/context/AuthContext";
import { SosPopup } from "@/components/sos/SosPopup";
import { SosWorkspace } from "@/components/sos/SosWorkspace";
import { prewarmAudio } from "@/lib/sosAudio";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SosPartnerInfo {
  uid: string;
  name: string;
  photoURL?: string;
  grade?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
}

export interface SosIncomingRequest {
  requestId: string;
  topicTitle: string;
  subject: string;
  requesterName: string;
  requesterGrade: number;
  timeoutMs: number;
}

export interface SosSession {
  sessionId: string;
  role: "requester" | "helper";
  topicTitle: string;
  subject: string;
  partner: SosPartnerInfo;
  endRequestedByPartner: boolean;
  showEndPrompt: boolean;
}

export type SosRequestStatus =
  | "idle"
  | "searching"
  | "waiting"
  | "no_helpers";

interface SosContextType {
  /** Current status of an outgoing SOS request */
  requestStatus: SosRequestStatus;
  outgoingRequestId: string | null;
  /** Incoming popup data (shown to potential helpers) */
  incomingRequest: SosIncomingRequest | null;
  /** Active session data */
  session: SosSession | null;
  /** Show the end-confirm prompt */
  showRatingModal: boolean;
  /** Number of users currently online in Get Help system */
  onlineCount: number;

  sendSosRequest: (topicTitle: string, subject: string, helpGrade?: string) => void;
  cancelSosRequest: () => void;
  acceptSos: (requestId: string) => void;
  rejectSos: (requestId: string) => void;
  sendChatMessage: (text: string) => void;
  sendCanvasDraw: (data: {
    points: { x: number; y: number }[];
    tool: string;
    color: string;
    size: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => void;
  sendCanvasImage: (dataUrl: string, canvasWidth: number, canvasHeight: number) => void;
  sendCanvasClear: () => void;
  requestEndSession: () => void;
  confirmEndSession: () => void;
  cancelEndSession: () => void;
  submitRating: (rating: "great" | "decent" | "bad") => void;
  dismissRating: () => void;
  /** Register / update user metadata in the server's ActiveUsers map */
  registerUser: (opts?: { todayStudyMinutes?: number; streakDays?: number }) => void;
  setCurrentStatus: (
    status: "idle" | "pomodoro" | "study_room",
    opts?: { todayStudyMinutes?: number; streakDays?: number },
  ) => void;
}

export const SosContext = createContext<SosContextType | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read social handles from localStorage */
function getSocialHandles(): { instagramHandle?: string; tiktokHandle?: string } {
  try {
    const raw = localStorage.getItem("sh_social_handles");
    if (!raw) return {};
    return JSON.parse(raw) as { instagramHandle?: string; tiktokHandle?: string };
  } catch {
    return {};
  }
}

/** Read subject mastery from localStorage (set by SosNetwork page) */
function getSubjectMastery(): Record<string, number> {
  try {
    const raw = localStorage.getItem("sh_subject_mastery");
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Read notification opt-in preference from localStorage (default: true) */
function getAllowNotifications(): boolean {
  try {
    const raw = localStorage.getItem("sh_allow_notifications");
    if (raw === null) return true;
    return raw !== "false";
  } catch {
    return true;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SosProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();

  const [requestStatus, setRequestStatus] = useState<SosRequestStatus>("idle");
  const [outgoingRequestId, setOutgoingRequestId] = useState<string | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<SosIncomingRequest | null>(null);
  const [session, setSession] = useState<SosSession | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  // Track mount to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Pre-warm Web Audio on first user gesture so SOS popup sounds work on iOS
  useEffect(() => {
    const warm = () => prewarmAudio();
    document.addEventListener("touchstart", warm, { once: true, passive: true });
    document.addEventListener("click",      warm, { once: true, passive: true });
    return () => {
      document.removeEventListener("touchstart", warm);
      document.removeEventListener("click",      warm);
    };
  }, []);

  // ── Register / update user ──────────────────────────────────────────────
  const registerUser = useCallback(
    (opts?: { todayStudyMinutes?: number; streakDays?: number }) => {
      if (!user || !profile) return;
      const socket = getSocket();
      const handles = getSocialHandles();
      const mastery = getSubjectMastery();

      // Read study stats from the timer localStorage key
      let todayStudyMinutes = opts?.todayStudyMinutes ?? 0;
      let streakDays = opts?.streakDays ?? 0;
      try {
        const raw = localStorage.getItem("studenthub_timer_state");
        if (raw) {
          const s = JSON.parse(raw) as { savedMinutesToday?: number };
          if (!opts?.todayStudyMinutes && s.savedMinutesToday)
            todayStudyMinutes = s.savedMinutesToday;
        }
        // Read streak from profile cache
        const pcRaw = localStorage.getItem("studenthub_profile_v2");
        if (pcRaw) {
          const pc = JSON.parse(pcRaw) as { profile?: { streak?: number } };
          if (!opts?.streakDays && pc.profile?.streak) streakDays = pc.profile.streak;
        }
      } catch {}

      socket.emit("sos_register", {
        uid: user.uid,
        name: profile.name,
        photoURL: profile.photoURL,
        grade: profile.grade,
        todayStudyMinutes,
        streakDays,
        subjectMastery: mastery,
        allowNotifications: getAllowNotifications(),
        ...handles,
      });
    },
    [user, profile],
  );

  const setCurrentStatus = useCallback(
    (
      status: "idle" | "pomodoro" | "study_room",
      opts?: { todayStudyMinutes?: number; streakDays?: number },
    ) => {
      if (!user) return;
      getSocket().emit("sos_update_status", { status, ...opts });
    },
    [user],
  );

  // ── Register when user is available ───────────────────────────────────────
  useEffect(() => {
    if (!user || !profile) return;
    const socket = getSocket();

    // Register once connected (or if already connected)
    const doRegister = () => registerUser();
    if (socket.connected) doRegister();
    socket.on("connect", doRegister);
    doRegister();

    return () => {
      socket.off("connect", doRegister);
    };
  }, [user, profile, registerUser]);

  // ── Socket event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    // Incoming SOS popup
    const onPopup = (data: SosIncomingRequest) => {
      if (!mountedRef.current) return;
      setIncomingRequest(data);
    };

    // Popup cleared (someone else accepted, or timed out)
    const onPopupClear = () => {
      if (!mountedRef.current) return;
      setIncomingRequest(null);
    };

    // Our search yielded a result — helper accepted
    const onSessionStart = (data: {
      sessionId: string;
      role: "requester" | "helper";
      topicTitle: string;
      subject: string;
      partner: SosPartnerInfo;
    }) => {
      if (!mountedRef.current) return;
      setIncomingRequest(null);
      setRequestStatus("idle");
      setOutgoingRequestId(null);
      setSession({
        sessionId: data.sessionId,
        role: data.role,
        topicTitle: data.topicTitle,
        subject: data.subject,
        partner: data.partner,
        endRequestedByPartner: false,
        showEndPrompt: false,
      });
    };

    // Server couldn't find helpers even after waiting
    const onNoHelpers = () => {
      if (!mountedRef.current) return;
      setRequestStatus("no_helpers");
      setOutgoingRequestId(null);
    };

    // SOS searching acknowledgement (helpers found immediately)
    const onSearching = (data: { requestId: string }) => {
      if (!mountedRef.current) return;
      setRequestStatus("searching");
      setOutgoingRequestId(data.requestId);
    };

    // Entered waiting queue — no helpers right now, will notify when someone comes online
    const onWaiting = (data: { requestId: string }) => {
      if (!mountedRef.current) return;
      setRequestStatus("waiting");
      setOutgoingRequestId(data.requestId);
    };

    // Online count update from server
    const onOnlineCount = (data: { count: number }) => {
      if (!mountedRef.current) return;
      setOnlineCount(data.count);
    };

    // Partner wants to end — show confirm prompt on both screens
    const onEndConfirmPrompt = () => {
      if (!mountedRef.current) return;
      setSession(prev =>
        prev ? { ...prev, showEndPrompt: true, endRequestedByPartner: true } : prev,
      );
    };

    // Partner cancelled the end request
    const onEndCancelled = () => {
      if (!mountedRef.current) return;
      setSession(prev =>
        prev ? { ...prev, showEndPrompt: false, endRequestedByPartner: false } : prev,
      );
    };

    // Session confirmed as ended — show rating modal
    const onSessionEnded = () => {
      if (!mountedRef.current) return;
      setSession(null);
      setShowRatingModal(true);
    };

    // Partner disconnected unexpectedly
    const onPartnerDisconnected = () => {
      if (!mountedRef.current) return;
      setSession(null);
      setShowRatingModal(false);
    };

    // Server tells this helper to pause their Pomodoro instantly on acceptance
    const onTimerPause = () => {
      window.dispatchEvent(new CustomEvent("sh:pomodoro:pause"));
    };

    socket.on("sos_popup",               onPopup);
    socket.on("sos_popup_clear",         onPopupClear);
    socket.on("sos_popup_expired",       onPopupClear);
    socket.on("sos_session_start",       onSessionStart);
    socket.on("sos_no_helpers",          onNoHelpers);
    socket.on("sos_searching",           onSearching);
    socket.on("sos_waiting",             onWaiting);
    socket.on("sos_online_count",        onOnlineCount);
    socket.on("sos_end_confirm_prompt",  onEndConfirmPrompt);
    socket.on("sos_end_cancelled",       onEndCancelled);
    socket.on("sos_session_ended",       onSessionEnded);
    socket.on("sos_partner_disconnected",onPartnerDisconnected);
    socket.on("sos_timer_pause",         onTimerPause);

    return () => {
      socket.off("sos_popup",               onPopup);
      socket.off("sos_popup_clear",         onPopupClear);
      socket.off("sos_popup_expired",       onPopupClear);
      socket.off("sos_session_start",       onSessionStart);
      socket.off("sos_no_helpers",          onNoHelpers);
      socket.off("sos_searching",           onSearching);
      socket.off("sos_waiting",             onWaiting);
      socket.off("sos_online_count",        onOnlineCount);
      socket.off("sos_end_confirm_prompt",  onEndConfirmPrompt);
      socket.off("sos_end_cancelled",       onEndCancelled);
      socket.off("sos_session_ended",       onSessionEnded);
      socket.off("sos_partner_disconnected",onPartnerDisconnected);
      socket.off("sos_timer_pause",         onTimerPause);
    };
  }, [user]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const sendSosRequest = useCallback(
    (topicTitle: string, subject: string, helpGrade?: string) => {
      if (!profile) return;
      setRequestStatus("searching");
      const validGrades = new Set(["9","10","11","12","cee","ioe"]);
      const resolvedGrade = helpGrade && validGrades.has(helpGrade.toLowerCase())
        ? helpGrade.toLowerCase()
        : String(profile.grade ?? "10").toLowerCase();
      getSocket().emit("client_sos_request", {
        topicTitle,
        subject,
        helpGrade: resolvedGrade,
      });
    },
    [profile],
  );

  const cancelSosRequest = useCallback(() => {
    const rid = outgoingRequestId;
    setRequestStatus("idle");
    setOutgoingRequestId(null);
    if (rid) getSocket().emit("sos_cancel_request", { requestId: rid });
  }, [outgoingRequestId]);

  const acceptSos = useCallback((requestId: string) => {
    setIncomingRequest(null);
    getSocket().emit("sos_accept", { requestId });
  }, []);

  const rejectSos = useCallback((requestId: string) => {
    setIncomingRequest(null);
    getSocket().emit("sos_reject", { requestId });
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    getSocket().emit("sos_chat_message", { text });
  }, []);

  const sendCanvasDraw = useCallback(
    (data: {
      points: { x: number; y: number }[];
      tool: string;
      color: string;
      size: number;
      canvasWidth: number;
      canvasHeight: number;
    }) => {
      getSocket().emit("sos_canvas_draw", data);
    },
    [],
  );

  const sendCanvasImage = useCallback(
    (dataUrl: string, canvasWidth: number, canvasHeight: number) => {
      getSocket().emit("sos_canvas_image", { dataUrl, canvasWidth, canvasHeight });
    },
    [],
  );

  const sendCanvasClear = useCallback(() => {
    getSocket().emit("sos_canvas_clear");
  }, []);

  const requestEndSession = useCallback(() => {
    setSession(prev => (prev ? { ...prev, showEndPrompt: true } : prev));
    getSocket().emit("sos_end_request");
  }, []);

  const confirmEndSession = useCallback(() => {
    getSocket().emit("sos_end_confirm");
  }, []);

  const cancelEndSession = useCallback(() => {
    setSession(prev =>
      prev ? { ...prev, showEndPrompt: false, endRequestedByPartner: false } : prev,
    );
    getSocket().emit("sos_end_cancel");
  }, []);

  const submitRating = useCallback((rating: "great" | "decent" | "bad") => {
    getSocket().emit("sos_rating", { rating });
    setShowRatingModal(false);
  }, []);

  const dismissRating = useCallback(() => {
    setShowRatingModal(false);
  }, []);

  const value: SosContextType = {
    requestStatus,
    outgoingRequestId,
    incomingRequest,
    session,
    showRatingModal,
    onlineCount,
    sendSosRequest,
    cancelSosRequest,
    acceptSos,
    rejectSos,
    sendChatMessage,
    sendCanvasDraw,
    sendCanvasImage,
    sendCanvasClear,
    requestEndSession,
    confirmEndSession,
    cancelEndSession,
    submitRating,
    dismissRating,
    registerUser,
    setCurrentStatus,
  };

  return (
    <SosContext.Provider value={value}>
      {children}
      {/* Global overlays — rendered as portals above all content */}
      {incomingRequest && <SosPopup request={incomingRequest} />}
      {session && <SosWorkspace session={session} />}
      {showRatingModal && <RatingModal onRate={submitRating} onDismiss={dismissRating} />}
    </SosContext.Provider>
  );
}

// ── Rating Modal ──────────────────────────────────────────────────────────────

function RatingModal({
  onRate,
  onDismiss,
}: {
  onRate: (r: "great" | "decent" | "bad") => void;
  onDismiss: () => void;
}) {
  const options: { label: string; value: "great" | "decent" | "bad"; emoji: string; color: string }[] = [
    { label: "Great",  value: "great",  emoji: "🌟", color: "bg-green-500 hover:bg-green-600" },
    { label: "Decent", value: "decent", emoji: "👍", color: "bg-blue-500 hover:bg-blue-600"  },
    { label: "Bad",    value: "bad",    emoji: "👎", color: "bg-red-500 hover:bg-red-600"    },
  ];

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Session Complete!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">How was this SOS session?</p>
        <div className="flex gap-3 justify-center">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => onRate(opt.value)}
              className={`flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-95 ${opt.color}`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={onDismiss}
          className="mt-4 text-xs text-gray-400 hover:text-gray-500 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSos(): SosContextType {
  const ctx = useContext(SosContext);
  if (!ctx) throw new Error("useSos must be used within SosProvider");
  return ctx;
}
