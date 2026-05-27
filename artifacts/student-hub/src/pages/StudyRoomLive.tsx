import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, Pause, SkipForward, Square, Users, Copy,
  Send, BookOpen, Coffee, Crown, CheckCircle,
  BarChart2, ChevronRight, ChevronDown, Maximize, Minimize,
} from "lucide-react";
import {
  Room, RoomParticipant, Vote, RoomMessage,
  subscribeRoom, subscribeParticipants, subscribeActiveVotes, subscribeMessages,
  joinRoom, sendMessage, getRemainingSeconds, formatTime,
} from "@/lib/studyRooms";
import { useActiveRoom } from "@/context/ActiveRoomContext";
import { useAuth } from "@/context/AuthContext";
import { ClassroomView } from "@/components/study-room/ClassroomView";
import { VotingPanel } from "@/components/study-room/VotingPanel";
import { StudentProfileModal } from "@/components/study-room/StudentProfileModal";

const EMOJI_REACTIONS = ["👍", "🔥", "💪", "🎯", "⚡", "🙏", "😎", "🥳"];

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
}

function StatusBadge({ status }: { status: Room["status"] }) {
  const map = {
    waiting:  { label: "Waiting",  cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    active:   { label: "Studying", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    paused:   { label: "Paused",   cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    finished: { label: "Finished", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  };
  const { label, cls } = map[status] ?? map.waiting;
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cls}`}>{label}</span>;
}

export default function StudyRoomLive() {
  const { id: roomId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const {
    joinActiveRoom, leaveActiveRoom, isHost,
    onHostStart, onHostPause, onHostResume, onHostSkip, onHostEnd,
    remainingSeconds, activeRoomId,
  } = useActiveRoom();

  const [room, setRoom]                 = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [votes, setVotes]               = useState<Vote[]>([]);
  const [messages, setMessages]         = useState<RoomMessage[]>([]);
  const [loading, setLoading]           = useState(true);
  const [joined, setJoined]             = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<RoomParticipant | null>(null);
  const [rightTab, setRightTab]         = useState<"vote" | "chat">("vote");
  const [chatMsg, setChatMsg]           = useState("");
  const [showCopied, setShowCopied]     = useState(false);
  const [showFlowExpanded, setShowFlowExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const chatBottomRef  = useRef<HTMLDivElement>(null);
  const seenMsgIds     = useRef<Set<string>>(new Set());
  const emojiIdCounter = useRef(0);
  const containerRef   = useRef<HTMLDivElement>(null);

  const alreadyInRoom = activeRoomId === roomId;

  // ── Subscriptions ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    return subscribeRoom(roomId, (r) => { setRoom(r); setLoading(false); });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeParticipants(roomId, setParticipants);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeActiveVotes(roomId, setVotes);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    return subscribeMessages(roomId, (msgs) => {
      // Detect new reaction messages → spawn floating emojis
      for (const msg of msgs) {
        if (msg.type === "reaction" && msg.emoji && !seenMsgIds.current.has(msg.id)) {
          seenMsgIds.current.add(msg.id);
          // Only animate reactions that are recent (within last 5 seconds)
          const age = msg.createdAt ? Date.now() - msg.createdAt.toMillis() : 9999;
          if (age < 5000) {
            spawnFloatingEmoji(msg.emoji);
          }
        } else {
          seenMsgIds.current.add(msg.id);
        }
      }
      setMessages(msgs);
    });
  }, [roomId]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-join ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !user || !profile || joined || !room) return;
    if (room.status === "finished") return;

    const alreadyParticipant = participants.some(p => p.uid === user.uid);

    async function doJoin() {
      try {
        if (!alreadyParticipant) {
          await joinRoom(roomId!, {
            uid: user!.uid,
            name: profile!.name,
            grade: profile!.grade,
            isHost: room!.hostUid === user!.uid,
          });
        }
        joinActiveRoom(roomId!);
        setJoined(true);
      } catch (err) {
        console.error("[Room] Failed to join:", err);
      }
    }
    doJoin();
  }, [roomId, user, profile, room, participants, joined, joinActiveRoom]);

  // ── Fullscreen ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      (containerRef.current ?? document.documentElement).requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // ── Floating emoji reactions ──────────────────────────────────────────────────
  function spawnFloatingEmoji(emoji: string) {
    const id = `emoji-${emojiIdCounter.current++}`;
    const x = 10 + Math.random() * 80; // random horizontal position 10–90%
    setFloatingEmojis(prev => [...prev, { id, emoji, x }]);
    // Remove after animation completes
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2500);
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  async function handleLeave() {
    await leaveActiveRoom();
    setLocation("/study-rooms");
  }

  async function handleSendMessage() {
    if (!chatMsg.trim() || !user || !profile) return;
    const text = chatMsg.trim();
    setChatMsg("");
    await sendMessage(roomId!, { uid: user.uid, name: profile.name, text, type: "message" });
  }

  async function handleReaction(emoji: string) {
    if (!user || !profile) return;
    // Immediately spawn local floating emoji for instant feedback
    spawnFloatingEmoji(emoji);
    await sendMessage(roomId!, { uid: user.uid, name: profile.name, emoji, type: "reaction" });
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-400 text-lg">Room not found.</p>
        <button onClick={() => setLocation("/study-rooms")} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm">
          Browse Rooms
        </button>
      </div>
    );
  }

  const phase        = room.studyFlow[room.currentPhaseIndex];
  const isStudying   = room.status === "active" && phase?.type === "study";
  const isBreak      = room.status === "active" && phase?.type === "break";
  const remaining    = alreadyInRoom ? remainingSeconds : getRemainingSeconds(room);
  const pctComplete  = phase ? Math.max(0, Math.min(100, 100 - (remaining / (phase.durationMins * 60)) * 100)) : 0;

  return (
    <>
      <Helmet><title>{room.title} — Study Room</title></Helmet>

      <div ref={containerRef} className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {/* Top bar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleLeave}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg truncate">
                  {room.title}
                </h1>
                <StatusBadge status={room.status} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {room.subject} · by {room.hostName}
              </p>
            </div>

            {/* Timer pill (top bar) */}
            {phase && room.status !== "waiting" && room.status !== "finished" && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl flex-shrink-0 ${
                isStudying ? "bg-blue-600 text-white" : "bg-green-600 text-white"
              }`}>
                {isStudying ? <BookOpen className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                <span className="font-mono text-lg font-bold tabular-nums">{formatTime(remaining)}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
              <Users className="w-4 h-4" />
              <span>{participants.length}</span>
            </div>

            <button
              onClick={copyInviteLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0"
            >
              {showCopied
                ? <><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Copied</>
                : <><Copy className="w-3.5 h-3.5" /> Invite</>
              }
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

          {/* Phase progress bar */}
          {phase && room.status === "active" && (
            <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isStudying ? "bg-blue-500" : "bg-green-500"}`}
                style={{ width: `${pctComplete}%` }}
              />
            </div>
          )}
        </div>

        {/* Host controls */}
        {isHost && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 flex-1">
                <Crown className="w-3.5 h-3.5" /> Host Controls
              </div>
              <div className="flex gap-2 flex-wrap">
                {room.status === "waiting" && (
                  <button onClick={onHostStart} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors">
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                )}
                {room.status === "active" && (
                  <button onClick={onHostPause} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                )}
                {room.status === "paused" && (
                  <button onClick={onHostResume} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors">
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                )}
                {(room.status === "active" || room.status === "paused") && (
                  <button onClick={onHostSkip} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors">
                    <SkipForward className="w-3.5 h-3.5" /> Skip Phase
                  </button>
                )}
                {room.status !== "waiting" && room.status !== "finished" && (
                  <button onClick={onHostEnd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
                    <Square className="w-3.5 h-3.5" /> End
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Finished banner */}
        {room.status === "finished" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl px-5 py-4 text-white text-center"
          >
            <p className="text-xl font-bold">🎉 Session Complete!</p>
            <p className="text-white/80 text-sm mt-1">Great work everyone. Your study time has been recorded.</p>
            <button onClick={() => setLocation("/study-rooms")} className="mt-3 px-4 py-2 rounded-xl bg-white text-blue-600 text-sm font-semibold">
              Browse Rooms
            </button>
          </motion.div>
        )}

        {/* Main 3-column layout */}
        <div className="grid lg:grid-cols-[1fr_auto_340px] gap-4">
          {/* Left: Classroom — with floating emoji overlay */}
          <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <ClassroomView
              participants={participants}
              hostUid={room.hostUid}
              onSelectStudent={setSelectedStudent}
              timerDisplay={phase && room.status !== "waiting" && room.status !== "finished" ? formatTime(remaining) : undefined}
              timerLabel={phase?.label}
              timerPhaseType={phase?.type ?? null}
              roomStatus={room.status}
            />

            {/* Floating emoji reaction overlay */}
            <AnimatePresence>
              {floatingEmojis.map(fe => (
                <motion.div
                  key={fe.id}
                  className="absolute bottom-8 pointer-events-none text-3xl select-none"
                  style={{ left: `${fe.x}%` }}
                  initial={{ y: 0, opacity: 1, scale: 0.8 }}
                  animate={{ y: -160, opacity: 0, scale: 1.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.2, ease: "easeOut" }}
                >
                  {fe.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Center: Emoji reactions column */}
          <div className="hidden lg:flex flex-col gap-2 justify-center">
            {EMOJI_REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-10 h-10 rounded-xl text-lg hover:scale-110 active:scale-95 transition-transform bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-3 min-w-0">
            {/* Study flow summary */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <button
                onClick={() => setShowFlowExpanded(!showFlowExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-gray-400" />
                  Study Flow
                  <span className="text-xs font-normal text-gray-400">
                    {room.currentPhaseIndex + 1}/{room.studyFlow.length}
                  </span>
                </div>
                {showFlowExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              <AnimatePresence>
                {showFlowExpanded && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1.5">
                      {room.studyFlow.map((p, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors ${
                            i === room.currentPhaseIndex
                              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold"
                              : i < room.currentPhaseIndex
                                ? "text-gray-400 dark:text-gray-500 line-through"
                                : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {p.type === "study" ? <BookOpen className="w-3.5 h-3.5 flex-shrink-0" /> : <Coffee className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span className="flex-1 truncate">{p.label}</span>
                          <span className="font-mono flex-shrink-0">{p.durationMins}m</span>
                          {i === room.currentPhaseIndex && (
                            <span className="flex-shrink-0 text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0.5">Now</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tabs: Vote / Chat */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
              <div className="flex border-b border-gray-100 dark:border-gray-800 px-2 pt-1">
                {(["vote", "chat"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      rightTab === tab
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {tab === "vote" ? "🗳️" : "💬"} {tab === "vote" ? "Vote" : "Chat"}
                  </button>
                ))}
              </div>

              <div className="p-3 flex-1">
                {rightTab === "vote" && (
                  <VotingPanel room={room} votes={votes} participantCount={participants.length} />
                )}

                {rightTab === "chat" && (
                  <div className="flex flex-col gap-2">
                    {/* Mobile emoji row */}
                    <div className="flex gap-2 flex-wrap lg:hidden">
                      {EMOJI_REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(emoji)}
                          className="text-xl hover:scale-110 active:scale-95 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Messages */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {messages.length === 0 && (
                        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
                          No messages yet. Say something!
                        </p>
                      )}
                      {messages.map((msg) => (
                        <div key={msg.id}>
                          {msg.type === "reaction" ? (
                            <div className="text-center">
                              <span className="text-xl">{msg.emoji}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">{msg.name.split(" ")[0]}</span>
                            </div>
                          ) : msg.type === "system" ? (
                            <p className="text-center text-xs text-gray-400 dark:text-gray-500 italic">{msg.text}</p>
                          ) : (
                            <div className={`flex gap-2 ${msg.uid === user?.uid ? "flex-row-reverse" : ""}`}>
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                {msg.name.charAt(0)}
                              </div>
                              <div className={`max-w-[80%] ${msg.uid === user?.uid ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500">{msg.name.split(" ")[0]}</p>
                                <div className={`px-3 py-1.5 rounded-2xl text-xs ${
                                  msg.uid === user?.uid
                                    ? "bg-blue-500 text-white rounded-tr-sm"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                                }`}>
                                  {msg.text}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Input */}
                    {user && (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={chatMsg}
                          onChange={(e) => setChatMsg(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                          placeholder="Say something..."
                          maxLength={200}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!chatMsg.trim()}
                          className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors flex-shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Student profile modal */}
        <StudentProfileModal participant={selectedStudent} onClose={() => setSelectedStudent(null)} />
      </div>
    </>
  );
}
