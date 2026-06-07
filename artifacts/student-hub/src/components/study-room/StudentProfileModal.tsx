import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RoomParticipant, getLiveStudyMins } from "@/lib/studyRooms";
import { gradeLabel } from "@/lib/gradeUtils";
import { X, Flame, Trophy, Clock, Calendar, BookOpen } from "lucide-react";

interface UserStats {
  totalStudyTime: number;
  streak: number;
  createdAt: string;
  todayStudyTime: number;
  lastActiveDate: string;
  photoURL?: string;
  badges?: { id: string; text: string; emoji: string; color: string }[];
}

const NPT_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
function getNptToday(): string {
  return new Date(Date.now() + NPT_OFFSET_MS).toISOString().slice(0, 10);
}

interface Props {
  participant: RoomParticipant | null;
  onClose: () => void;
}

const AVATAR_COLORS = [
  "from-blue-500 to-blue-600", "from-purple-500 to-purple-600",
  "from-emerald-500 to-emerald-600", "from-orange-500 to-orange-600",
  "from-pink-500 to-pink-600", "from-cyan-500 to-cyan-600",
  "from-indigo-500 to-indigo-600", "from-teal-500 to-teal-600",
];

const STUDY_TIERS = [
  { mins: 24000, emoji: "🏆", label: "Champion",  bg: "linear-gradient(135deg,#94a3b8,#e2e8f0,#94a3b8)" },
  { mins: 12000, emoji: "🌟", label: "Master",    bg: "linear-gradient(135deg,#d97706,#fcd34d,#d97706)" },
  { mins: 6000,  emoji: "👑", label: "Legend",    bg: "linear-gradient(135deg,#b45309,#fbbf24,#b45309)" },
  { mins: 4500,  emoji: "💎", label: "Scholar",   bg: "linear-gradient(135deg,#6d28d9,#a78bfa,#6d28d9)" },
  { mins: 3000,  emoji: "🔥", label: "Achiever",  bg: "linear-gradient(135deg,#c2410c,#fb923c,#c2410c)" },
  { mins: 1500,  emoji: "⚡", label: "Explorer",  bg: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)" },
  { mins: 180,   emoji: "🌱", label: "Beginner",  bg: "linear-gradient(135deg,#15803d,#4ade80,#15803d)" },
];

const STREAK_TIERS = [
  { days: 100, emoji: "🦁", label: "Elite",        bg: "linear-gradient(135deg,#1e1b4b,#4338ca,#1e1b4b)" },
  { days: 60,  emoji: "⭐", label: "Legendary",    bg: "linear-gradient(135deg,#92400e,#fcd34d,#92400e)" },
  { days: 30,  emoji: "🚀", label: "Unstoppable",  bg: "linear-gradient(135deg,#5b21b6,#c4b5fd,#5b21b6)" },
  { days: 15,  emoji: "💪", label: "Dedicated",    bg: "linear-gradient(135deg,#991b1b,#f87171,#991b1b)" },
  { days: 5,   emoji: "🎯", label: "Consistent",   bg: "linear-gradient(135deg,#164e63,#67e8f9,#164e63)" },
];

function getTopBadge(stats: UserStats | null) {
  if (!stats) return null;
  const custom = stats.badges?.[0];
  if (custom) return { emoji: custom.emoji, label: custom.text, bg: custom.color };
  return (
    STUDY_TIERS.find(t => stats.totalStudyTime >= t.mins)
    ?? STREAK_TIERS.find(t => stats.streak >= t.days)
    ?? null
  );
}

function avatarGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function StudentProfileModal({ participant, onClose }: Props) {
  const [stats,       setStats]       = useState<UserStats | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!participant) return;
    setPhotoBroken(false);
    setStats(null);
    setLoading(true);

    getDoc(doc(db, "users", participant.uid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const s: UserStats = {
            totalStudyTime: d.totalStudyTime ?? 0,
            streak:         d.streak ?? 0,
            createdAt:      d.createdAt ?? "",
            todayStudyTime: d.todayStudyTime ?? 0,
            lastActiveDate: d.lastActiveDate ?? "",
            photoURL:       d.photoURL ?? undefined,
            badges:         d.badges ?? [],
          };
          setStats(s);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [participant?.uid]);

  // Tick every 30 s so "In this room" live minutes stay current
  useEffect(() => {
    if (!participant) return;
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [participant?.uid]);

  if (!participant) return null;

  const photoURL   = (!photoBroken && stats?.photoURL) || null;
  const initial    = participant.name.charAt(0).toUpperCase();
  const gradient   = avatarGradient(participant.name);
  const totalHours = stats ? (stats.totalStudyTime / 60).toFixed(1) : null;
  const todayNpt   = getNptToday();
  const todayMins  = stats ? (stats.lastActiveDate === todayNpt ? stats.todayStudyTime : 0) : null;
  const joinedDate = stats?.createdAt
    ? new Date(stats.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  const liveRoomMins = getLiveStudyMins(participant);
  const roomHours    = (liveRoomMins / 60).toFixed(1);
  const badge        = getTopBadge(stats);

  return (
    <AnimatePresence>
      {participant && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: "spring", damping: 28, stiffness: 500 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden"
            >
              {/* Header with gradient + avatar */}
              <div className={`bg-gradient-to-r ${gradient} p-6 relative`}>
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-white/20 backdrop-blur border-4 border-white/30 shadow-xl flex items-center justify-center">
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt={participant.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={() => setPhotoBroken(true)}
                      />
                    ) : (
                      <span className="text-white text-3xl font-bold">{initial}</span>
                    )}
                  </div>

                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white">{participant.name}</h2>
                    <p className="text-white/70 text-sm mt-0.5">{gradeLabel(participant.grade)}</p>
                    {badge && (
                      <span
                        style={{ background: badge.bg }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-[11px] font-bold leading-none mt-2"
                      >
                        {badge.emoji} {badge.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-3.5 text-center">
                    <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {loading ? <span className="inline-block w-8 h-5 bg-orange-100 rounded animate-pulse" /> : (stats?.streak ?? "—")}
                    </p>
                    <p className="text-xs text-orange-500/70 dark:text-orange-400/60">Day streak</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3.5 text-center">
                    <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {loading ? <span className="inline-block w-10 h-5 bg-blue-100 rounded animate-pulse" /> : (totalHours != null ? `${totalHours}h` : "—")}
                    </p>
                    <p className="text-xs text-blue-500/70 dark:text-blue-400/60">Total studied</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3.5 text-center">
                    <BookOpen className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {loading ? <span className="inline-block w-8 h-5 bg-green-100 rounded animate-pulse" /> : (todayMins != null ? `${todayMins}m` : "—")}
                    </p>
                    <p className="text-xs text-green-500/70 dark:text-green-400/60">Today</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-3.5 text-center">
                    <Trophy className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{roomHours}h</p>
                    <p className="text-xs text-purple-500/70 dark:text-purple-400/60">In this room</p>
                  </div>
                </div>

                {joinedDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 justify-center">
                    <Calendar className="w-4 h-4" />
                    <span>Joined StudentHub {joinedDate}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
