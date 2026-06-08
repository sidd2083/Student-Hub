import { useState, useCallback } from "react";
import { Users, Target, Check, X, Heart, Sparkles, Trophy } from "lucide-react";
import type { RoomParticipant } from "@/lib/studyRooms";
import { setBuddyPair, clearBuddy, toggleBuddyGoalDone, setBuddyGoalText } from "@/lib/studyRooms";

const MOTIVATIONAL_TIPS = [
  "Working with a buddy boosts accountability by 65%! 🚀",
  "Studies show paired studying improves retention — you've got this! 💪",
  "Your buddy is counting on you — let's make this session count! 🎯",
  "Two minds are better than one. Keep pushing! 🧠",
  "The best study sessions are the ones you don't do alone. 🤝",
];

const GOAL_SUGGESTIONS = [
  "Finish Chapter 5 exercises",
  "Complete 20 MCQs",
  "Read & summarize 10 pages",
  "Memorize key formulas",
  "Write notes on today's topic",
];

interface Props {
  myUid: string;
  roomId: string;
  participants: RoomParticipant[];
  onBuddyGoalCelebrate?: (buddyName: string) => void;
}

export function StudyBuddyPanel({ myUid, roomId, participants, onBuddyGoalCelebrate }: Props) {
  const [loading, setLoading]       = useState(false);
  const [goalInput, setGoalInput]   = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [tipIdx]                    = useState(() => Math.floor(Math.random() * MOTIVATIONAL_TIPS.length));

  const me = participants.find(p => p.uid === myUid);
  const buddy = me?.buddyUid ? participants.find(p => p.uid === me.buddyUid) : null;

  const available = participants.filter(p =>
    p.uid !== myUid && !p.buddyUid && p.isActive,
  );

  const handlePairWith = useCallback(async (other: RoomParticipant) => {
    setLoading(true);
    try {
      await setBuddyPair(roomId, myUid, other.uid);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [roomId, myUid]);

  const handleUnpair = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try { await clearBuddy(roomId, myUid, me.buddyUid); }
    catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [roomId, myUid, me]);

  const handleSaveGoal = useCallback(async () => {
    if (!goalInput.trim()) return;
    setLoading(true);
    try {
      await setBuddyGoalText(roomId, myUid, goalInput.trim());
      if (buddy) await setBuddyGoalText(roomId, buddy.uid, goalInput.trim());
      setEditingGoal(false);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [roomId, myUid, buddy, goalInput]);

  const handleToggleGoal = useCallback(async (done: boolean) => {
    setLoading(true);
    try {
      await toggleBuddyGoalDone(roomId, myUid, done);
      if (done && buddy && onBuddyGoalCelebrate) {
        onBuddyGoalCelebrate(buddy.name);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [roomId, myUid, buddy, onBuddyGoalCelebrate]);

  const buddyGoalDone = buddy?.myGoalDone ?? false;
  const myGoalDone    = me?.myGoalDone ?? false;
  const bothDone      = myGoalDone && buddyGoalDone;
  const sharedGoal    = me?.buddyGoal ?? buddy?.buddyGoal ?? "";

  if (buddy) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-800/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">Study Buddy</span>
          </div>
          <button
            onClick={handleUnpair}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {buddy.photoURL
              ? <img src={buddy.photoURL} alt={buddy.name} className="w-full h-full object-cover" />
              : buddy.name.charAt(0).toUpperCase()
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{buddy.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${buddy.isActive ? "bg-green-500" : "bg-gray-300"}`} />
              <span className="text-xs text-gray-500">
                {buddy.isActive ? "Active" : "Away"} · Grade {buddy.grade}
              </span>
            </div>
          </div>
          {bothDone && (
            <Trophy className="w-5 h-5 text-yellow-500 shrink-0" />
          )}
        </div>

        {sharedGoal ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 bg-white dark:bg-gray-900/60 rounded-xl p-3 border border-indigo-100 dark:border-indigo-800/30">
              <Target className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wide mb-0.5">Shared Goal</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{sharedGoal}</p>
              </div>
              <button
                onClick={() => { setGoalInput(sharedGoal); setEditingGoal(true); }}
                className="text-gray-400 hover:text-indigo-500 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleToggleGoal(!myGoalDone)}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  myGoalDone
                    ? "bg-green-500 text-white"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-green-400 hover:text-green-600"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                {myGoalDone ? "My part done! ✅" : "Mark my part done"}
              </button>
            </div>

            {buddyGoalDone && !myGoalDone && (
              <p className="text-xs text-center text-green-600 dark:text-green-400 font-medium">
                🎉 {buddy.name.split(" ")[0]} finished their part — your turn!
              </p>
            )}
            {bothDone && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-2.5 text-center">
                <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">🏆 Both done! Incredible teamwork!</p>
              </div>
            )}
          </div>
        ) : editingGoal ? (
          <div className="space-y-2">
            <input
              type="text"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value.slice(0, 80))}
              placeholder="e.g. Finish Chapter 5 exercises"
              className="w-full text-sm border border-indigo-200 dark:border-indigo-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              onKeyDown={e => { if (e.key === "Enter") handleSaveGoal(); }}
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {GOAL_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setGoalInput(s)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingGoal(false)} className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={!goalInput.trim() || loading}
                className="flex-1 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-40"
              >
                Set Goal
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setGoalInput(""); setEditingGoal(true); }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-indigo-500 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            Set a shared study goal
          </button>
        )}

        <p className="text-[11px] text-center text-indigo-400 dark:text-indigo-500 italic px-2">
          {MOTIVATIONAL_TIPS[tipIdx]}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-bold text-gray-900 dark:text-white">Study Buddy</span>
      </div>

      {available.length === 0 ? (
        <div className="text-center py-4">
          <div className="text-2xl mb-2">🤝</div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {participants.filter(p => p.uid !== myUid).length === 0
              ? "You're the only one here — invite someone to pair up!"
              : "Everyone has a buddy already!"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Pair with someone to set shared goals and keep each other accountable 💪
          </p>
          {available.map(p => (
            <div key={p.uid} className="flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {p.photoURL
                  ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                  : p.name.charAt(0).toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-400">Grade {p.grade}</p>
              </div>
              <button
                onClick={() => handlePairWith(p)}
                disabled={loading}
                className="shrink-0 text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-40"
              >
                Buddy Up!
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
