import { motion } from "framer-motion";
import { Users, Clock, Lock, Unlock, BookOpen, Coffee, Timer } from "lucide-react";
import { Room, getRemainingSeconds, formatTime } from "@/lib/studyRooms";

interface Props {
  room: Room;
  onJoin: (room: Room) => void;
}

const SUBJECT_COLORS: Record<string, string> = {
  "Science":              "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Mathematics":          "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "English":              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "Physics":              "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Chemistry":            "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "Biology":              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Nepali":               "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "Social Studies":       "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Computer Science":     "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Accounts":             "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "Economics":            "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
  "Optional Mathematics": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

function statusLabel(room: Room) {
  switch (room.status) {
    case "waiting": return { label: "Waiting",  dot: "bg-yellow-400",                color: "text-yellow-600 dark:text-yellow-400" };
    case "active":  return { label: "Studying", dot: "bg-green-400 animate-pulse",   color: "text-green-600 dark:text-green-400"  };
    case "paused":  return { label: "Paused",   dot: "bg-orange-400",               color: "text-orange-600 dark:text-orange-400" };
    default:        return { label: "Finished", dot: "bg-gray-400",                 color: "text-gray-400"                        };
  }
}

export function RoomCard({ room, onJoin }: Props) {
  const status       = statusLabel(room);
  const phase        = room.studyFlow[room.currentPhaseIndex];
  const remaining    = getRemainingSeconds(room);
  const subjectColor = SUBJECT_COLORS[room.subject] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  const isFull       = room.participantCount >= room.maxParticipants;
  const isPrivate    = room.isPrivate;
  const totalMins    = room.studyFlow.reduce((s, p) => s + p.durationMins, 0);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all overflow-hidden h-full flex flex-col"
    >
      {/* Colored top accent based on status */}
      <div className={`h-1 w-full ${room.status === "active" ? "bg-green-400" : room.status === "waiting" ? "bg-yellow-400" : "bg-orange-400"}`} />

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
                <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
              </div>
              {isPrivate && (
                <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800/40">
                  <Lock className="w-3 h-3" /> Private
                </div>
              )}
              {!isPrivate && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Unlock className="w-3 h-3" /> Public
                </div>
              )}
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-[15px] leading-tight truncate">
              {room.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              by {room.hostName} · Grade {room.hostGrade}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${subjectColor}`}>
            {room.subject}
          </span>
        </div>

        {/* Description */}
        {room.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
            {room.description}
          </p>
        )}

        {/* Current phase */}
        {phase && (
          <div className={`flex items-center gap-2 mb-3 p-2.5 rounded-xl ${
            room.status === "active" && phase.type === "study"
              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30"
              : room.status === "active" && phase.type === "break"
                ? "bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30"
                : "bg-gray-50 dark:bg-gray-800/50"
          }`}>
            {phase.type === "study"
              ? <BookOpen className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              : <Coffee    className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{phase.label}</p>
              <p className="text-[10px] text-gray-400">Phase {room.currentPhaseIndex + 1}/{room.studyFlow.length}</p>
            </div>
            {room.status !== "waiting" && room.status !== "finished" && (
              <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-200 flex-shrink-0">
                {formatTime(remaining)}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-sm ${isFull ? "text-red-500 font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
              <Users className="w-4 h-4" />
              <span>{room.participantCount}/{room.maxParticipants}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Timer className="w-3.5 h-3.5" />
              {totalMins}m
            </div>
          </div>

          <button
            onClick={() => !isFull && onJoin(room)}
            disabled={isFull}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${
              isFull
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                : isPrivate
                  ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow"
            }`}
          >
            {isFull ? "Full" : isPrivate ? "🔒 Join" : "Join"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
