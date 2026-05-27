import { motion, AnimatePresence } from "framer-motion";
import { RoomParticipant } from "@/lib/studyRooms";
import { Crown, BookOpen, Coffee } from "lucide-react";

interface Props {
  participants: RoomParticipant[];
  hostUid: string;
  onSelectStudent?: (p: RoomParticipant) => void;
  timerDisplay?: string;
  timerLabel?: string;
  timerPhaseType?: "study" | "break" | null;
  roomStatus?: string;
  compact?: boolean;
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  "bg-rose-500", "bg-amber-500", "bg-lime-500", "bg-fuchsia-500",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Seat({ p, isHost, onClick, compact }: {
  p: RoomParticipant | null;
  isHost: boolean;
  onClick?: () => void;
  compact: boolean;
}) {
  if (!p) {
    const sz = compact ? "w-9 h-9" : "w-11 h-11";
    return (
      <div className={`flex flex-col items-center gap-1 ${compact ? "w-14" : "w-18"}`}>
        <div className={`${sz} rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center`}>
          <span className="text-gray-300 dark:text-gray-600 text-sm">·</span>
        </div>
        <div className={`h-2 ${compact ? "w-8" : "w-10"} bg-gray-100 dark:bg-gray-800 rounded`} />
      </div>
    );
  }

  const initial = p.name.charAt(0).toUpperCase();
  const color   = avatarColor(p.name);
  const sz      = compact ? "w-9 h-9 text-sm" : "w-11 h-11 text-base";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${compact ? "w-14" : "w-18"} cursor-pointer group`}
    >
      <div className="relative">
        {isHost && (
          <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-yellow-500 drop-shadow" />
        )}
        <div className={`${sz} rounded-full ${color} flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-shadow`}>
          {initial}
        </div>
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
      </div>
      <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-semibold text-gray-700 dark:text-gray-300 truncate max-w-full leading-tight text-center`}>
        {p.name.split(" ")[0]}
      </p>
      <p className={`${compact ? "text-[8px]" : "text-[9px]"} text-gray-400 -mt-0.5`}>G{p.grade}</p>
    </motion.button>
  );
}

function Bench({ left, right, hostUid, onSelect, compact }: {
  left: RoomParticipant | null;
  right: RoomParticipant | null;
  hostUid: string;
  onSelect: (p: RoomParticipant) => void;
  compact: boolean;
}) {
  const deskW = compact ? "w-32" : "w-40 sm:w-48";
  const gap   = compact ? "gap-4" : "gap-5 sm:gap-7";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`flex items-end ${gap}`}>
        <AnimatePresence mode="popLayout">
          <Seat key={left?.uid ?? "el"} p={left} isHost={!!left && left.uid === hostUid}
            onClick={left ? () => onSelect(left) : undefined} compact={compact} />
          <Seat key={right?.uid ?? "er"} p={right} isHost={!!right && right.uid === hostUid}
            onClick={right ? () => onSelect(right) : undefined} compact={compact} />
        </AnimatePresence>
      </div>
      {/* Desk */}
      <div className={`relative ${deskW}`}>
        <div className="h-2.5 bg-gradient-to-b from-amber-200 to-amber-300 dark:from-amber-700 dark:to-amber-800 rounded-t-xl shadow-sm border border-amber-300/60 dark:border-amber-600/60" />
        <div className="h-1.5 bg-amber-400 dark:bg-amber-600 rounded-b" />
        <div className="flex justify-between px-4 mt-0.5">
          <div className="w-1.5 h-2.5 bg-amber-500 dark:bg-amber-700 rounded-b" />
          <div className="w-1.5 h-2.5 bg-amber-500 dark:bg-amber-700 rounded-b" />
        </div>
      </div>
    </div>
  );
}

export function ClassroomView({
  participants, hostUid, onSelectStudent,
  timerDisplay, timerLabel, timerPhaseType, roomStatus, compact = false,
}: Props) {
  const pairs: (RoomParticipant | null)[][] = [];
  for (let i = 0; i < participants.length; i += 2) {
    pairs.push([participants[i] ?? null, participants[i + 1] ?? null]);
  }
  while (pairs.length < (compact ? 2 : 3)) pairs.push([null, null]);

  const isStudying = timerPhaseType === "study" && roomStatus === "active";
  const isBreak    = timerPhaseType === "break"  && roomStatus === "active";
  const showTimer  = timerDisplay && roomStatus && roomStatus !== "waiting" && roomStatus !== "finished";
  const isWaiting  = roomStatus === "waiting";

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: compact ? 300 : 380 }}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-slate-50 to-stone-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950" />

      {/* Floor lines */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 55px,#64748b 55px,#64748b 56px)",
        backgroundPosition: "0 190px",
      }} />

      {/* Window - left */}
      <div className="absolute top-3 left-3 w-11 h-14 rounded-t-lg border-2 border-sky-200/60 dark:border-sky-800/30 bg-sky-100/40 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-sky-200/60 dark:bg-sky-800/20 rounded-sm" />)}
      </div>
      {/* Window - right */}
      <div className="absolute top-3 right-3 w-11 h-14 rounded-t-lg border-2 border-sky-200/60 dark:border-sky-800/30 bg-sky-100/40 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-sky-200/60 dark:bg-sky-800/20 rounded-sm" />)}
      </div>

      {/* Blackboard */}
      <div className="relative mx-auto max-w-md px-5 pt-4">
        <div className="relative bg-emerald-800 dark:bg-emerald-900 rounded-xl shadow-lg border-4 border-amber-800/25 dark:border-amber-900/40 overflow-hidden">
          {/* Chalk marks decoration */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-2 left-6 w-8 h-px bg-white rotate-12" />
            <div className="absolute top-4 right-10 w-5 h-px bg-white -rotate-6" />
            <div className="absolute bottom-3 left-12 w-6 h-px bg-white rotate-3" />
          </div>

          {showTimer ? (
            <div className="relative flex flex-col items-center justify-center py-3 px-4">
              <div className="flex items-center gap-1.5 mb-1">
                {isStudying && <BookOpen className="w-3 h-3 text-emerald-300/70" />}
                {isBreak    && <Coffee   className="w-3 h-3 text-emerald-300/70" />}
                <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-emerald-300/60">
                  {timerLabel ?? (isStudying ? "Studying" : isBreak ? "Break" : "Session")}
                </p>
              </div>
              <p className={`font-mono font-black tracking-tight leading-none ${compact ? "text-3xl" : "text-4xl sm:text-5xl"} ${
                isStudying ? "text-white" : isBreak ? "text-green-300" : "text-emerald-200"
              }`}>
                {timerDisplay}
              </p>
              <div className="h-px w-full bg-emerald-700/50 rounded mt-3" />
            </div>
          ) : (
            <div className="py-3 px-4 text-center">
              <p className="text-emerald-200/60 text-xs font-light tracking-[0.2em]">✦ STUDY TOGETHER ✦</p>
              <p className="text-emerald-200/35 text-[10px] mt-0.5">
                {isWaiting ? "Waiting for host to start…" : "focus · grow · achieve"}
              </p>
              <div className="h-px w-full bg-emerald-700/50 rounded mt-2" />
            </div>
          )}

          {/* Chalk tray */}
          <div className="flex gap-1 justify-center pb-1.5">
            {["bg-white/60","bg-yellow-200/60","bg-pink-200/60","bg-blue-200/60"].map((c,i) => (
              <div key={i} className={`w-4 h-1 rounded-full ${c}`} />
            ))}
          </div>
        </div>

        {/* Teacher's desk */}
        <div className="flex justify-center mt-3 mb-4">
          <div className="relative">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex gap-3">
              <div className="w-1 h-1.5 bg-blue-400/60 rounded-t-sm" />
              <div className="w-1 h-1.5 bg-red-400/60 rounded-t-sm" />
            </div>
            <div className="w-24 h-2.5 bg-gradient-to-b from-amber-300 to-amber-400 dark:from-amber-700 dark:to-amber-800 rounded-t shadow-sm border border-amber-300/50 dark:border-amber-600/50" />
            <div className="w-24 h-1 bg-amber-500 dark:bg-amber-600 rounded-b" />
          </div>
        </div>
      </div>

      {/* Student rows */}
      <div className={`relative px-4 pb-5 ${compact ? "space-y-4" : "space-y-5 sm:space-y-6"}`}>
        {pairs.map((pair, row) => (
          <div key={row} className="flex justify-center">
            <Bench
              left={pair[0]} right={pair[1]}
              hostUid={hostUid}
              onSelect={(p) => onSelectStudent?.(p)}
              compact={compact}
            />
          </div>
        ))}
      </div>

      {/* Participant count badge */}
      <div className="absolute bottom-2 right-3">
        <p className="text-[10px] text-gray-400/70 dark:text-gray-500/70">
          {participants.length} student{participants.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
