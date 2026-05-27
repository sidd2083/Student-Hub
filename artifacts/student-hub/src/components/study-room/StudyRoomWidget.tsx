import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Users, BookOpen, Plus, ArrowRight, Coffee } from "lucide-react";
import { Room, subscribePublicRooms, getRemainingSeconds, formatTime } from "@/lib/studyRooms";
import { useAuth } from "@/context/AuthContext";

function MiniRoomCard({ room }: { room: Room }) {
  // Tick every second so the countdown is live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (room.status !== "active") return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [room.status, room.id]);

  const phase = room.studyFlow[room.currentPhaseIndex];
  const remaining = getRemainingSeconds(room);
  const isStudy = phase?.type === "study";

  return (
    <Link href={`/study-rooms/${room.id}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all cursor-pointer"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isStudy ? "bg-blue-50 dark:bg-blue-900/30" : "bg-green-50 dark:bg-green-900/30"
        }`}>
          {isStudy
            ? <BookOpen className="w-4 h-4 text-blue-500" />
            : <Coffee className="w-4 h-4 text-green-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{room.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{room.subject} · {room.participantCount} studying</p>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {room.status === "active" && (
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatTime(remaining)}</span>
          )}
          {room.status === "waiting" && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Waiting</span>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            {room.participantCount}/{room.maxParticipants}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export function StudyRoomWidget() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribePublicRooms((r) => {
      setRooms(r);
      setLoaded(true);
    });
    return unsub;
  }, []);

  const activeRooms  = rooms.filter(r => r.status === "active" || r.status === "waiting");
  const studyingNow  = rooms.reduce((s, r) => s + r.participantCount, 0);
  const previewRooms = activeRooms.slice(0, 2);

  return (
    <div className="mb-6 sm:mb-8 rounded-2xl border border-blue-100 dark:border-blue-900/30 overflow-hidden shadow-sm">
      <div
        className="px-4 sm:px-5 py-4 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg,#2563eb 0%,#4f46e5 100%)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Users className="w-4 h-4 text-blue-200" />
            <p className="text-white font-bold text-sm leading-tight">Study Together</p>
            {loaded && studyingNow > 0 && (
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                {studyingNow} online
              </span>
            )}
          </div>
          <p className="text-blue-200 text-xs leading-tight">
            {loaded
              ? activeRooms.length > 0
                ? `${activeRooms.length} room${activeRooms.length !== 1 ? "s" : ""} active — join a session or start your own`
                : "No rooms active — be the first to start a session!"
              : "Virtual study rooms with timer sync & live chat"}
          </p>
        </div>
        <Link href="/study-rooms" className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-all text-white text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 px-4 sm:px-5 py-4 space-y-3">
        {loaded && previewRooms.length > 0 ? (
          <>
            {previewRooms.map(room => (
              <MiniRoomCard key={room.id} room={room} />
            ))}
            {activeRooms.length > 2 && (
              <Link href="/study-rooms" className="block text-center text-xs text-blue-500 dark:text-blue-400 hover:underline">
                +{activeRooms.length - 2} more rooms
              </Link>
            )}
          </>
        ) : (
          <div className="text-center py-2 space-y-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {loaded ? "No active rooms right now" : "Loading rooms..."}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link
            href="/study-rooms"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 transition-colors"
          >
            Browse Rooms
          </Link>
          {user && (
            <Link
              href="/study-rooms/create"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create Room
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
