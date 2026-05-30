import { memo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoomParticipant, getLiveStudyMins, RoomTheme } from "@/lib/studyRooms";
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
  theme?: RoomTheme;
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

// ── Theme config ──────────────────────────────────────────────────────────────
interface ThemeConfig {
  wallBg: string;
  ceilingGlow: string;
  wainscoteLine: string;
  wainscotePanel: string;
  floorColor: string;
  seatBorder: string;
  seatBg: string;
  seatDot: string;
  nameColor: string;
  countColor: string;
  ceilingRadial: string;
}

function getThemeConfig(theme: RoomTheme): ThemeConfig {
  if (theme === "night") {
    return {
      wallBg:       "from-slate-900 via-slate-800 to-slate-900",
      ceilingGlow:  "from-amber-700/35",
      wainscoteLine:"bg-slate-700/50",
      wainscotePanel:"bg-slate-900/40",
      floorColor:   "rgba(60,40,20,0.35)",
      seatBorder:   "border-slate-600/40",
      seatBg:       "bg-slate-800/50",
      seatDot:      "·",
      nameColor:    "text-amber-200/90 group-hover:text-amber-100",
      countColor:   "text-amber-400/50",
      ceilingRadial:"radial-gradient(ellipse 70% 55% at 50% 0%, rgba(251,191,36,0.28) 0%, transparent 100%)",
    };
  }
  if (theme === "rain") {
    return {
      wallBg:       "from-slate-100 via-blue-50 to-slate-200",
      ceilingGlow:  "from-blue-100/70",
      wainscoteLine:"bg-blue-200/50",
      wainscotePanel:"bg-blue-50/30",
      floorColor:   "rgba(100,120,150,0.18)",
      seatBorder:   "border-slate-300/50",
      seatBg:       "bg-slate-100/50",
      seatDot:      "·",
      nameColor:    "text-slate-700/85 group-hover:text-slate-800",
      countColor:   "text-slate-500/40",
      ceilingRadial:"radial-gradient(ellipse 60% 60% at 50% 0%, rgba(219,234,254,0.60) 0%, transparent 100%)",
    };
  }
  return {
    wallBg:       "from-amber-50 via-stone-50 to-amber-100",
    ceilingGlow:  "from-amber-100/70",
    wainscoteLine:"bg-amber-200/50",
    wainscotePanel:"bg-amber-100/40",
    floorColor:   "rgba(180,130,80,0.18)",
    seatBorder:   "border-amber-300/50",
    seatBg:       "bg-amber-50/40",
    seatDot:      "·",
    nameColor:    "text-amber-900/80 group-hover:text-amber-800",
    countColor:   "text-amber-800/40",
    ceilingRadial:"radial-gradient(ellipse 60% 60% at 50% 0%, rgba(254,243,199,0.55) 0%, transparent 100%)",
  };
}

// ── Prayer flags — Nepal's iconic decorative flags ────────────────────────────
const PRAYER_FLAG_COLORS = [
  "bg-blue-500","bg-white border border-gray-200","bg-red-500","bg-emerald-500","bg-yellow-400",
  "bg-blue-500","bg-white border border-gray-200","bg-red-500","bg-emerald-500","bg-yellow-400",
  "bg-blue-500","bg-white border border-gray-200",
];

const PrayerFlags = memo(function PrayerFlags({ compact, theme }: { compact: boolean; theme: RoomTheme }) {
  const size = compact ? "w-3 h-4" : "w-4 h-5";
  const opacity = theme === "night" ? "opacity-40" : "opacity-75";
  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ top: compact ? 44 : 56 }}>
      <div className="relative mx-auto flex items-end justify-center" style={{ height: compact ? 16 : 20 }}>
        <div className="absolute inset-x-4 top-0 h-px bg-amber-700/30" style={{ top: 0 }} />
        <div className="flex items-start gap-px" style={{ paddingTop: 0 }}>
          {PRAYER_FLAG_COLORS.map((c, i) => (
            <div
              key={i}
              className={`${size} ${c} ${opacity}`}
              style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", marginTop: i % 2 === 0 ? 0 : 2 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

// ── Classic window — Himalayan peaks ─────────────────────────────────────────
const MountainSilhouette = memo(function MountainSilhouette() {
  return (
    <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full" preserveAspectRatio="none"
      style={{ bottom: 0, top: "auto" }}>
      <polygon points="10,50 28,14 46,50" fill="rgba(200,220,255,0.55)" />
      <polygon points="25,50 50,4 75,50"  fill="rgba(180,210,250,0.65)" />
      <polygon points="54,50 76,20 100,50" fill="rgba(190,215,255,0.55)" />
      <polygon points="28,14 34,22 22,22" fill="rgba(255,255,255,0.75)" />
      <polygon points="50,4  58,16 42,16"  fill="rgba(255,255,255,0.85)" />
      <polygon points="76,20 82,28 70,28" fill="rgba(255,255,255,0.75)" />
      <rect x="0" y="38" width="100" height="12" fill="rgba(120,160,200,0.3)" />
    </svg>
  );
});

const WindowClassic = memo(function WindowClassic({ compact }: { compact: boolean }) {
  const w = compact ? "w-10 h-14" : "w-13 h-18";
  return (
    <div className="flex flex-col items-center">
      <div className="w-[110%] h-1 bg-amber-800/60 rounded-full mb-0" />
      <div className={`relative ${w} border-2 border-amber-800/40 bg-sky-200/80 rounded-t-sm overflow-hidden shadow-inner`}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/80 via-sky-300/60 to-sky-100/50" />
        <MountainSilhouette />
        <div className="absolute inset-x-0 top-1/2 h-px bg-amber-800/25" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-amber-800/25" />
        <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-gradient-to-r from-red-800 via-red-700 to-transparent opacity-85" />
        <div className="absolute top-0 right-0 bottom-0 w-2.5 bg-gradient-to-l from-red-800 via-red-700 to-transparent opacity-85" />
        <div className="absolute top-1 left-2 w-1.5 h-5 bg-white/30 rounded-full rotate-12" />
      </div>
      <div className="w-[115%] h-1.5 bg-amber-200/80 rounded-b border-b border-amber-400/30" />
    </div>
  );
});

// ── Night window — moon and stars ─────────────────────────────────────────────
const WindowNight = memo(function WindowNight({ compact }: { compact: boolean }) {
  const w = compact ? "w-10 h-14" : "w-13 h-18";
  return (
    <div className="flex flex-col items-center">
      <div className="w-[110%] h-1 bg-slate-600/60 rounded-full mb-0" />
      <div className={`relative ${w} border-2 border-slate-600/50 rounded-t-sm overflow-hidden shadow-inner`}
        style={{ background: "linear-gradient(to bottom, #0f1629 0%, #1a1040 60%, #0d1020 100%)" }}>
        <div className="absolute w-4 h-4 rounded-full bg-amber-50/85 shadow-[0_0_10px_3px_rgba(251,191,36,0.4)]"
          style={{ top: "14%", right: "22%" }} />
        <div className="absolute w-3 h-3 rounded-full bg-amber-100/20"
          style={{ top: "10%", right: "18%", boxShadow: "inset -2px 1px 0 rgba(0,0,0,0.4)" }} />
        {[[12,20],[38,12],[62,28],[80,16],[22,42],[54,45],[72,22],[45,35]].map(([l,t],i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{ left:`${l}%`, top:`${t}%`, width: i%3===0?2:1, height: i%3===0?2:1, opacity: 0.6+i*0.04 }} />
        ))}
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-500/20" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-500/20" />
        <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-gradient-to-r from-slate-800 via-slate-700/60 to-transparent opacity-90" />
        <div className="absolute top-0 right-0 bottom-0 w-2.5 bg-gradient-to-l from-slate-800 via-slate-700/60 to-transparent opacity-90" />
        <div className="absolute bottom-0 inset-x-0 h-5 bg-gradient-to-t from-amber-900/15 to-transparent" />
      </div>
      <div className="w-[115%] h-1.5 bg-slate-700/80 rounded-b border-b border-slate-500/30" />
    </div>
  );
});

// ── Rain window — grey sky and raindrops ──────────────────────────────────────
const WindowRain = memo(function WindowRain({ compact }: { compact: boolean }) {
  const w = compact ? "w-10 h-14" : "w-13 h-18";
  const drops: [number,number][] = [[10,0],[25,18],[42,5],[58,22],[74,10],[15,38],[32,32],[50,42],[68,28],[82,15]];
  return (
    <div className="flex flex-col items-center">
      <div className="w-[110%] h-1 bg-slate-500/50 rounded-full mb-0" />
      <div className={`relative ${w} border-2 border-slate-400/40 rounded-t-sm overflow-hidden shadow-inner`}
        style={{ background: "linear-gradient(to bottom, #94a3b8 0%, #cbd5e1 50%, #e2e8f0 100%)" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-400/30 to-slate-200/10" />
        {drops.map(([l,t],i) => (
          <div key={i} className="absolute bg-blue-300/55 rounded-full"
            style={{ left:`${l}%`, top:`${t}%`, width: 1, height: compact?6:9, transform:"rotate(12deg)" }} />
        ))}
        <div className="absolute top-2 left-5 w-1.5 h-2.5 bg-blue-200/50 rounded-full" />
        <div className="absolute top-5 right-4 w-1 h-2 bg-blue-100/40 rounded-full" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-500/20" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-500/20" />
        <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-gradient-to-r from-blue-900/50 via-blue-800/30 to-transparent opacity-70" />
        <div className="absolute top-0 right-0 bottom-0 w-2.5 bg-gradient-to-l from-blue-900/50 via-blue-800/30 to-transparent opacity-70" />
      </div>
      <div className="w-[115%] h-1.5 bg-blue-100/80 rounded-b border-b border-blue-200/30" />
    </div>
  );
});

// ── Themed window router ──────────────────────────────────────────────────────
const Window = memo(function Window({ compact, theme }: { compact: boolean; theme: RoomTheme }) {
  if (theme === "night") return <WindowNight compact={compact} />;
  if (theme === "rain")  return <WindowRain  compact={compact} />;
  return <WindowClassic compact={compact} />;
});

// ── Empty seat ────────────────────────────────────────────────────────────────
const EmptySeat = memo(function EmptySeat({ compact, tc }: { compact: boolean; tc: ThemeConfig }) {
  const sz = compact ? "w-9 h-9" : "w-11 h-11";
  return (
    <div className={`flex flex-col items-center gap-1 ${compact ? "w-14" : "w-18"}`}>
      <div className={`${sz} rounded-full border-2 border-dashed ${tc.seatBorder} ${tc.seatBg} flex items-center justify-center`}>
        <span className="text-amber-300/60 text-lg">·</span>
      </div>
      <div className="h-1.5 w-8 bg-amber-200/40 rounded-full" />
    </div>
  );
});

// ── Occupied seat ─────────────────────────────────────────────────────────────
const OccupiedSeat = memo(function OccupiedSeat({
  p, isHost, onClick, compact, liveMins, tc,
}: {
  p: RoomParticipant; isHost: boolean; onClick?: () => void; compact: boolean; liveMins: number; tc: ThemeConfig;
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
      <p className={`${compact ? "text-[9px]" : "text-[10px]"} font-semibold truncate max-w-full leading-tight text-center transition-colors ${tc.nameColor}`}>
        {p.name.split(" ")[0]}
      </p>
    </motion.button>
  );
});

// ── Wooden desk bench ─────────────────────────────────────────────────────────
const Bench = memo(function Bench({
  left, right, hostUid, onSelect, compact, tc,
}: {
  left: RoomParticipant | null;
  right: RoomParticipant | null;
  hostUid: string;
  onSelect: (p: RoomParticipant) => void;
  compact: boolean;
  tc: ThemeConfig;
}) {
  const deskW = compact ? "w-36" : "w-48 sm:w-56";
  const gap   = compact ? "gap-4" : "gap-6 sm:gap-10";

  return (
    <div className="flex flex-col items-center" style={{ gap: 0 }}>
      <div className={`flex items-end ${gap} mb-1`}>
        <AnimatePresence mode="popLayout">
          {left
            ? <OccupiedSeat key={left.uid} p={left} isHost={left.uid === hostUid} onClick={() => onSelect(left)} compact={compact} liveMins={getLiveStudyMins(left)} tc={tc} />
            : <EmptySeat key="el" compact={compact} tc={tc} />}
          {right
            ? <OccupiedSeat key={right.uid} p={right} isHost={right.uid === hostUid} onClick={() => onSelect(right)} compact={compact} liveMins={getLiveStudyMins(right)} tc={tc} />
            : <EmptySeat key="er" compact={compact} tc={tc} />}
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
  theme = "classic",
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const handleSelect = useCallback((p: RoomParticipant) => {
    onSelectStudent?.(p);
  }, [onSelectStudent]);

  const tc = getThemeConfig(theme);

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

      {/* ── WALL BACKGROUND ──────────────────────────────────────────────── */}
      <div className={`absolute inset-0 bg-gradient-to-b ${tc.wallBg}`} />

      {/* Ceiling glow */}
      <div className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${tc.ceilingGlow} to-transparent pointer-events-none`} />

      {/* Wainscoting */}
      <div className={`absolute inset-x-0 ${tc.wainscoteLine}`} style={{ top: "62%", height: 2 }} />
      <div className={`absolute inset-x-0 bottom-0 ${tc.wainscotePanel}`} style={{ top: "62%" }} />

      {/* ── CEILING LIGHT ────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <div className={`w-1 h-3 ${theme === "night" ? "bg-slate-600/40" : "bg-amber-700/40"}`} />
        <div className={`w-14 h-2.5 ${theme === "night" ? "bg-gradient-to-b from-amber-800/80 to-amber-700/60" : "bg-gradient-to-b from-amber-100 to-amber-200"} border ${theme === "night" ? "border-amber-700/40" : "border-amber-300/60"} rounded-sm shadow`} />
        <div className={`w-20 h-1.5 ${theme === "night" ? "bg-amber-900/60" : "bg-amber-50/80"} border-b ${theme === "night" ? "border-amber-700/30" : "border-amber-200/40"} rounded-b`} />
      </div>

      {/* Night: warm lamp glow radiates from ceiling */}
      {theme === "night" && (
        <div className="absolute inset-x-0 top-0 h-36 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 55% 55% at 50% 0%, rgba(251,191,36,0.22) 0%, transparent 100%)" }} />
      )}

      {/* Classic/Rain: radial ceiling ambient */}
      {theme !== "night" && (
        <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
          style={{ background: tc.ceilingRadial }} />
      )}

      {/* ── PRAYER FLAGS ────────────────────────────────────────────────── */}
      <PrayerFlags compact={compact} theme={theme} />

      {/* ── WINDOWS ──────────────────────────────────────────────────────── */}
      <div className={`absolute ${compact ? "top-3 left-2" : "top-4 left-3"}`}>
        <Window compact={compact} theme={theme} />
      </div>
      <div className={`absolute ${compact ? "top-3 right-2" : "top-4 right-3"}`}>
        <Window compact={compact} theme={theme} />
      </div>

      {/* ── BLACKBOARD ───────────────────────────────────────────────────── */}
      <div className={`relative mx-auto ${compact ? "max-w-[220px] pt-3" : "max-w-xs pt-4"} px-2`}>
        <div className={`${theme === "night" ? "bg-gradient-to-b from-gray-800 to-gray-900" : "bg-gradient-to-b from-amber-800 to-amber-900"} rounded-sm p-1.5 shadow-xl`}
          style={{ boxShadow: "inset 0 1px 0 rgba(255,200,100,0.15), 0 4px 16px rgba(0,0,0,0.25)" }}>
          <div className="relative bg-gradient-to-br from-emerald-900 via-emerald-900 to-emerald-950 rounded-[2px] overflow-hidden"
            style={{ minHeight: compact ? 64 : 80 }}>

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
                <p className="text-white/70 text-[11px] font-bold tracking-[0.18em] uppercase">Student Hub</p>
                <p className="text-emerald-300/50 text-[9px] tracking-[0.1em]">
                  {isWaiting ? "⏳ waiting for host…" : "✦ focus · grow · achieve ✦"}
                </p>
                <div className="mx-auto mt-1 h-px w-16 bg-white/20 rounded-full" />
              </div>
            )}
          </div>

          <div className="flex gap-1 items-center justify-center pt-1 pb-0.5 px-1">
            {["bg-white/65","bg-yellow-200/65","bg-pink-200/55","bg-blue-200/60","bg-green-200/55","bg-orange-200/55"].map((c, i) => (
              <div key={i} className={`h-1 rounded-full ${c}`} style={{ width: compact ? 12 : 16 }} />
            ))}
          </div>
        </div>

        <div className="mx-4 h-2 bg-black/10 rounded-b-full blur-sm" />

        {/* ── TEACHER'S DESK ─────────────────────────────────────────── */}
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

      {/* ── STUDENT ROWS ─────────────────────────────────────────────── */}
      <div className="relative px-3 pb-5" style={{ perspective: "none" }}>
        {pairs.map((pair, row) => {
          const totalRows = Math.max(pairs.length, 1);
          const depthFactor = row / Math.max(totalRows - 1, 1);
          const scale       = 0.82 + depthFactor * 0.18;
          const opacity     = 0.7 + depthFactor * 0.30;
          return (
            <div
              key={row}
              className="flex justify-center"
              style={{ marginBottom: compact ? 12 : 16, transform: `scale(${scale})`, transformOrigin: "center bottom", opacity }}
            >
              <Bench
                left={pair[0]} right={pair[1]}
                hostUid={hostUid}
                onSelect={handleSelect}
                compact={compact}
                tc={tc}
              />
            </div>
          );
        })}
      </div>

      {/* ── FLOOR ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 h-6 pointer-events-none"
        style={{ background: `linear-gradient(to top, ${tc.floorColor} 0%, transparent 100%)` }} />
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: 6 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute bottom-0 bg-amber-700/15"
            style={{ left: `${i * 12.5}%`, width: "11.5%", height: "100%", borderRight: "1px solid rgba(139,90,43,0.12)" }} />
        ))}
      </div>

      {/* Student count */}
      <div className="absolute bottom-1.5 right-2 pointer-events-none">
        <p className={`text-[9px] font-medium ${tc.countColor}`}>
          {participants.length} student{participants.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
});
