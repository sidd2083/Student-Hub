import { useState, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Vote, RoomParticipant, createVote, castVote, resolveVote } from "@/lib/studyRooms";
import type { Room } from "@/lib/studyRooms";
import { useAuth } from "@/context/AuthContext";
import { ThumbsUp, ThumbsDown, Plus, X as XIcon, UserX, Crown, Pause, Play } from "lucide-react";
import { playBell } from "@/hooks/useAmbientSound";

interface Props {
  room: Room;
  votes: Vote[];
  participantCount: number;
  participants?: RoomParticipant[];
}

const QUICK_VOTES = [
  { type: "extend"      as const, label: "Extend +15m",    emoji: "⏰", addMinutes: 15, desc: "Extend study by 15 minutes?" },
  { type: "break"       as const, label: "Take 10m break", emoji: "☕", addMinutes: 10, desc: "Take a 10 minute break?" },
  { type: "skip_break"  as const, label: "Skip break",     emoji: "⚡", addMinutes: 0,  desc: "Skip the next break?" },
  { type: "end"         as const, label: "End session",    emoji: "🏁", addMinutes: 0,  desc: "End the study session?" },
];

const VOTE_COOLDOWN_MS = 30_000; // 30 seconds between votes from same user

export const VotingPanel = memo(function VotingPanel({ room, votes, participantCount, participants = [] }: Props) {
  const { user, profile } = useAuth();
  const [showCreate,   setShowCreate]  = useState(false);
  const [customDesc,   setCustomDesc]  = useState("");
  const [customMins,   setCustomMins]  = useState(10);
  const [customType,   setCustomType]  = useState<Vote["type"]>("extend");
  const [loading,      setLoading]     = useState(false);
  const [kickTarget,   setKickTarget]  = useState<RoomParticipant | null>(null);
  const [showKickPick, setShowKickPick] = useState(false);
  const [lastVoteAt,   setLastVoteAt]  = useState(0);
  const resolvingRef = useRef<Set<string>>(new Set());

  // Active votes that haven't expired yet (for display)
  const activeVotes = votes.filter(v => {
    if (v.status !== "active") return false;
    if (!v.expiresAt) return true;
    return v.expiresAt.toMillis() > Date.now();
  });

  const hasActiveVote = activeVotes.length > 0;
  const cooldownLeft  = Math.max(0, Math.ceil((lastVoteAt + VOTE_COOLDOWN_MS - Date.now()) / 1000));
  const canCreateVote = !hasActiveVote && cooldownLeft === 0;

  // ── Auto-resolve votes ────────────────────────────────────────────────────
  useEffect(() => {
    if (votes.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      for (const vote of votes) {
        if (vote.status !== "active") continue;
        if (resolvingRef.current.has(vote.id)) continue;
        const yes = vote.yesVoters.length;
        const no  = vote.noVoters.length;
        const totalVoted = yes + no;
        const isExpired  = vote.expiresAt && vote.expiresAt.toMillis() < now;
        const allVoted   = totalVoted >= Math.max(participantCount, 1);
        if (isExpired || allVoted) {
          resolvingRef.current.add(vote.id);
          resolveVote(room.id, vote.id, room)
            .then(() => {
              if (yes > no) playBell("vote");
            })
            .catch((err) => console.warn("[Vote] resolve failed:", err))
            .finally(() => resolvingRef.current.delete(vote.id));
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [votes, room, participantCount]);

  // ── Countdown tick ────────────────────────────────────────────────────────
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function startQuickVote(preset: typeof QUICK_VOTES[0]) {
    if (!user || !profile || !canCreateVote) return;
    setLoading(true);
    try {
      await createVote(room.id, {
        description: preset.desc,
        type: preset.type,
        addMinutes: preset.addMinutes || undefined,
        createdByUid: user.uid,
        createdByName: profile.name,
        totalParticipants: participantCount,
      });
      setLastVoteAt(Date.now());
    } catch (err) {
      console.error("[Vote] create failed:", err);
    }
    setLoading(false);
  }

  async function startPauseVote() {
    if (!user || !profile || !canCreateVote) return;
    setLoading(true);
    try {
      await createVote(room.id, {
        description: room.status === "paused" ? "▶️ Resume the timer?" : "⏸️ Pause the timer?",
        type: room.status === "paused" ? "unpause" : "pause",
        createdByUid: user.uid,
        createdByName: profile.name,
        totalParticipants: participantCount,
        expiresInSecs: 45,
      });
      setLastVoteAt(Date.now());
    } catch (err) {
      console.error("[Vote] pause vote failed:", err);
    }
    setLoading(false);
  }

  async function startRemoveHostVote() {
    if (!user || !profile || !canCreateVote) return;
    setLoading(true);
    try {
      await createVote(room.id, {
        description: `👑 Remove ${room.hostName} as host?`,
        type: "remove_host",
        createdByUid: user.uid,
        createdByName: profile.name,
        totalParticipants: participantCount,
        expiresInSecs: 60,
      });
      setLastVoteAt(Date.now());
    } catch (err) {
      console.error("[Vote] remove host vote failed:", err);
    }
    setLoading(false);
  }

  async function startKickVote(target: RoomParticipant) {
    if (!user || !profile || !canCreateVote) return;
    if (target.uid === user.uid) return; // Can't kick yourself
    setLoading(true);
    try {
      await createVote(room.id, {
        description: `🚪 Remove ${target.name.split(" ")[0]} from the room?`,
        type: "kick",
        targetUid: target.uid,
        targetName: target.name,
        createdByUid: user.uid,
        createdByName: profile.name,
        totalParticipants: participantCount,
        expiresInSecs: 60,
      });
      setKickTarget(null);
      setShowKickPick(false);
      setLastVoteAt(Date.now());
    } catch (err) {
      console.error("[Vote] kick vote failed:", err);
    }
    setLoading(false);
  }

  async function startCustomVote() {
    if (!user || !profile || !customDesc.trim() || !canCreateVote) return;
    setLoading(true);
    try {
      await createVote(room.id, {
        description: customDesc.trim(),
        type: customType,
        addMinutes: customMins || undefined,
        createdByUid: user.uid,
        createdByName: profile.name,
        totalParticipants: participantCount,
      });
      setCustomDesc("");
      setShowCreate(false);
      setLastVoteAt(Date.now());
    } catch (err) {
      console.error("[Vote] custom create failed:", err);
    }
    setLoading(false);
  }

  async function handleCastVote(voteId: string, choice: "yes" | "no") {
    if (!user) return;
    try {
      await castVote(room.id, voteId, user.uid, choice);
    } catch (err) {
      console.error("[Vote] cast failed:", err);
    }
  }

  const otherParticipants = participants.filter(p => p.uid !== user?.uid);

  return (
    <div className="space-y-3">
      {/* Active votes */}
      <AnimatePresence>
        {activeVotes.map((vote) => {
          const yes = vote.yesVoters.length;
          const no  = vote.noVoters.length;
          const total = Math.max(participantCount, yes + no, 1);
          const yesPct = Math.round((yes / total) * 100);
          const hasVotedYes = user ? vote.yesVoters.includes(user.uid) : false;
          const hasVotedNo  = user ? vote.noVoters.includes(user.uid)  : false;
          const hasVoted    = hasVotedYes || hasVotedNo;
          const secsLeft    = vote.expiresAt
            ? Math.max(0, Math.ceil((vote.expiresAt.toMillis() - Date.now()) / 1000))
            : null;

          return (
            <motion.div
              key={vote.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{vote.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">by {vote.createdByName}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {secsLeft !== null && (
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                      secsLeft <= 10
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                    }`}>
                      {secsLeft}s
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
                    Vote
                  </span>
                </div>
              </div>

              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-green-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${yesPct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span>✅ {yes} yes</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{yes + no}/{total} voted</span>
                <span>❌ {no} no</span>
              </div>

              {!hasVoted && user && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCastVote(vote.id, "yes")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 text-sm font-semibold border border-green-200 dark:border-green-800 transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Yes
                  </button>
                  <button
                    onClick={() => handleCastVote(vote.id, "no")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 text-sm font-semibold border border-red-200 dark:border-red-800 transition-colors"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> No
                  </button>
                </div>
              )}

              {hasVoted && (
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-1">
                  You voted {hasVotedYes ? "✅ yes" : "❌ no"} — waiting for others…
                </p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Cooldown / one-vote-at-a-time notice */}
      {hasActiveVote && (
        <p className="text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl py-2 px-3">
          One vote at a time — vote on the active proposal above first.
        </p>
      )}
      {!hasActiveVote && cooldownLeft > 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-1">
          Next vote in {cooldownLeft}s…
        </p>
      )}

      {/* No active votes placeholder */}
      {activeVotes.length === 0 && !showCreate && !showKickPick && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-2">
          No active votes. Start one below.
        </p>
      )}

      {/* Kick user picker */}
      <AnimatePresence>
        {showKickPick && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-2 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Select who to remove</p>
              <button onClick={() => { setShowKickPick(false); setKickTarget(null); }} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            {otherParticipants.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">No other participants</p>
            )}
            {otherParticipants.map(p => (
              <button
                key={p.uid}
                onClick={() => setKickTarget(p)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                  kickTarget?.uid === p.uid
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {p.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {p.name}
                    {p.uid === room.hostUid && <Crown className="inline w-3 h-3 text-yellow-500 ml-1" />}
                  </p>
                  <p className="text-xs text-gray-400">Grade {p.grade}</p>
                </div>
                {kickTarget?.uid === p.uid && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Selected</span>
                )}
              </button>
            ))}
            {kickTarget && (
              <button
                onClick={() => startKickVote(kickTarget)}
                disabled={loading || !canCreateVote}
                className="w-full mt-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Start Vote to Remove {kickTarget.name.split(" ")[0]}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start new vote */}
      {!showCreate && !showKickPick && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Start a vote</p>

          {/* Quick votes grid */}
          <div className="grid grid-cols-2 gap-2">
            {QUICK_VOTES.map((preset) => (
              <button
                key={preset.type}
                onClick={() => startQuickVote(preset)}
                disabled={loading || !canCreateVote}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-40 text-left"
              >
                <span className="text-base">{preset.emoji}</span>
                <span className="leading-tight">{preset.label}</span>
              </button>
            ))}

            {/* Pause/Resume timer vote */}
            {(room.status === "active" || room.status === "paused") && (
              <button
                onClick={startPauseVote}
                disabled={loading || !canCreateVote}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-40 text-left"
              >
                {room.status === "paused"
                  ? <><Play className="w-4 h-4 text-green-500 shrink-0" /><span>Resume Timer</span></>
                  : <><Pause className="w-4 h-4 text-orange-500 shrink-0" /><span>Pause Timer</span></>
                }
              </button>
            )}

            {/* Remove host vote (only non-hosts can start this) */}
            {user && user.uid !== room.hostUid && (
              <button
                onClick={startRemoveHostVote}
                disabled={loading || !canCreateVote}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 transition-colors disabled:opacity-40 text-left"
              >
                <Crown className="w-4 h-4 shrink-0" />
                <span>Remove Host</span>
              </button>
            )}

            {/* Kick user vote */}
            {otherParticipants.length > 0 && (
              <button
                onClick={() => { setShowKickPick(true); setShowCreate(false); }}
                disabled={loading || !canCreateVote}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 transition-colors disabled:opacity-40 text-left"
              >
                <UserX className="w-4 h-4 shrink-0" />
                <span>Kick User</span>
              </button>
            )}
          </div>

          <button
            onClick={() => { setShowCreate(true); setShowKickPick(false); }}
            disabled={!canCreateVote}
            className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Custom Vote
          </button>
        </div>
      )}

      {/* Custom vote form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Custom Vote</p>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as Vote["type"])}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="extend">Extend study time</option>
              <option value="break">Take a break</option>
              <option value="skip_break">Skip break</option>
              <option value="pause">Pause timer</option>
              <option value="unpause">Resume timer</option>
              <option value="end">End session</option>
              <option value="custom">Custom action</option>
            </select>

            <input
              type="text"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="Describe your vote..."
              maxLength={100}
              className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400"
            />

            {(customType === "extend" || customType === "break") && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customMins}
                  min={1}
                  max={120}
                  onChange={(e) => setCustomMins(parseInt(e.target.value) || 10)}
                  className="w-20 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-center bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">minutes</span>
              </div>
            )}

            <button
              onClick={startCustomVote}
              disabled={loading || !customDesc.trim() || !canCreateVote}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Start Vote
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
