import { memo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoomParticipant, getLiveStudyMins } from "@/lib/studyRooms";
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
  "from-blue-500 to-blue-700",
  "from-violet-500 to-purple-700",
  "from-emerald-500 to-green-700",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-sky-600",
  "from-indigo-500 to-indigo-700",
  "from-teal-500 to-teal-700",
  "from-rose-500 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-pink-600",
];

function avatarGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function fmtMins(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h${r}m` : `${h}h`;
}

// ── Prayer flags — Nepal's iconic decorative flags ────────────────────────────
const PRAYER_FLAG_COLORS = [
  "bg-blue-500",
  "bg-white border border-gray-200",
  "bg-red-500",
  "bg-emerald-500",
  "bg-yellow-400",
  "bg-blue-500",
  "bg-white border border-gray-200",
  "bg-red-500",
  "bg-emerald-500",
  "bg-yellow-400",
  "bg-blue-500",
  "bg-white border border-gray-200",
];

const PrayerFlags = memo(function PrayerFlags({ compact }: { compact: boolean }) {
  const size = compact ? "w-3 h-4" : "w-4 h-5";
  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ top: compact ? 44 : 56 }}>
      <div className="relative mx-auto flex items-end justify-center" style={{ height: compact ? 16 : 20 }}>
        {/* String line */}
        <div className="absolute inset-x-4 top-0 h-px bg-amber-700/30" style={{ top: 0 }} />
        {/* Flags */}
        <div className="flex items-start gap-px" style={{ paddingTop: 0 }}>
          {PRAYER_FLAG_COLORS.map((c, i) => (
            <div
              key={i}
              className={`${size} ${c} opacity-75`}
              style={{
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                marginTop: i % 2 === 0 ? 0 : 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ── Himalayan mountains in window ─────────────────────────────────────────────
const MountainSilhouette = memo(function MountainSilhouette() {
  return (
    <svg
      viewBox="0 0 100 50"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
      style={{ bottom: 0, top: "auto" }}
    >
      {/* Snow peaks — white tips */}
      <polygon points="10,50 28,14 46,50" fill="rgba(200,220,255,0.55)" />
      <polygon points="25,50 50,4 75,50"  fill="rgba(180,210,250,0.65)" />
      <polygon points="54,50 76,20 100,50" fill="rgba(190,215,255,0.55)" />
      {/* Snow caps */}
      <polygon points="28,14 34,22 22,22" fill="rgba(255,255,255,0.75)" />
      <polygon points="50,4  58,16 42,16"  fill="rgba(255,255,255,0.85)" />
      <polygon points="76,20 82,28 70,28" fill="rgba(255,255,255,0.75)" />
      {/* Foothills */}
      <rect x="0" y="38" width="100" height="12" fill="rgba(120,160,200,0.3)" />
    </svg>
  );
});

// ── Window with Himalayan view ─────────────────────────────────────────────────
const Window = memo(function Window({ compact }: { compact: boolean }) {
  const w = compact ? "w-10 h-14" : "w-13 h-18";
  return (
    <div className="flex flex-col items-center">
      <div className="w-[110%] h-1 bg-amber-800/60 rounded-full mb-0" />
      <div className={`relative ${w} border-2 border-amber-800/40 bg-sky-200/80 rounded-t-sm overflow-hidden shadow-inner`}>
        {/* Sky gradient — Nepal's clear high-altitude sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/80 via-sky-300/60 to-sky-100/50" />
        {/* Himalayan mountains */}
        <MountainSilhouette />
        {/* Window pane dividers */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-amber-800/25" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-amber-800/25" />
        {/* Curtains — deep red like Nepal's traditional fabric */}
        <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-gradient-to-r from-red-800 via-red-700 to-transparent opacity-85" />
        <div className="absolute top-0 right-0 bottom-0 w-2.5 bg-gradient-to-l from-red-800 via-red-700 to-transparent opacity-85" />
        {/* Light glare */}
        <div className="absolute top-1 left-2 w-1.5 h-5 bg-white/30 rounded-full rotate-12" />
      </div>
      <div className="w-[115%] h-1.5 bg-amber-200/80 rounded-b border-b border-amber-400/30" />
    </div>
  );
});

// ── Empty seat ────────────────────────────────────────────────────────────────
const EmptySeat = memo(function EmptySeat({ compact }: { compact: boolean }) {
  const sz = compact ? "w-9 h-9" : "w-11 h-11";
  return (
    <div className={`flex flex-col items-center gap-1 ${compact ? "w-14" : "w-18"}`}>
      <div className={`${sz} rounded-full border-2 border-dashed border-amber-300/50 bg-amber-50/40 flex items-center justify-center`}>
        <span className="text-amber-300/60 text-lg">·</span>
      </div>
      <div className="h-1.5 w-8 bg-amber-200/40 rounded-full" />
    </div>
  );
});

// ── Occupied seat ─────────────────────────────────────────────────────────────
const OccupiedSeat = memo(function OccupiedSeat({
  p, isHost, onClick, compact, liveMins,
}: {
  p: RoomParticipant; isHost: boolean; onClick?: () => void; compact: boolean; liveMins: number;
}) {
  const initial  = p.name.charAt(0).toUpperCase();
  const gradient = avatarGradient(p.name);
  const sz       = compact ? "w-9 h-9 text-sm" : "w-11 h-11 text-base";
  const hasPhoto = !!p.photoURL;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: 8 }}
      whileHover={{ scale: 1.08, y: -3 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${compact ? "w-14" : "w-18"} cursor-pointer group focus:outline-none`}
    >
      <div className="relative">
        {liveMins > 0 && (
          <div className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-20 ${isHost ? "-top-9" : "-top-6"}`}>
            <span className="inline-flex items-center bg-emerald-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-sm leading-none">
              {fmtMins(liveMins)}
            </span>
          </div>
        )}
        {isHost && (
          <Crown className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-yellow-400 drop-shadow z-10" />
        )}
        <div className={`${sz} rounded-full flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white/60 group-hover:ring-white transition-all relative overflow-hidden ${hasPhoto ? "" : `bg-gradient-to-br ${gradient}`}`}>
          {hasPhoto ? (
            <img src={p.photoURL!} alt={p.name} className="w-full h-full object-cover rounded-full" loading="lazy"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span className="relative z-10 drop-shadow-sm">{initial}</span>
          )}
        </div>
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white shadow-sm" />
      </div>
      <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-semibold text-amber-900/80 truncate max-w-full leading-tight text-center group-hover:text-amber-800 transition-colors`}>
        {p.name.split(" ")[0]}
      </p>
    </motion.button>
  );
});

// ── Wooden desk bench ─────────────────────────────────────────────────────────
const Bench = memo(function Bench({
  left, right, hostUid, onSelect, compact,
}: {
  left: RoomParticipant | null;
  right: RoomParticipant | null;
  hostUid: string;
  onSelect: (p: RoomParticipant) => void;
  compact: boolean;
}) {
  const deskW = compact ? "w-36" : "w-48 sm:w-56";
  const gap   = compact ? "gap-4" : "gap-6 sm:gap-10";

  return (
    <div className="flex flex-col items-center" style={{ gap: 0 }}>
      <div className={`flex items-end ${gap} mb-1`}>
        <AnimatePresence mode="popLayout">
          {left
            ? <OccupiedSeat key={left.uid} p={left} isHost={left.uid === hostUid} onClick={() => onSelect(left)} compact={compact} liveMins={getLiveStudyMins(left)} />
            : <EmptySeat key="el" compact={compact} />}
          {right
            ? <OccupiedSeat key={right.uid} p={right} isHost={right.uid === hostUid} onClick={() => onSelect(right)} compact={compact} liveMins={getLiveStudyMins(right)} />
            : <EmptySeat key="er" compact={compact} />}
        </AnimatePresence>
      </div>

      <div className={`relative ${deskW}`}>
        <div className="absolute -top-1.5 left-4 flex gap-1.5 z-10">
          <div className="w-3.5 h-2 bg-blue-500/60 rounded-t-sm shadow-sm" />
          <div className="w-2.5 h-2.5 bg-red-400/55 rounded-t-sm shadow-sm" />
          <div className="w-2 h-1.5 bg-yellow-400/60 rounded-sm" />
          {Math.abs(left?.uid.charCodeAt(0) ?? 0) % 2 === 0 && (
            <div className="w-3 h-1.5 bg-green-400/50 rounded-t-sm shadow-sm" />
          )}
        </div>
        <div className="h-4 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 rounded-xl shadow-md border-t border-amber-200/80 border-x border-amber-500/30" />
        <div className="h-2 bg-gradient-to-b from-amber-600 to-amber-700 rounded-b-lg shadow-sm" />
        <div className="flex justify-between px-5 mt-0.5">
          <div className="w-1.5 h-3.5 bg-amber-700/80 rounded-b shadow-sm" />
          <div className="w-1.5 h-3.5 bg-amber-700/80 rounded-b shadow-sm" />
        </div>
        <div className="mx-6 h-px bg-amber-700/40 mt-1" />
      </div>
    </div>
  );
});

// ── Main ClassroomView ────────────────────────────────────────────────────────
export const ClassroomView = memo(function ClassroomView({
  participants, hostUid, onSelectStudent,
  timerDisplay, timerLabel, timerPhaseType, roomStatus, compact = false,
}: Props) {
  // Tick every second so getLiveStudyMins() keeps avatar badges in sync
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  // Stable callback — prevents Bench from re-rendering on each parent tick
  const handleSelect = useCallback((p: RoomParticipant) => {
    onSelectStudent?.(p);
  }, [onSelectStudent]);

  const pairs: (RoomParticipant | null)[][] = [];
  for (let i = 0; i < participants.length; i += 2) {
    pairs.push([participants[i] ?? null, participants[i + 1] ?? null]);
  }
  while (pairs.length < (compact ? 2 : 3)) pairs.push([null, null]);

  const isStudying = timerPhaseType === "study" && roomStatus === "active";
  const isBreak    = timerPhaseType === "break"  && roomStatus === "active";
  const isPaused   = roomStatus === "paused";
  const isWaiting  = roomStatus === "waiting";
  const showTimer  = !!timerDisplay && roomStatus && roomStatus !== "waiting" && roomStatus !== "finished";

  return (
    <div className="relative w-full overflow-hidden select-none" style={{ minHeight: compact ? 310 : 420 }}>

      {/* ── WALL BACKGROUND — warm Himalayan school room ─────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-stone-50 to-amber-100" />

      {/* Warm ceiling glow */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-100/70 to-transparent pointer-events-none" />

      {/* Subtle wainscoting */}
      <div className="absolute inset-x-0 bg-amber-200/50" style={{ top: "62%", height: 2 }} />
      <div className="absolute inset-x-0 bottom-0 bg-amber-100/40" style={{ top: "62%" }} />

      {/* ── CEILING LIGHT ────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <div className="w-1 h-3 bg-amber-700/40" />
        <div className="w-14 h-2.5 bg-gradient-to-b from-amber-100 to-amber-200 border border-amber-300/60 rounded-sm shadow" />
        <div className="w-20 h-1.5 bg-amber-50/80 border-b border-amber-200/40 rounded-b" />
      </div>
      <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(254,243,199,0.55) 0%, transparent 100%)" }} />

      {/* ── PRAYER FLAGS — Nepal's iconic lungta ──────────────────────────── */}
      <PrayerFlags compact={compact} />

      {/* ── WINDOWS with Himalayan peaks ─────────────────────────────────── */}
      <div className={`absolute ${compact ? "top-3 left-2" : "top-4 left-3"}`}>
        <Window compact={compact} />
      </div>
      <div className={`absolute ${compact ? "top-3 right-2" : "top-4 right-3"}`}>
        <Window compact={compact} />
      </div>

      {/* ── BLACKBOARD ───────────────────────────────────────────────────── */}
      <div className={`relative mx-auto ${compact ? "max-w-[220px] pt-3" : "max-w-xs pt-4"} px-2`}>
        <div className="bg-gradient-to-b from-amber-800 to-amber-900 rounded-sm p-1.5 shadow-xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,200,100,0.15), 0 4px 16px rgba(0,0,0,0.25)" }}>
          <div className="relative bg-gradient-to-br from-emerald-900 via-emerald-900 to-emerald-950 rounded-[2px] overflow-hidden"
            style={{ minHeight: compact ? 64 : 80 }}>

            {/* Chalk smudges texture */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
              {[
                { top:"15%", left:"8%",  w:40, rot:8 },
                { top:"25%", right:"12%",w:28, rot:-5 },
                { top:"60%", left:"20%", w:35, rot:3 },
                { top:"70%", right:"18%",w:22, rot:-8 },
              ].map((s, i) => (
                <div key={i} className="absolute h-px bg-white rounded-full"
                  style={{ top: s.top, left: s.left, right: s.right, width: s.w, transform: `rotate(${s.rot}deg)` }} />
              ))}
            </div>

            {/* Board content */}
            {showTimer ? (
              <div className="relative flex flex-col items-center justify-center py-3 px-3">
                <div className="flex items-center gap-1.5 mb-1">
                  {isStudying && <BookOpen className="w-3 h-3 text-emerald-300/70" />}
                  {isBreak    && <Coffee   className="w-3 h-3 text-green-300/70" />}
                  {isPaused   && <span className="text-[10px] text-orange-300/70">⏸</span>}
                  <p className="text-[9px] font-medium tracking-[0.2em] uppercase text-emerald-300/60">
                    {timerLabel ?? (isStudying ? "Studying" : isBreak ? "Break" : isPaused ? "Paused" : "Session")}
                  </p>
                </div>
                <p className={`font-mono font-black tracking-tight leading-none ${compact ? "text-3xl" : "text-4xl"} ${
                  isStudying ? "text-white" : isBreak ? "text-green-300" : isPaused ? "text-orange-300" : "text-emerald-200"
                }`} style={{ textShadow: "0 0 20px rgba(255,255,255,0.15)" }}>
                  {timerDisplay}
                </p>
              </div>
            ) : (
              <div className="py-4 px-3 text-center space-y-1">
                {/* Student Hub branding */}
                <p className="text-white/70 text-[11px] font-bold tracking-[0.18em] uppercase">
                  Student Hub
                </p>
                <p className="text-emerald-300/50 text-[9px] tracking-[0.1em]">
                  {isWaiting ? "⏳ waiting for host…" : "✦ focus · grow · achieve ✦"}
                </p>
                {/* Decorative chalk line */}
                <div className="mx-auto mt-1 h-px w-16 bg-white/20 rounded-full" />
              </div>
            )}
          </div>

          {/* Chalk tray */}
          <div className="flex gap-1 items-center justify-center pt-1 pb-0.5 px-1">
            {["bg-white/65","bg-yellow-200/65","bg-pink-200/55","bg-blue-200/60","bg-green-200/55","bg-orange-200/55"].map((c, i) => (
              <div key={i} className={`h-1 rounded-full ${c}`} style={{ width: compact ? 12 : 16 }} />
            ))}
          </div>
        </div>

        {/* Board shadow */}
        <div className="mx-4 h-2 bg-black/10 rounded-b-full blur-sm" />

        {/* ── TEACHER'S DESK ──────────────────────────────────────────────── */}
        <div className="flex justify-center mt-2.5 mb-5">
          <div className="relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-3">
              <div className="w-1.5 h-3 bg-blue-500/55 rounded-t-sm" />
              <div className="w-3 h-2 bg-red-500/50 rounded-sm" />
              <div className="w-2 h-3 bg-amber-400/60 rounded-t-sm" />
              <div className="w-1 h-3 bg-amber-500/50 rounded-t-sm" />
            </div>
            <div className={`${compact ? "w-28" : "w-36"} h-3.5 bg-gradient-to-b from-amber-600 to-amber-700 rounded-t-lg shadow-md border-t border-amber-400/40`} />
            <div className={`${compact ? "w-28" : "w-36"} h-2 bg-amber-800 rounded-b-sm`} />
          </div>
        </div>
      </div>

      {/* ── STUDENT ROWS — perspective depth effect ───────────────────────── */}
      {/* Each row is scaled slightly larger toward the viewer (front row) and  */}
      {/* smaller toward the board (back row), creating a natural classroom     */}
      {/* depth illusion without CSS 3D transforms that can cause blur on HiDPI.*/}
      <div className="relative px-3 pb-5" style={{ perspective: "none" }}>
        {pairs.map((pair, row) => {
          const totalRows = Math.max(pairs.length, 1);
          // Front row (highest index) → scale 1; back row (index 0) → smaller
          const depthFactor = row / Math.max(totalRows - 1, 1); // 0 = back, 1 = front
          const scale       = 0.82 + depthFactor * 0.18;        // 0.82 → 1.0
          const opacity     = 0.7 + depthFactor * 0.30;         // 0.70 → 1.0
          return (
            <div
              key={row}
              className="flex justify-center"
              style={{
                marginBottom: compact ? 12 : 16,
                transform: `scale(${scale})`,
                transformOrigin: "center bottom",
                opacity,
                // Rows closer to the board sit higher up (already handled by
                // document flow — row 0 renders first, nearest the blackboard)
              }}
            >
              <Bench
                left={pair[0]} right={pair[1]}
                hostUid={hostUid}
                onSelect={handleSelect}
                compact={compact}
              />
            </div>
          );
        })}
      </div>

      {/* ── FLOOR ─────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 h-6 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(180,130,80,0.18) 0%, transparent 100%)" }} />
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: 6 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute bottom-0 bg-amber-700/15"
            style={{ left: `${i * 12.5}%`, width: "11.5%", height: "100%", borderRight: "1px solid rgba(139,90,43,0.12)" }} />
        ))}
      </div>

      {/* Student count */}
      <div className="absolute bottom-1.5 right-2 pointer-events-none">
        <p className="text-[9px] text-amber-800/40 font-medium">
          {participants.length} student{participants.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
});
