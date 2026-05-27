import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoomParticipant } from "@/lib/studyRooms";
import { Crown, BookOpen, Coffee } from "lucide-react";

interface Props {
  participants: RoomParticipant[];
  hostUid: string;
  onSelectStudent?: (p: RoomParticipant) => void;
  // Timer integration
  timerDisplay?: string;
  timerLabel?: string;
  timerPhaseType?: "study" | "break" | null;
  roomStatus?: string;
}

function avatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-orange-500",
    "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
    "bg-rose-500", "bg-violet-500", "bg-amber-500", "bg-lime-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function StudentSeat({ participant, isHost, onClick }: {
  participant: RoomParticipant | null;
  isHost: boolean;
  onClick?: () => void;
}) {
  if (!participant) {
    return (
      <div className="flex flex-col items-center gap-1.5 w-20">
        <div className="h-3 w-10 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-2 w-8 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="w-11 h-11 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
          <span className="text-gray-300 dark:text-gray-600 text-lg">·</span>
        </div>
      </div>
    );
  }

  const initial = participant.name.charAt(0).toUpperCase();
  const color = avatarColor(participant.name);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1 w-20 cursor-pointer group"
    >
      {/* Name above avatar */}
      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate max-w-full text-center leading-tight">
        {participant.name.split(" ")[0]}
      </p>
      <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight -mt-0.5">
        Grade {participant.grade}
      </p>
      {/* Avatar */}
      <div className="relative mt-0.5">
        <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white font-bold text-base shadow-md group-hover:shadow-lg transition-shadow`}>
          {initial}
        </div>
        {isHost && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <Crown className="w-3.5 h-3.5 text-yellow-500 drop-shadow" />
          </div>
        )}
        {/* Active indicator */}
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
      </div>
    </motion.button>
  );
}

function Bench({ left, right, hostUid, onSelect }: {
  left: RoomParticipant | null;
  right: RoomParticipant | null;
  hostUid: string;
  onSelect: (p: RoomParticipant) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Two students per bench */}
      <div className="flex items-end gap-5 sm:gap-7">
        <AnimatePresence mode="popLayout">
          <StudentSeat
            key={left?.uid ?? "empty-left"}
            participant={left}
            isHost={!!left && left.uid === hostUid}
            onClick={left ? () => onSelect(left) : undefined}
          />
          <StudentSeat
            key={right?.uid ?? "empty-right"}
            participant={right}
            isHost={!!right && right.uid === hostUid}
            onClick={right ? () => onSelect(right) : undefined}
          />
        </AnimatePresence>
      </div>
      {/* Desk/bench visual */}
      <div className="relative w-44 sm:w-52">
        <div className="h-3 bg-gradient-to-b from-amber-200 to-amber-300 dark:from-amber-700 dark:to-amber-800 rounded-t-xl shadow-sm border border-amber-300/60 dark:border-amber-600/60" />
        <div className="h-1.5 bg-amber-400 dark:bg-amber-600 rounded-b-md" />
        <div className="flex justify-between px-5 mt-0.5">
          <div className="w-1.5 h-3 bg-amber-500 dark:bg-amber-700 rounded-b" />
          <div className="w-1.5 h-3 bg-amber-500 dark:bg-amber-700 rounded-b" />
        </div>
      </div>
    </div>
  );
}

export function ClassroomView({ participants, hostUid, onSelectStudent, timerDisplay, timerLabel, timerPhaseType, roomStatus }: Props) {
  // Pair participants into benches of exactly 2
  const pairs: (RoomParticipant | null)[][] = [];
  for (let i = 0; i < participants.length; i += 2) {
    pairs.push([
      participants[i] ?? null,
      participants[i + 1] ?? null,
    ]);
  }

  // Show at least 3 benches (empty seats shown as dashed circles)
  while (pairs.length < 3) pairs.push([null, null]);

  const isStudying = timerPhaseType === "study" && roomStatus === "active";
  const isBreak = timerPhaseType === "break" && roomStatus === "active";
  const showTimer = timerDisplay && roomStatus && roomStatus !== "waiting" && roomStatus !== "finished";

  return (
    <div className="relative w-full overflow-hidden min-h-[420px]">
      {/* Classroom background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-slate-50 to-stone-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950" />

      {/* Floor lines */}
      <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.025]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 56px, #94a3b8 56px, #94a3b8 57px)",
        backgroundPosition: "0 180px",
      }} />

      {/* Window decorations */}
      <div className="absolute top-4 left-4 w-12 h-14 rounded-t-lg border-2 border-sky-200/60 dark:border-sky-800/30 bg-sky-100/40 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-sky-200/50 dark:bg-sky-800/20 rounded-sm" />
        ))}
      </div>
      <div className="absolute top-4 right-4 w-12 h-14 rounded-t-lg border-2 border-sky-200/60 dark:border-sky-800/30 bg-sky-100/40 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-sky-200/50 dark:bg-sky-800/20 rounded-sm" />
        ))}
      </div>

      {/* Blackboard — with timer integrated */}
      <div className="relative mx-auto max-w-lg px-6 pt-5 pb-2">
        <div className="bg-emerald-800 dark:bg-emerald-900 rounded-xl shadow-lg border-4 border-amber-700/30 dark:border-amber-800/40 overflow-hidden">
          {showTimer ? (
            <div className="flex flex-col items-center justify-center py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                {isStudying && <BookOpen className="w-3.5 h-3.5 text-emerald-300 opacity-70" />}
                {isBreak && <Coffee className="w-3.5 h-3.5 text-emerald-300 opacity-70" />}
                <p className="text-emerald-300 text-[10px] font-medium tracking-widest uppercase opacity-60">
                  {timerLabel ?? (isStudying ? "Studying" : isBreak ? "Break" : "Session")}
                </p>
              </div>
              {/* Large digital clock on blackboard */}
              <p className={`font-mono font-bold tracking-tight leading-none text-4xl sm:text-5xl ${
                isStudying ? "text-white" : isBreak ? "text-green-300" : "text-emerald-200"
              }`}>
                {timerDisplay}
              </p>
              {/* Chalk tray */}
              <div className="h-0.5 w-full bg-emerald-700/50 dark:bg-emerald-800/50 rounded-full mt-3" />
            </div>
          ) : (
            <div className="p-4">
              <p className="text-emerald-200 text-sm font-light tracking-widest opacity-60 text-center">
                ✦ study together ✦
              </p>
              <p className="text-emerald-100 text-xs opacity-40 text-center mt-1">
                {roomStatus === "waiting" ? "Waiting for host to start…" : "focus · grow · achieve"}
              </p>
              <div className="h-0.5 w-full bg-emerald-700/50 rounded-full mt-3" />
            </div>
          )}
        </div>

        {/* Teacher's desk */}
        <div className="flex justify-center mt-4 mb-5">
          <div>
            <div className="w-28 h-2.5 bg-gradient-to-b from-amber-300 to-amber-400 dark:from-amber-700 dark:to-amber-800 rounded-t shadow border border-amber-400/50 dark:border-amber-600/50" />
            <div className="w-28 h-1 bg-amber-500 dark:bg-amber-600 rounded-b" />
          </div>
        </div>
      </div>

      {/* Student benches */}
      <div className="relative px-4 pb-6 space-y-5 sm:space-y-6">
        {pairs.map((pair, row) => (
          <div key={row} className="flex justify-center">
            <Bench
              left={pair[0]}
              right={pair[1]}
              hostUid={hostUid}
              onSelect={(p) => onSelectStudent?.(p)}
            />
          </div>
        ))}
      </div>

      {/* Participant count footer */}
      <div className="absolute bottom-2 right-3">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {participants.length} student{participants.length !== 1 ? "s" : ""}
          {" · "}
          {Math.ceil(participants.length / 2)} bench{Math.ceil(participants.length / 2) !== 1 ? "es" : ""}
        </p>
      </div>
    </div>
  );
}
