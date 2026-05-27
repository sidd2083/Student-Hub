import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RoomParticipant } from "@/lib/studyRooms";
import { X, Flame, Trophy, Clock, Calendar, BookOpen } from "lucide-react";

interface UserStats {
  totalStudyTime: number;
  streak: number;
  createdAt: string;
  todayStudyTime: number;
}

interface Props {
  participant: RoomParticipant | null;
  onClose: () => void;
}

// Module-level cache so repeated avatar clicks are instant
const statsCache = new Map<string, UserStats>();

function avatarColor(name: string): string {
  const colors = [
    "from-blue-500 to-blue-600", "from-purple-500 to-purple-600",
    "from-emerald-500 to-emerald-600", "from-orange-500 to-orange-600",
    "from-pink-500 to-pink-600", "from-cyan-500 to-cyan-600",
    "from-indigo-500 to-indigo-600", "from-teal-500 to-teal-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function StudentProfileModal({ participant, onClose }: Props) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!participant) return;

    // Serve from cache immediately — no loading state needed
    const cached = statsCache.get(participant.uid);
    if (cached) {
      setStats(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setStats(null);

    getDoc(doc(db, "users", participant.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const s: UserStats = {
          totalStudyTime: d.totalStudyTime ?? 0,
          streak: d.streak ?? 0,
          createdAt: d.createdAt ?? "",
          todayStudyTime: d.todayStudyTime ?? 0,
        };
        statsCache.set(participant.uid, s);
        setStats(s);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [participant?.uid]);

  if (!participant) return null;

  const initial = participant.name.charAt(0).toUpperCase();
  const gradient = avatarColor(participant.name);
  const totalHours = stats ? (stats.totalStudyTime / 60).toFixed(1) : "—";
  const todayMins = stats ? stats.todayStudyTime : 0;
  const joinedDate = stats?.createdAt
    ? new Date(stats.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";
  const roomHours = (participant.studyMinsInRoom / 60).toFixed(1);

  return (
    <AnimatePresence>
      {participant && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden">
              <div className={`bg-gradient-to-r ${gradient} p-6 relative`}>
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-3xl shadow-xl border-4 border-white/30">
                    {initial}
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-white">{participant.name}</h2>
                    <p className="text-white/70 text-sm mt-0.5">Grade {participant.grade}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-3.5 text-center">
                        <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                        <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats?.streak ?? "—"}</p>
                        <p className="text-xs text-orange-500/70 dark:text-orange-400/60">Day streak</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3.5 text-center">
                        <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{totalHours}h</p>
                        <p className="text-xs text-blue-500/70 dark:text-blue-400/60">Total studied</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3.5 text-center">
                        <BookOpen className="w-5 h-5 text-green-500 mx-auto mb-1" />
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">{todayMins}m</p>
                        <p className="text-xs text-green-500/70 dark:text-green-400/60">Today</p>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-3.5 text-center">
                        <Trophy className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{roomHours}h</p>
                        <p className="text-xs text-purple-500/70 dark:text-purple-400/60">In this room</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 justify-center">
                      <Calendar className="w-4 h-4" />
                      <span>Joined StudentHub {joinedDate}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
