import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, Square, Users, Copy,
  Send, BookOpen, Coffee, Crown, CheckCircle, BarChart2,
  ChevronRight, ChevronDown, Maximize, Minimize, LogOut, X,
  MessageCircle, ListChecks, School, Volume2, VolumeX,
} from "lucide-react";
import { useRoomSound } from "@/hooks/useAmbientSound";
import {
  Room, RoomParticipant, Vote, RoomMessage,
  subscribeRoom, subscribeParticipants, subscribeActiveVotes, subscribeMessages,
  joinRoom, isParticipant, sendMessage, getRemainingSeconds, formatTime, createVote,
} from "@/lib/studyRooms";
import { useActiveRoom } from "@/context/ActiveRoomContext";
import { useAuth } from "@/context/AuthContext";
import { ClassroomView } from "@/components/study-room/ClassroomView";
import { VotingPanel } from "@/components/study-room/VotingPanel";
import { StudentProfileModal } from "@/components/study-room/StudentProfileModal";

const EMOJI_REACTIONS = ["👍", "🔥", "💪", "🎯", "⚡", "🙏", "😎", "🥳"];

interface FloatingEmoji { id: string; emoji: string; x: number }

type MobileTab = "class" | "vote" | "chat";

// ── tiny helpers ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Room["status"] }) {
  const map = {
    waiting:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    active:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    paused:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    finished: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  const labels = { waiting: "Waiting", active: "Studying", paused: "Paused", finished: "Finished" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map[status] ?? map.waiting}`}>{labels[status]}</span>;
}

// ── main component ─────────────────────────────────────────────────────────────
export default function StudyRoomLive() {
  const { id: roomId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const {
    joinActiveRoom, leaveActiveRoom, isHost, studyMinsInSession,
    onHostStart, onHostPause, onHostResume, onHostSkip,
    remainingSeconds, activeRoomId,
    room: ctxRoom, participants: ctxParticipants,
  } = useActiveRoom();

  // alreadyIn: true once we've called joinActiveRoom for this room
  const alreadyIn = activeRoomId === roomId;

  // ── Local state — pre-join room preview ──────────────────────────────────────
  // We only subscribe locally when NOT yet joined to avoid duplicate listeners.
  // Once joined, we consume room + participants from ActiveRoomContext.
  const [localRoom,         setLocalRoom]    = useState<Room | null>(null);
  const [localParticipants, setLocalPs]      = useState<RoomParticipant[]>([]);
  const [loading,           setLoading]      = useState(true);
  const [joined,            setJoined]       = useState(false);
  const [joinError,         setJoinError]    = useState("");

  // Always-local state (not in context)
  const [votes,          setVotes]       = useState<Vote[]>([]);
  const [messages,       setMessages]    = useState<RoomMessage[]>([]);
  const [optimisticMsgs, setOptimistic]  = useState<RoomMessage[]>([]); // instant display

  const [selectedStudent, setSel]         = useState<RoomParticipant | null>(null);
  const [mobileTab,       setMobileTab]   = useState<MobileTab>("class");
  const [chatMsg,         setChatMsg]     = useState("");
  const [showCopied,      setShowCopied]  = useState(false);
  const [flowOpen,        setFlowOpen]    = useState(false);
  const [isFullscreen,    setIsFullscreen] = useState(false);
  const [floatingEmojis,  setFE]          = useState<FloatingEmoji[]>([]);
  const [showLeave,       setShowLeave]   = useState(false);
  const [showEndVote,     setShowEndVote] = useState(false);
  const [endVoteLoading,  setEndVoteLoading] = useState(false);

  const chatRef      = useRef<HTMLDivElement>(null);
  const seenMsgIds   = useRef<Set<string>>(new Set());
  const emojiCounter = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive active room + participants: context when joined, local when browsing
  const room         = alreadyIn ? ctxRoom         : localRoom;
  const participants = alreadyIn ? ctxParticipants : localParticipants;

  // ── Sound system — driven by the room's ambientSound setting ─────────────────
  const roomSoundId = room?.ambientSound ?? "none";
  const { isMuted, volume, setMuted, setVolume } = useRoomSound(
    joined && room?.status === "active" ? roomSoundId : "none"
  );

  // ── PRE-JOIN: subscribe to room and participants ONLY while not yet joined ────
  // After join, the context already subscribes — subscribing again would create
  // duplicate Firestore listeners and double the read cost.
  useEffect(() => {
    if (!roomId || alreadyIn) return;
    return subscribeRoom(roomId, (r) => { setLocalRoom(r); setLoading(false); });
  }, [roomId, alreadyIn]);

  useEffect(() => {
    if (!roomId || alreadyIn) return;
    return subscribeParticipants(roomId, setLocalPs);
  }, [roomId, alreadyIn]);

  // Once context room arrives after joining, clear loading
  useEffect(() => {
    if (alreadyIn && ctxRoom) setLoading(false);
  }, [alreadyIn, ctxRoom]);

  // ── ALWAYS: subscribe to votes and messages (not in context) ─────────────────
  useEffect(() => {
    if (!roomId) return;
    return subscribeActiveVotes(roomId, setVotes);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeMessages(roomId, (msgs) => {
      // Merge optimistic messages that haven't landed yet
      setOptimistic(prev => prev.filter(o => !msgs.some(m => m.id === o.id)));

      for (const msg of msgs) {
        if (msg.type === "reaction" && msg.emoji && !seenMsgIds.current.has(msg.id)) {
          seenMsgIds.current.add(msg.id);
          const age = msg.createdAt ? Date.now() - msg.createdAt.toMillis() : 99999;
          if (age < 6000) spawnEmoji(msg.emoji);
        } else {
          seenMsgIds.current.add(msg.id);
        }
      }
      setMessages(msgs);
    });
  }, [roomId]);

  // auto-scroll chat
  useEffect(() => { chatRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, optimisticMsgs]);

  // ── AUTO-JOIN — happens once per page visit ───────────────────────────────────
  // Runs for ALL users (host AND members). Every user's ActiveRoomContext gets
  // their own timer and study-time accumulation — tracking is per-individual.
  useEffect(() => {
    if (!roomId || !room || room.status === "finished") return;
    if (!user || !profile) return; // not signed in — handled by render guard below
    if (joined) return;

    let cancelled = false;
    async function doJoin() {
      setJoinError("");
      try {
        const alreadyInRoom = await isParticipant(roomId!, user!.uid);
        if (!alreadyInRoom) {
          await joinRoom(roomId!, {
            uid:      user!.uid,
            name:     profile!.name,
            grade:    profile!.grade,
            isHost:   room!.hostUid === user!.uid,
            photoURL: profile!.photoURL ?? user!.photoURL ?? null,
          });
        }
        if (cancelled) return;
        // joinActiveRoom starts the context subscription + per-user study timer
        joinActiveRoom(roomId!);
        setJoined(true);
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        console.error("[Room] join failed:", e);
        setJoinError(err.message || "Failed to join room. Please try again.");
      }
    }
    doJoin();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user, profile, joined, room?.id, room?.status]);

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    document.addEventListener("webkitfullscreenchange", h);
    return () => {
      document.removeEventListener("fullscreenchange", h);
      document.removeEventListener("webkitfullscreenchange", h);
    };
  }, []);

  // ── Emoji float ───────────────────────────────────────────────────────────────
  const spawnEmoji = useCallback((emoji: string) => {
    const id = `e${emojiCounter.current++}`;
    const x  = 5 + Math.random() * 80;
    setFE(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFE(prev => prev.filter(e => e.id !== id)), 2500);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────────
  async function confirmLeave() {
    setShowLeave(false);
    // Exit fullscreen first so the leave doesn't break the layout
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    await leaveActiveRoom();
    setLocation("/study-rooms");
  }

  async function handleSend() {
    if (!chatMsg.trim() || !user || !profile || !roomId) return;
    const txt = chatMsg.trim();
    setChatMsg("");

    // Optimistic: show message instantly, Firestore snapshot will replace it
    const tempId = `opt_${Date.now()}`;
    const optimistic: RoomMessage = {
      id: tempId, uid: user.uid, name: profile.name,
      text: txt, type: "message", createdAt: null,
    };
    setOptimistic(prev => [...prev, optimistic]);

    try {
      await sendMessage(roomId, { uid: user.uid, name: profile.name, text: txt, type: "message" });
    } catch (e) {
      console.error("[Chat] send failed:", e);
      setOptimistic(prev => prev.filter(m => m.id !== tempId));
    }
  }

  async function handleReaction(emoji: string) {
    if (!user || !profile || !roomId) return;
    spawnEmoji(emoji);
    try {
      await sendMessage(roomId, { uid: user.uid, name: profile.name, emoji, type: "reaction" });
    } catch (e) {
      console.error("[Reaction] send failed:", e);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      const el = containerRef.current ?? document.documentElement;
      (el.requestFullscreen?.() ?? (el as any).webkitRequestFullscreen?.())?.catch(() => {});
    } else {
      (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.())?.catch(() => {});
    }
  }

  async function handleHostEndVote() {
    if (!user || !profile || !roomId) return;
    setEndVoteLoading(true);
    try {
      await createVote(roomId, {
        description: "🏁 End the session now? Everyone vote!",
        type: "end",
        createdByUid: user.uid,
        createdByName: profile.name,
        totalParticipants: participants.length,
        expiresInSecs: 90,
      });
      setShowEndVote(false);
      setMobileTab("vote");
    } catch (e) { console.error("[Vote] end vote failed", e); }
    setEndVoteLoading(false);
  }

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 rounded-full border-3 border-blue-100 border-t-blue-600 animate-spin" />
    </div>
  );

  if (!room) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
      <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Room not found.</p>
      <button onClick={() => setLocation("/study-rooms")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm">
        Browse Rooms
      </button>
    </div>
  );

  // Must be signed in to join a room
  if (!user || !profile) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-2">
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">{room.title}</p>
      <p className="text-gray-500 dark:text-gray-400 text-sm">Sign in with Google to join this study room.</p>
      <button
        onClick={() => setLocation("/login?next=/study-rooms/" + roomId)}
        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
      >
        Sign In to Join
      </button>
      <button onClick={() => setLocation("/study-rooms")} className="block mx-auto text-sm text-gray-400 hover:text-gray-600 transition-colors">
        Back to rooms
      </button>
    </div>
  );

  // Show join error if something went wrong
  if (joinError) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 flex items-center justify-center mb-2">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-gray-900 dark:text-gray-100 text-lg font-semibold">Couldn't Join Room</p>
      <p className="text-red-500 text-sm font-mono bg-red-50 rounded-xl px-4 py-3">{joinError}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={() => setJoinError("")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
          Try Again
        </button>
        <button onClick={() => setLocation("/study-rooms")} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
          Browse Rooms
        </button>
      </div>
    </div>
  );

  const phase      = room.studyFlow[room.currentPhaseIndex];
  const isStudying = room.status === "active" && phase?.type === "study";
  const remaining  = alreadyIn ? remainingSeconds : getRemainingSeconds(room);
  const pctDone    = phase ? Math.max(0, Math.min(100, 100 - (remaining / (phase.durationMins * 60)) * 100)) : 0;
  const timerFmt   = formatTime(remaining);
  const showTimer  = phase && room.status !== "waiting" && room.status !== "finished";
  const activeVoteCount = votes.filter(v => v.status === "active").length;

  // All messages for the chat: confirmed from Firestore + any not-yet-confirmed optimistic ones
  const allMessages = [...messages, ...optimisticMsgs.filter(o => !messages.some(m => m.id === o.id))];

  // ── SHARED COMPONENTS ──────────────────────────────────────────────────────────
  function StudyFlow() {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <button
          onClick={() => setFlowOpen(!flowOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-400" />
            Study Flow
            <span className="text-xs font-normal text-gray-400">{room.currentPhaseIndex + 1}/{room.studyFlow.length}</span>
          </span>
          {flowOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        <AnimatePresence>
          {flowOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-1">
                {room.studyFlow.map((p, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                    i === room.currentPhaseIndex ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold"
                    : i < room.currentPhaseIndex ? "text-gray-400 dark:text-gray-500 line-through"
                    : "text-gray-600 dark:text-gray-400"
                  }`}>
                    {p.type === "study" ? <BookOpen className="w-3.5 h-3.5 shrink-0" /> : <Coffee className="w-3.5 h-3.5 shrink-0" />}
                    <span className="flex-1 truncate">{p.label}</span>
                    <span className="font-mono shrink-0">{p.durationMins}m</span>
                    {i === room.currentPhaseIndex && <span className="shrink-0 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">NOW</span>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  function ChatPanel() {
    return (
      <div className="flex flex-col h-full">
        {/* Emoji row */}
        <div className="flex gap-1.5 flex-wrap mb-2">
          {EMOJI_REACTIONS.map(e => (
            <button key={e} onClick={() => handleReaction(e)}
              className="text-xl hover:scale-125 active:scale-95 transition-transform select-none">
              {e}
            </button>
          ))}
        </div>
        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto pr-0.5 mb-2" style={{ maxHeight: 320 }}>
          {allMessages.length === 0 && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-6">No messages yet — say something!</p>
          )}
          {allMessages.map(msg => (
            <div key={msg.id}>
              {msg.type === "reaction" ? (
                <div className="text-center text-base">
                  {msg.emoji}
                  <span className="text-[10px] text-gray-400 ml-1">{msg.name.split(" ")[0]}</span>
                </div>
              ) : msg.type === "system" ? (
                <p className="text-center text-xs italic text-gray-400">{msg.text}</p>
              ) : (
                <div className={`flex gap-1.5 ${msg.uid === user?.uid ? "flex-row-reverse" : ""}`}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5">
                    {msg.name.charAt(0)}
                  </div>
                  <div className={`max-w-[78%] flex flex-col gap-0.5 ${msg.uid === user?.uid ? "items-end" : "items-start"}`}>
                    <p className="text-[10px] text-gray-400">{msg.name.split(" ")[0]}</p>
                    <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed ${
                      msg.uid === user?.uid
                        ? `bg-blue-500 text-white rounded-tr-sm ${!msg.createdAt ? "opacity-70" : ""}`
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatRef} />
        </div>
        {/* Input */}
        {user && (
          <div className="flex gap-2 mt-auto">
            <input
              type="text" value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Say something…" maxLength={200}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={handleSend} disabled={!chatMsg.trim()}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  function ParticipantsList() {
    return (
      <div className="space-y-2">
        {participants.map(p => (
          <button key={p.uid} onClick={() => setSel(p)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {p.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1">
                {p.name}
                {p.uid === room.hostUid && <Crown className="w-3 h-3 text-yellow-500 shrink-0" />}
                {p.uid === user?.uid && <span className="text-[10px] text-gray-400 font-normal">(you)</span>}
              </p>
              <p className="text-xs text-gray-400">Grade {p.grade}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </button>
        ))}
      </div>
    );
  }

  function HostBar() {
    if (!isHost) return null;
    return (
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 mr-1">
            <Crown className="w-3.5 h-3.5" /> Host
          </span>
          {room.status === "waiting" && (
            <button onClick={onHostStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs font-bold transition-colors shadow-sm">
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          )}
          {room.status === "active" && (
            <button onClick={onHostPause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-sm">
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          )}
          {room.status === "paused" && (
            <button onClick={onHostResume}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors shadow-sm">
              <Play className="w-3.5 h-3.5" /> Resume
            </button>
          )}
          {(room.status === "active" || room.status === "paused") && (
            <button onClick={onHostSkip}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors shadow-sm">
              <SkipForward className="w-3.5 h-3.5" /> Skip
            </button>
          )}
          {room.status !== "waiting" && room.status !== "finished" && (
            <button onClick={() => setShowEndVote(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm">
              <Square className="w-3.5 h-3.5" /> End Session
            </button>
          )}
        </div>
      </div>
    );
  }

  function HeaderBar() {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">{room.title}</h1>
              <StatusBadge status={room.status} />
            </div>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{room.subject} · {room.hostName}</p>
          </div>

          {showTimer && (
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 font-mono text-sm font-bold ${
              isStudying ? "bg-blue-600 text-white" : "bg-green-600 text-white"
            }`}>
              {isStudying ? <BookOpen className="w-3.5 h-3.5" /> : <Coffee className="w-3.5 h-3.5" />}
              {timerFmt}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 shrink-0">
            <Users className="w-4 h-4" /> {participants.length}
          </div>

          {studyMinsInSession > 0 && (
            <div className="hidden md:flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold shrink-0">
              <BookOpen className="w-3.5 h-3.5" /> {studyMinsInSession}m
            </div>
          )}

          <button onClick={copyLink}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors shrink-0">
            {showCopied ? <><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Invite</>}
          </button>

          {/* Sound controls — only shown when room has ambient sound */}
          {roomSoundId !== "none" && joined && (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setMuted(!isMuted)}
                title={isMuted ? "Unmute ambient sound" : "Mute ambient sound"}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              {!isMuted && (
                <input
                  type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-16 accent-blue-500 cursor-pointer"
                  title="Ambient volume"
                />
              )}
            </div>
          )}

          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors shrink-0">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          <button onClick={() => setShowLeave(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800/40 transition-colors shrink-0">
            <LogOut className="w-3.5 h-3.5" /> Leave
          </button>
        </div>

        {showTimer && (
          <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isStudying ? "bg-blue-500" : "bg-green-500"}`}
              style={{ width: `${pctDone}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        )}
      </div>
    );
  }

  function MobileTabs() {
    const tabs: { id: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
      { id: "class", label: "Classroom", icon: <School className="w-4 h-4" /> },
      { id: "vote",  label: "Vote",      icon: <ListChecks className="w-4 h-4" />, badge: activeVoteCount || undefined },
      { id: "chat",  label: "Chat",      icon: <MessageCircle className="w-4 h-4" /> },
    ];
    return (
      <div className="flex bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 lg:hidden">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setMobileTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium relative transition-colors ${
              mobileTab === t.id ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
            }`}>
            <span className={`transition-colors ${mobileTab === t.id ? "text-blue-600 dark:text-blue-400" : ""}`}>{t.icon}</span>
            {t.label}
            {t.badge ? (
              <span className="absolute top-2 right-[calc(50%-12px)] w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {t.badge}
              </span>
            ) : null}
            {mobileTab === t.id && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>
    );
  }

  // ── SESSION COMPLETE ──────────────────────────────────────────────────────────
  if (room.status === "finished") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-5">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Session Complete!</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Great work! You studied for <strong>{studyMinsInSession} minutes</strong> in this session.
        </p>
        <button onClick={() => setLocation("/study-rooms")}
          className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-all">
          Browse Study Rooms
        </button>
      </div>
    );
  }

  // ── MAIN LAYOUT ───────────────────────────────────────────────────────────────
  return (
    <>
      <Helmet><title>{room.title} — Study Room</title></Helmet>

      <div ref={containerRef}
        className={`${isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-950 overflow-auto" : "max-w-screen-xl mx-auto"} px-2 sm:px-4 py-3 flex flex-col gap-3`}
      >
        {HeaderBar()}
        {HostBar()}

        {/* ── MOBILE LAYOUT ──────────────────────────────────────────────────── */}
        <div className="lg:hidden flex flex-col gap-3 pb-16">
          {showTimer && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isStudying ? "bg-blue-600 text-white" : "bg-green-600 text-white"}`}>
              <div className="flex items-center gap-2">
                {isStudying ? <BookOpen className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                <span className="text-sm font-semibold">{phase?.label}</span>
              </div>
              <span className="font-mono text-2xl font-black tabular-nums">{timerFmt}</span>
              <div className="flex items-center gap-1 text-sm opacity-80">
                <Users className="w-4 h-4" /> {participants.length}
              </div>
            </div>
          )}
          {room.status === "waiting" && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/40 rounded-2xl px-4 py-3 text-center">
              <p className="text-yellow-700 dark:text-yellow-400 text-sm font-semibold">⏳ Waiting for host to start…</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {mobileTab === "class" && (
              <motion.div key="class" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
                <ClassroomView
                  participants={participants} hostUid={room.hostUid}
                  onSelectStudent={setSel} compact
                  timerDisplay={showTimer ? timerFmt : undefined}
                  timerLabel={phase?.label} timerPhaseType={phase?.type ?? null}
                  roomStatus={room.status}
                />
                <AnimatePresence>
                  {floatingEmojis.map(fe => (
                    <motion.div key={fe.id} className="absolute bottom-8 pointer-events-none text-3xl select-none"
                      style={{ left: `${fe.x}%` }}
                      initial={{ y: 0, opacity: 1, scale: 0.8 }}
                      animate={{ y: -140, opacity: 0, scale: 1.5 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 2.2, ease: "easeOut" }}>
                      {fe.emoji}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
            {mobileTab === "vote" && (
              <motion.div key="vote" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <VotingPanel room={room} votes={votes} participantCount={participants.length} participants={participants} />
              </motion.div>
            )}
            {mobileTab === "chat" && (
              <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4"
                style={{ minHeight: 400 }}>
                {ChatPanel()}
              </motion.div>
            )}
          </AnimatePresence>

          {StudyFlow()}
        </div>

        {/* ── DESKTOP LAYOUT ─────────────────────────────────────────────────── */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_48px_340px] gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
            <ClassroomView
              participants={participants} hostUid={room.hostUid}
              onSelectStudent={setSel}
              timerDisplay={showTimer ? timerFmt : undefined}
              timerLabel={phase?.label} timerPhaseType={phase?.type ?? null}
              roomStatus={room.status}
            />
            <AnimatePresence>
              {floatingEmojis.map(fe => (
                <motion.div key={fe.id} className="absolute bottom-10 pointer-events-none text-3xl select-none"
                  style={{ left: `${fe.x}%` }}
                  initial={{ y: 0, opacity: 1, scale: 0.8 }}
                  animate={{ y: -180, opacity: 0, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.3, ease: "easeOut" }}>
                  {fe.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Emoji column */}
          <div className="flex flex-col gap-1.5 justify-center">
            {EMOJI_REACTIONS.map(e => (
              <button key={e} onClick={() => handleReaction(e)}
                className="w-11 h-11 rounded-xl text-xl hover:scale-115 active:scale-95 transition-transform bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow">
                {e}
              </button>
            ))}
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-3 min-w-0 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
            {studyMinsInSession > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Your study time</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{studyMinsInSession} min</span>
              </div>
            )}

            {StudyFlow()}

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  🗳️ Votes {activeVoteCount > 0 && <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{activeVoteCount}</span>}
                </span>
              </div>
              <div className="p-3">
                <VotingPanel room={room} votes={votes} participantCount={participants.length} participants={participants} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-bold text-gray-900 dark:text-white">💬 Chat</span>
              </div>
              <div className="p-3">
                {ChatPanel()}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">👥 Participants</span>
                <span className="text-xs text-gray-400">{participants.length}</span>
              </div>
              <div className="p-2">
                {ParticipantsList()}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden shadow-lg">
          {MobileTabs()}
        </div>

        {/* ── LEAVE CONFIRMATION MODAL — inside container so it shows in fullscreen */}
      <AnimatePresence>
        {showLeave && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowLeave(false)}
              className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" />
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 16 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden"
              >
                <div className="bg-gradient-to-r from-red-500 to-rose-500 p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                      <LogOut className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">Leave Room?</p>
                      <p className="text-white/70 text-xs">Your study time will be saved</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {studyMinsInSession > 0
                      ? `You've studied ${studyMinsInSession} minutes this session — it'll be saved to your profile.`
                      : "Are you sure you want to leave this study room?"
                    }
                  </p>
                  {isHost && participants.length > 1 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      As host, the next participant will become the new host.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setShowLeave(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      Stay
                    </button>
                    <button onClick={confirmLeave}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-sm">
                      Leave Room
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── END SESSION VOTE MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {showEndVote && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowEndVote(false)}
              className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm" />
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 16 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden"
              >
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-xl">🏁</div>
                    <div>
                      <p className="font-bold text-white text-base">End Session Vote</p>
                      <p className="text-white/70 text-xs">Ask everyone to vote</p>
                    </div>
                  </div>
                  <button onClick={() => setShowEndVote(false)} className="text-white/70 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    A 90-second vote will be sent to all <strong>{participants.length} participants</strong>.
                    If the majority vote <strong>Yes</strong>, the session ends for everyone.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400">
                    💡 Tip: You can also let the timer finish naturally, or skip phases with the Skip button.
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowEndVote(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleHostEndVote} disabled={endVoteLoading}
                      className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                      {endVoteLoading
                        ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Starting…</>
                        : "Start Vote 🗳️"
                      }
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <StudentProfileModal participant={selectedStudent} onClose={() => setSel(null)} />
      </div>  {/* ← closes containerRef — ALL modals above must be inside for fullscreen */}
    </>
  );
}
