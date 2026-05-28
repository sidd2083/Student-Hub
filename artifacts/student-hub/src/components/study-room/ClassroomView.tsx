import { memo } from "react";
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
  "from-blue-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-green-600",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-sky-600",
  "from-indigo-500 to-indigo-700",
  "from-teal-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
  "from-lime-500 to-green-500",
  "from-fuchsia-500 to-pink-500",
];

function avatarGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function fmtStudyMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

// ── Empty seat ────────────────────────────────────────────────────────────────
const EmptySeat = memo(function EmptySeat({ compact }: { compact: boolean }) {
  const sz = compact ? "w-9 h-9" : "w-12 h-12";
  return (
    <div className={`flex flex-col items-center gap-1.5 ${compact ? "w-14" : "w-20"}`}>
      <div className={`${sz} rounded-full border-2 border-dashed border-gray-200/70 dark:border-gray-700/70 flex items-center justify-center`}>
        <span className="text-gray-200 dark:text-gray-600 text-lg">·</span>
      </div>
      <div className={`h-2 ${compact ? "w-8" : "w-11"} bg-gray-100/70 dark:bg-gray-800/70 rounded-full`} />
      <div className="h-1.5 w-6 bg-gray-100/50 dark:bg-gray-800/50 rounded-full" />
    </div>
  );
});

// ── Occupied seat ─────────────────────────────────────────────────────────────
const OccupiedSeat = memo(function OccupiedSeat({
  p, isHost, onClick, compact,
}: {
  p: RoomParticipant;
  isHost: boolean;
  onClick?: () => void;
  compact: boolean;
}) {
  const initial  = p.name.charAt(0).toUpperCase();
  const gradient = avatarGradient(p.name);
  const sz       = compact ? "w-9 h-9 text-sm" : "w-12 h-12 text-base";
  const hasPhoto = !!p.photoURL;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.6, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6, y: 8 }}
      whileHover={{ scale: 1.06, y: -2 }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 ${compact ? "w-14" : "w-20"} cursor-pointer group focus:outline-none`}
    >
      <div className="relative">
        {/* Study time badge — floats above crown/avatar */}
        {p.studyMinsInRoom > 0 && (
          <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-20 ${isHost ? "-top-9" : "-top-6"}`}>
            <span className="inline-flex items-center bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow leading-none">
              {fmtStudyMins(p.studyMinsInRoom)}
            </span>
          </div>
        )}
        {isHost && (
          <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-yellow-400 drop-shadow-sm z-10" />
        )}
        <div className={`${sz} rounded-full flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-all relative overflow-hidden ${hasPhoto ? "" : `bg-gradient-to-br ${gradient}`}`}>
          {hasPhoto ? (
            <img
              src={p.photoURL!}
              alt={p.name}
              className="w-full h-full object-cover rounded-full"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <span className="relative z-10">{initial}</span>
          )}
        </div>
        {/* Online indicator */}
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900 shadow-sm" />
      </div>
      <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-semibold text-gray-700 dark:text-gray-200 truncate max-w-full leading-tight text-center group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors`}>
        {p.name.split(" ")[0]}
      </p>
      <p className={`${compact ? "text-[8px]" : "text-[9px]"} text-gray-400 dark:text-gray-500 -mt-0.5`}>
        G{p.grade}
      </p>
    </motion.button>
  );
});

// ── Bench (pair of seats + desk) ──────────────────────────────────────────────
const Bench = memo(function Bench({
  left, right, hostUid, onSelect, compact,
}: {
  left: RoomParticipant | null;
  right: RoomParticipant | null;
  hostUid: string;
  onSelect: (p: RoomParticipant) => void;
  compact: boolean;
}) {
  const deskW = compact ? "w-32" : "w-44 sm:w-52";
  const gap   = compact ? "gap-4" : "gap-6 sm:gap-8";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`flex items-end ${gap}`}>
        <AnimatePresence mode="popLayout">
          {left ? (
            <OccupiedSeat
              key={left.uid}
              p={left}
              isHost={left.uid === hostUid}
              onClick={() => onSelect(left)}
              compact={compact}
            />
          ) : (
            <EmptySeat key="el" compact={compact} />
          )}
          {right ? (
            <OccupiedSeat
              key={right.uid}
              p={right}
              isHost={right.uid === hostUid}
              onClick={() => onSelect(right)}
              compact={compact}
            />
          ) : (
            <EmptySeat key="er" compact={compact} />
          )}
        </AnimatePresence>
      </div>
      {/* Desk surface */}
      <div className={`relative ${deskW}`}>
        {/* Books / items on desk */}
        <div className="absolute -top-1 left-3 flex gap-1.5">
          <div className="w-3 h-1.5 bg-blue-400/50 dark:bg-blue-600/50 rounded-t-sm" />
          <div className="w-2.5 h-2 bg-red-400/40 dark:bg-red-600/40 rounded-t-sm" />
          <div className="w-2 h-1 bg-yellow-400/50 dark:bg-yellow-600/40 rounded-t-sm" />
        </div>
        <div className="h-3 bg-gradient-to-b from-amber-200 to-amber-300 dark:from-amber-700 dark:to-amber-800 rounded-t-xl shadow border border-amber-300/60 dark:border-amber-600/50" />
        <div className="h-1.5 bg-amber-400/80 dark:bg-amber-600/80 rounded-b" />
        <div className="flex justify-between px-5 mt-0.5">
          <div className="w-1.5 h-3 bg-amber-500/70 dark:bg-amber-700/70 rounded-b" />
          <div className="w-1.5 h-3 bg-amber-500/70 dark:bg-amber-700/70 rounded-b" />
        </div>
      </div>
    </div>
  );
});

// ── Main ClassroomView ────────────────────────────────────────────────────────
export const ClassroomView = memo(function ClassroomView({
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
  const isPaused   = roomStatus === "paused";

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: compact ? 300 : 400 }}>
      {/* Sky gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-50/80 via-slate-50/90 to-stone-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950" />

      {/* Subtle floor lines */}
      <div className="absolute inset-0 opacity-[0.025] dark:opacity-[0.015]" style={{
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 60px,#64748b 60px,#64748b 61px)",
        backgroundPosition: "0 200px",
      }} />

      {/* Classroom walls subtle border */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-200/40 dark:via-amber-800/30 to-transparent" />

      {/* Windows */}
      <div className="absolute top-3 left-3 w-12 h-16 rounded-t-lg border-2 border-sky-200/70 dark:border-sky-800/40 bg-sky-100/50 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-sky-200/60 dark:bg-sky-800/25 rounded-sm" />
        ))}
      </div>
      <div className="absolute top-3 right-3 w-12 h-16 rounded-t-lg border-2 border-sky-200/70 dark:border-sky-800/40 bg-sky-100/50 dark:bg-sky-900/20 grid grid-cols-2 gap-0.5 p-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-sky-200/60 dark:bg-sky-800/25 rounded-sm" />
        ))}
      </div>

      {/* Blackboard */}
      <div className="relative mx-auto max-w-sm px-4 pt-4">
        <div className="relative bg-emerald-800 dark:bg-emerald-900/90 rounded-xl shadow-lg border-[3px] border-amber-800/30 dark:border-amber-900/50 overflow-hidden">
          {/* Chalk marks texture */}
          <div className="absolute inset-0 opacity-[0.04]">
            <div className="absolute top-2 left-6 w-8 h-px bg-white rotate-12" />
            <div className="absolute top-4 right-10 w-5 h-px bg-white -rotate-6" />
            <div className="absolute bottom-3 left-12 w-6 h-px bg-white rotate-3" />
            <div className="absolute top-3 right-6 w-3 h-px bg-white rotate-45" />
          </div>

          {showTimer ? (
            <div className="relative flex flex-col items-center justify-center py-3 px-4">
              <div className="flex items-center gap-1.5 mb-1">
                {isStudying && <BookOpen className="w-3 h-3 text-emerald-300/70" />}
                {isBreak    && <Coffee   className="w-3 h-3 text-green-300/70" />}
                {isPaused   && <span className="text-[10px] text-orange-300/70">⏸</span>}
                <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-emerald-300/60">
                  {timerLabel ?? (isStudying ? "Studying" : isBreak ? "Break" : isPaused ? "Paused" : "Session")}
                </p>
              </div>
              <p className={`font-mono font-black tracking-tight leading-none ${compact ? "text-3xl" : "text-4xl sm:text-5xl"} ${
                isStudying ? "text-white" : isBreak ? "text-green-300" : isPaused ? "text-orange-300" : "text-emerald-200"
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
            {["bg-white/60","bg-yellow-200/60","bg-pink-200/60","bg-blue-200/60","bg-green-200/50"].map((c,i) => (
              <div key={i} className={`w-4 h-1 rounded-full ${c}`} />
            ))}
          </div>
        </div>

        {/* Teacher's desk */}
        <div className="flex justify-center mt-3 mb-5">
          <div className="relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-4">
              <div className="w-1.5 h-2 bg-blue-400/70 rounded-t-sm" />
              <div className="w-1 h-2 bg-red-400/60 rounded-t-sm" />
              <div className="w-1.5 h-1.5 bg-yellow-400/60 rounded-full" />
            </div>
            <div className="w-28 h-3 bg-gradient-to-b from-amber-300 to-amber-400 dark:from-amber-700 dark:to-amber-800 rounded-t shadow border border-amber-300/50 dark:border-amber-600/50" />
            <div className="w-28 h-1.5 bg-amber-500/80 dark:bg-amber-600/80 rounded-b" />
          </div>
        </div>
      </div>

      {/* Student rows */}
      <div className={`relative px-4 pb-6 ${compact ? "space-y-5" : "space-y-6 sm:space-y-7"}`}>
        {pairs.map((pair, row) => (
          <div key={row} className="flex justify-center">
            <Bench
              left={pair[0]}
              right={pair[1]}
              hostUid={hostUid}
              onSelect={(p) => onSelectStudent?.(p)}
              compact={compact}
            />
          </div>
        ))}
      </div>

      {/* Participant count badge */}
      <div className="absolute bottom-2 right-3">
        <p className="text-[10px] text-gray-400/60 dark:text-gray-500/60 font-medium">
          {participants.length} student{participants.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
});
