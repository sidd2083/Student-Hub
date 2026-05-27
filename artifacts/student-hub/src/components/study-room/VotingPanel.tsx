import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Vote, createVote, castVote, resolveVote } from "@/lib/studyRooms";
import type { Room } from "@/lib/studyRooms";
import { useAuth } from "@/context/AuthContext";
import { ThumbsUp, ThumbsDown, Plus, X as XIcon } from "lucide-react";

interface Props {
  room: Room;
  votes: Vote[];
  participantCount: number;
}

const QUICK_VOTES = [
  { type: "extend"     as const, label: "Extend +15m",    emoji: "⏰", addMinutes: 15, desc: "Extend study by 15 minutes?" },
  { type: "break"      as const, label: "Take 10m break", emoji: "☕", addMinutes: 10, desc: "Take a 10 minute break?" },
  { type: "skip_break" as const, label: "Skip break",     emoji: "⚡", addMinutes: 0,  desc: "Skip the next break?" },
  { type: "end"        as const, label: "End session",    emoji: "🏁", addMinutes: 0,  desc: "End the study session?" },
];

export function VotingPanel({ room, votes, participantCount }: Props) {
  const { user, profile } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [customDesc, setCustomDesc] = useState("");
  const [customMins, setCustomMins] = useState(10);
  const [customType, setCustomType] = useState<Vote["type"]>("extend");
  const [loading, setLoading] = useState(false);
  const resolvingRef = useRef<Set<string>>(new Set());

  // Active votes that haven't expired yet (for display)
  const activeVotes = votes.filter(v => {
    if (v.status !== "active") return false;
    if (!v.expiresAt) return true;
    return v.expiresAt.toMillis() > Date.now();
  });

  // ── Auto-resolve votes ────────────────────────────────────────────────────
  // Check every second: resolve when expired or all participants have voted
  useEffect(() => {
    if (votes.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      for (const vote of votes) {
        if (vote.status !== "active") continue;
        if (resolvingRef.current.has(vote.id)) continue;

        const yes = vote.yesVoters.length;
        const no = vote.noVoters.length;
        const totalVoted = yes + no;
        const isExpired = vote.expiresAt && vote.expiresAt.toMillis() < now;
        const allVoted = totalVoted >= Math.max(participantCount, 1);

        if (isExpired || allVoted) {
          resolvingRef.current.add(vote.id);
          resolveVote(room.id, vote.id, room)
            .catch((err) => console.warn("[Vote] resolve failed:", err))
            .finally(() => resolvingRef.current.delete(vote.id));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [votes, room, participantCount]);

  // ── Countdown display for each vote ──────────────────────────────────────
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function startQuickVote(preset: typeof QUICK_VOTES[0]) {
    if (!user || !profile) return;
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
    } catch (err) {
      console.error("[Vote] create failed:", err);
    }
    setLoading(false);
  }

  async function startCustomVote() {
    if (!user || !profile || !customDesc.trim()) return;
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

  return (
    <div className="space-y-3">
      {/* Active votes */}
      <AnimatePresence>
        {activeVotes.map((vote) => {
          const yes = vote.yesVoters.length;
          const no = vote.noVoters.length;
          const total = Math.max(participantCount, yes + no, 1);
          const yesPct = Math.round((yes / total) * 100);
          const hasVotedYes = user ? vote.yesVoters.includes(user.uid) : false;
          const hasVotedNo  = user ? vote.noVoters.includes(user.uid)  : false;
          const hasVoted    = hasVotedYes || hasVotedNo;

          // Countdown
          const secsLeft = vote.expiresAt
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
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    by {vote.createdByName}
                  </p>
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

              {/* Progress bar */}
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

      {/* No active votes */}
      {activeVotes.length === 0 && !showCreate && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-2">
          No active votes. Start one below.
        </p>
      )}

      {/* Start new vote */}
      {!showCreate ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Start a vote</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_VOTES.map((preset) => (
              <button
                key={preset.type}
                onClick={() => startQuickVote(preset)}
                disabled={loading}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50 text-left"
              >
                <span className="text-base">{preset.emoji}</span>
                <span className="leading-tight">{preset.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Custom Vote
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3"
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
            disabled={loading || !customDesc.trim()}
            className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Start Vote
          </button>
        </motion.div>
      )}
    </div>
  );
}
