import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveRoom } from "@/context/ActiveRoomContext";
import { formatTime } from "@/lib/studyRooms";
import { BookOpen, Coffee, Users, Play, Pause, X } from "lucide-react";

export function ActiveRoomBar() {
  const [location] = useLocation();
  const { activeRoomId, room, participants, remainingSeconds, leaveActiveRoom } = useActiveRoom();

  // Don't show bar if no active room, or already on the room page
  if (!activeRoomId || !room || location.startsWith(`/study-rooms/${activeRoomId}`)) return null;
  if (room.status === "finished") return null;

  const phase = room.studyFlow[room.currentPhaseIndex];
  const isStudy = phase?.type === "study";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 ${
          isStudy
            ? "bg-blue-600 dark:bg-blue-700"
            : "bg-green-600 dark:bg-green-700"
        } text-white shadow-lg`}
      >
        <div className="flex items-center justify-between px-3 py-2 max-w-screen-lg mx-auto">
          <Link href={`/study-rooms/${activeRoomId}`}>
            <a className="flex items-center gap-2 flex-1 min-w-0">
              {isStudy
                ? <BookOpen className="w-4 h-4 flex-shrink-0 opacity-90" />
                : <Coffee className="w-4 h-4 flex-shrink-0 opacity-90" />
              }
              <span className="text-sm font-semibold truncate">{room.title}</span>
              <span className="text-white/70 text-xs hidden sm:inline">·</span>
              <span className="text-white/80 text-xs hidden sm:inline truncate">{phase?.label}</span>
            </a>
          </Link>

          <div className="flex items-center gap-3 flex-shrink-0">
            {room.status === "active" && (
              <span className="font-mono text-sm font-bold tabular-nums">
                {formatTime(remainingSeconds)}
              </span>
            )}
            {room.status === "paused" && (
              <span className="flex items-center gap-1 text-xs text-white/70">
                <Pause className="w-3 h-3" /> Paused
              </span>
            )}
            {room.status === "waiting" && (
              <span className="flex items-center gap-1 text-xs text-white/70">
                Waiting to start
              </span>
            )}

            <div className="flex items-center gap-1 text-white/70 text-xs">
              <Users className="w-3.5 h-3.5" />
              <span>{participants.length}</span>
            </div>

            <button
              onClick={(e) => {
                e.preventDefault();
                leaveActiveRoom();
              }}
              className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Leave room"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
