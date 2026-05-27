import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoomParticipant } from "@/lib/studyRooms";
import { Crown } from "lucide-react";

interface Props {
  participants: RoomParticipant[];
  hostUid: string;
  onSelectStudent?: (p: RoomParticipant) => void;
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
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
          <span className="text-gray-300 dark:text-gray-600 text-lg">·</span>
        </div>
        <div className="h-3 w-10 rounded bg-gray-100 dark:bg-gray-800" />
        <div className="h-2.5 w-8 rounded bg-gray-100 dark:bg-gray-800" />
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
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 w-20 cursor-pointer group"
    >
      {/* Name */}
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-full text-center leading-tight">
        {participant.name.split(" ")[0]}
      </p>
      {/* Grade */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1 leading-tight">
        Grade {participant.grade}
      </p>
      {/* Avatar */}
      <div className="relative">
        <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:shadow-lg transition-shadow`}>
          {initial}
        </div>
        {isHost && (
          <div className="absolute -top-1.5 -right-1.5 bg-yellow-400 rounded-full p-0.5 shadow-sm">
            <Crown className="w-2.5 h-2.5 text-yellow-900" />
          </div>
        )}
        {/* Active indicator */}
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
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
    <div className="flex flex-col items-center gap-2">
      {/* Students sitting at bench */}
      <div className="flex items-end gap-4 sm:gap-6">
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
      {/* Bench/desk visual */}
      <div className="relative w-40 sm:w-48">
        {/* Desk top */}
        <div className="h-3 bg-gradient-to-b from-amber-200 to-amber-300 dark:from-amber-700 dark:to-amber-800 rounded-t-xl shadow-sm border border-amber-300 dark:border-amber-600" />
        {/* Desk front panel */}
        <div className="h-1.5 bg-amber-400 dark:bg-amber-600 rounded-b-md" />
        {/* Desk legs */}
        <div className="flex justify-between px-4 mt-0.5">
          <div className="w-1.5 h-3 bg-amber-500 dark:bg-amber-700 rounded-b" />
          <div className="w-1.5 h-3 bg-amber-500 dark:bg-amber-700 rounded-b" />
        </div>
      </div>
    </div>
  );
}

export function ClassroomView({ participants, hostUid, onSelectStudent }: Props) {
  // Pair participants into benches of 2
  const pairs: (RoomParticipant | null)[][] = [];
  for (let i = 0; i < Math.max(participants.length, 2); i += 2) {
    pairs.push([
      participants[i] ?? null,
      participants[i + 1] ?? null,
    ]);
  }

  // Show at least 3 benches
  while (pairs.length < 3) pairs.push([null, null]);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Classroom background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-slate-50 to-stone-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 rounded-2xl" />

      {/* Blackboard */}
      <div className="relative mx-auto max-w-lg px-4 pt-5 pb-2">
        <div className="bg-emerald-800 dark:bg-emerald-900 rounded-xl p-4 shadow-lg border-4 border-amber-700/30 dark:border-amber-800/40 mb-6">
          <div className="flex items-center justify-center">
            <p className="text-emerald-200 text-sm font-light tracking-widest opacity-60">
              ✦ study together ✦
            </p>
          </div>
          <div className="text-center mt-1">
            <p className="text-emerald-100 text-xs opacity-40">focus · grow · achieve</p>
          </div>
          {/* Chalk tray */}
          <div className="h-1 w-full bg-emerald-700/50 dark:bg-emerald-800/50 rounded-full mt-3" />
        </div>

        {/* Teacher's desk */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-28 h-2.5 bg-gradient-to-b from-amber-300 to-amber-400 dark:from-amber-700 dark:to-amber-800 rounded-t shadow border border-amber-400 dark:border-amber-600" />
            <div className="w-28 h-1 bg-amber-500 dark:bg-amber-600 rounded-b" />
          </div>
        </div>

        {/* Floor lines */}
        <div className="absolute inset-0 opacity-5 dark:opacity-[0.03]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 48px, #94a3b8 48px, #94a3b8 49px)",
          backgroundPosition: "0 120px",
        }} />
      </div>

      {/* Student rows */}
      <div className="relative px-4 pb-6 space-y-6 sm:space-y-8">
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

      {/* Window decorations */}
      <div className="absolute top-4 left-4 w-14 h-16 rounded-t-xl border-2 border-sky-200/50 dark:border-sky-800/30 bg-sky-100/40 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-sky-200/50 dark:bg-sky-800/20 rounded-sm" />
        ))}
      </div>
      <div className="absolute top-4 right-4 w-14 h-16 rounded-t-xl border-2 border-sky-200/50 dark:border-sky-800/30 bg-sky-100/40 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-sky-200/50 dark:bg-sky-800/20 rounded-sm" />
        ))}
      </div>
    </div>
  );
}
