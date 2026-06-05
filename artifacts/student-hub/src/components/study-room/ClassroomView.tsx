import { memo, useCallback, useMemo } from "react";
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
  myUid?: string;
  myStudyMins?: number;
}

const AVATAR_COLORS = [
  "from-blue-400 to-blue-600",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-green-600",
  "from-orange-400 to-amber-500",
  "from-pink-400 to-rose-500",
  "from-cyan-400 to-sky-500",
  "from-indigo-400 to-indigo-600",
  "from-teal-400 to-teal-600",
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-500",
  "from-lime-400 to-green-500",
  "from-fuchsia-400 to-pink-500",
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

interface ThemeConfig {
  wallBg: string;
  wainscoteLine: string;
  wainscotePanel: string;
  floorColor: string;
  seatBorder: string;
  seatBg: string;
  nameColor: string;
  countColor: string;
  avatarRing: string;
  deskTop: string;
  deskSide: string;
  deskLeg: string;
}

function getThemeConfig(theme: RoomTheme): ThemeConfig {
  if (theme === "night") {
    return {
      wallBg:        "from-[#1a1208] via-[#221a0e] to-[#1a1208]",
      wainscoteLine: "bg-amber-900/40",
      wainscotePanel:"bg-[#140f08]/50",
      floorColor:    "rgba(40,25,10,0.50)",
      seatBorder:    "border-amber-800/40",
      seatBg:        "bg-amber-900/20",
      nameColor:     "text-amber-200/95 group-hover:text-amber-100",
      countColor:    "text-amber-500/50",
      avatarRing:    "ring-2 ring-amber-300/80",
      deskTop:       "from-amber-700/90 via-amber-600/80 to-amber-700/70",
      deskSide:      "from-amber-900 to-amber-950",
      deskLeg:       "bg-amber-900/90",
    };
  }
  return {
    wallBg:        "from-amber-50 via-stone-50 to-amber-100",
    wainscoteLine: "bg-amber-200/50",
    wainscotePanel:"bg-amber-100/40",
    floorColor:    "rgba(180,130,80,0.18)",
    seatBorder:    "border-amber-300/50",
    seatBg:        "bg-amber-50/40",
    nameColor:     "text-amber-900/85 group-hover:text-amber-800",
    countColor:    "text-amber-800/40",
    avatarRing:    "ring-2 ring-white/90",
    deskTop:       "from-amber-300 via-amber-400 to-amber-500",
    deskSide:      "from-amber-600 to-amber-700",
    deskLeg:       "bg-amber-700/80",
  };
}

// ── Prayer flags ───────────────────────────────────────────────────────────────
const PRAYER_FLAG_COLORS = [
  "bg-blue-500","bg-white border border-gray-200","bg-red-500","bg-emerald-500","bg-yellow-400",
  "bg-blue-500","bg-white border border-gray-200","bg-red-500","bg-emerald-500","bg-yellow-400",
  "bg-blue-500","bg-white border border-gray-200",
];

const PrayerFlags = memo(function PrayerFlags({ compact, theme }: { compact: boolean; theme: RoomTheme }) {
  const size    = compact ? "w-3 h-4" : "w-4 h-5";
  const opacity = theme === "night" ? "opacity-30" : "opacity-70";
  return (
    <div className="absolute inset-x-0 pointer-events-none" style={{ top: compact ? 44 : 56 }}>
      <div className="relative mx-auto flex items-end justify-center" style={{ height: compact ? 16 : 20 }}>
        <div className="absolute inset-x-4 top-0 h-px bg-amber-700/25" />
        <div className="flex items-start gap-px" style={{ paddingTop: 0 }}>
          {PRAYER_FLAG_COLORS.map((c, i) => (
            <div key={i} className={`${size} ${c} ${opacity}`}
              style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", marginTop: i % 2 === 0 ? 0 : 2 }} />
          ))}
        </div>
      </div>
    </div>
  );
});

// ── Classic window — Himalayan peaks ──────────────────────────────────────────
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

// ── Night window — deep sky, moon, stars ──────────────────────────────────────
const WindowNight = memo(function WindowNight({ compact }: { compact: boolean }) {
  const w = compact ? "w-10 h-14" : "w-13 h-18";
  return (
    <div className="flex flex-col items-center">
      <div className="w-[110%] h-1 bg-amber-900/60 rounded-full mb-0" />
      <div className={`relative ${w} border-2 border-amber-900/50 rounded-t-sm overflow-hidden shadow-inner`}
        style={{ background: "linear-gradient(to bottom, #060b1a 0%, #0f1535 50%, #0a0d22 100%)" }}>
        <div className="absolute w-5 h-5 rounded-full"
          style={{ top: "12%", right: "18%",
            background: "radial-gradient(circle at 40% 40%, #fef9e7 0%, #fef3c7 50%, #fbbf24 100%)",
            boxShadow: "0 0 6px 2px rgba(251,191,36,0.45)" }} />
        <div className="absolute w-4 h-4 rounded-full bg-transparent"
          style={{ top: "10%", right: "14%", boxShadow: "inset -2px 1px 0 rgba(6,11,26,0.9)" }} />
        {[[10,18],[30,8],[55,22],[78,12],[20,38],[48,44],[68,28],[42,32],[86,20],[15,52]].map(([l,t],i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{ left:`${l}%`, top:`${t}%`, width: i%4===0?2:1.5, height: i%4===0?2:1.5,
              opacity: 0.5+i*0.05, boxShadow: i%3===0?"0 0 2px rgba(255,255,255,0.5)":undefined }} />
        ))}
        <div className="absolute inset-x-0 top-1/2 h-px bg-amber-900/20" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-amber-900/20" />
        <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-gradient-to-r from-amber-950 via-amber-900/60 to-transparent" />
        <div className="absolute top-0 right-0 bottom-0 w-2.5 bg-gradient-to-l from-amber-950 via-amber-900/60 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-amber-900/20 to-transparent" />
      </div>
      <div className="w-[115%] h-1.5 bg-amber-900/70 rounded-b border-b border-amber-800/40" />
    </div>
  );
});

// ── Edison bulb — the hero of the night classroom ─────────────────────────────
const EdisonBulb = memo(function EdisonBulb({ compact }: { compact: boolean }) {
  const cw = compact ? 20 : 28;
  const ch = compact ? 26 : 36;
  return (
    <div className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ zIndex: 10, left: compact ? "18%" : "16%" }}>
      <div className="w-px bg-amber-700/60" style={{ height: compact ? 14 : 20 }} />
      <div className="w-3.5 h-2 bg-gradient-to-b from-slate-500 to-slate-600 rounded-sm" />
      <div className="w-2.5 h-1 bg-slate-400/60 rounded-sm" />
      <div className="relative flex items-center justify-center"
        style={{
          width: cw,
          height: ch,
          borderRadius: "50% 50% 42% 42% / 45% 45% 55% 55%",
          background: "radial-gradient(ellipse at 42% 38%, #fffbeb 0%, #fef3c7 25%, #fbbf24 55%, #d97706 78%, #92400e 100%)",
          boxShadow: `0 0 ${compact?14:20}px ${compact?8:14}px rgba(251,191,36,0.70), 0 0 ${compact?32:50}px ${compact?20:34}px rgba(245,158,11,0.35), 0 0 ${compact?60:90}px ${compact?36:56}px rgba(251,191,36,0.12)`,
        }}
      >
        <div style={{
          width: compact ? 7 : 10, height: compact ? 12 : 17,
          border: `${compact?1.5:2}px solid rgba(255,215,80,0.95)`,
          borderRadius: 3,
          boxShadow: "0 0 6px 2px rgba(255,220,80,0.85), inset 0 0 4px rgba(255,240,120,0.6)",
        }} />
      </div>
      <div style={{
        width: 0, height: 0,
        borderLeft: `${compact?5:7}px solid transparent`,
        borderRight: `${compact?5:7}px solid transparent`,
        borderTop: `${compact?6:8}px solid #78350f`,
      }} />
    </div>
  );
});

// ── Classic ceiling light ──────────────────────────────────────────────────────
const ClassicCeilingLight = memo(function ClassicCeilingLight() {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ zIndex: 5 }}>
      <div className="w-1 h-3 bg-amber-700/40" />
      <div className="w-14 h-2.5 bg-gradient-to-b from-amber-100 to-amber-200 border border-amber-300/60 rounded-sm shadow" />
      <div className="w-20 h-1.5 bg-amber-50/80 border-b border-amber-200/40 rounded-b" />
    </div>
  );
});

// ── Empty seat ────────────────────────────────────────────────────────────────
const EmptySeat = memo(function EmptySeat({ compact, tc }: { compact: boolean; tc: ThemeConfig }) {
  const sz = compact ? "w-9 h-9" : "w-11 h-11";
  return (
    <div className={`flex flex-col items-center gap-1 ${compact ? "w-14" : "w-18"}`}>
      <div className={`${sz} rounded-full border-2 border-dashed ${tc.seatBorder} ${tc.seatBg} flex items-center justify-center`}>
        <span className="text-amber-400/50 text-lg">·</span>
      </div>
      <div className="h-1.5 w-8 bg-amber-300/30 rounded-full" />
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
      whileHover={{ scale: 1.1, y: -4 }}
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
          <Crown className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-yellow-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)] z-10" />
        )}
        <div className={`${sz} rounded-full flex items-center justify-center text-white font-bold ${tc.avatarRing} group-hover:ring-white transition-all relative overflow-hidden ${hasPhoto ? "" : `bg-gradient-to-br ${gradient}`}`}
          style={{ boxShadow: "0 3px 14px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3)" }}>
          {hasPhoto ? (
            <img src={p.photoURL!} alt={p.name} className="w-full h-full object-cover rounded-full" loading="lazy"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span className="relative z-10 drop-shadow font-black">{initial}</span>
          )}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
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
  left, right, hostUid, onSelect, compact, tc, myUid, myStudyMins,
}: {
  left: RoomParticipant | null;
  right: RoomParticipant | null;
  hostUid: string;
  onSelect: (p: RoomParticipant) => void;
  compact: boolean;
  tc: ThemeConfig;
  myUid?: string;
  myStudyMins?: number;
}) {
  const deskW = compact ? "w-36" : "w-48 sm:w-56";
  const gap   = compact ? "gap-4" : "gap-6 sm:gap-10";

  // For the current user's avatar, use local wall-clock minutes (same source as the
  // side panel) so the badge matches. For other participants use getLiveStudyMins.
  const leftMins  = left  ? (left.uid  === myUid && myStudyMins !== undefined ? myStudyMins  : getLiveStudyMins(left))  : 0;
  const rightMins = right ? (right.uid === myUid && myStudyMins !== undefined ? myStudyMins : getLiveStudyMins(right)) : 0;

  return (
    <div className="flex flex-col items-center" style={{ gap: 0 }}>
      <div className={`flex items-end ${gap} mb-1`}>
        <AnimatePresence mode="popLayout">
          {left
            ? <OccupiedSeat key={left.uid}  p={left}  isHost={left.uid  === hostUid} onClick={() => onSelect(left)}  compact={compact} liveMins={leftMins}  tc={tc} />
            : <EmptySeat key="el" compact={compact} tc={tc} />}
          {right
            ? <OccupiedSeat key={right.uid} p={right} isHost={right.uid === hostUid} onClick={() => onSelect(right)} compact={compact} liveMins={rightMins} tc={tc} />
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
        <div className={`h-4 bg-gradient-to-b ${tc.deskTop} rounded-xl shadow-md border-t border-amber-200/30 border-x border-amber-600/20`} />
        <div className={`h-2 bg-gradient-to-b ${tc.deskSide} rounded-b-lg shadow-sm`} />
        <div className="flex justify-between px-5 mt-0.5">
          <div className={`w-1.5 h-3.5 ${tc.deskLeg} rounded-b shadow-sm`} />
          <div className={`w-1.5 h-3.5 ${tc.deskLeg} rounded-b shadow-sm`} />
        </div>
        <div className="mx-6 h-px bg-amber-700/30 mt-1" />
      </div>
    </div>
  );
});

// ── Main ClassroomView ────────────────────────────────────────────────────────
export const ClassroomView = memo(function ClassroomView({
  participants, hostUid, onSelectStudent,
  timerDisplay, timerLabel, timerPhaseType, roomStatus, compact = false,
  theme = "classic", myUid, myStudyMins,
}: Props) {
  // No internal tick needed — the parent (StudyRoomLive) already re-renders every
  // second via useRoomTimer(), passing a new timerDisplay prop each time. That
  // prop change drives badge + blackboard updates without a separate interval here.

  const handleSelect = useCallback((p: RoomParticipant) => {
    onSelectStudent?.(p);
  }, [onSelectStudent]);

  const tc = useMemo(() => getThemeConfig(theme), [theme]);

  const pairs = useMemo(() => {
    const p: (RoomParticipant | null)[][] = [];
    for (let i = 0; i < participants.length; i += 2) {
      p.push([participants[i] ?? null, participants[i + 1] ?? null]);
    }
    // Always minimum 2 benches — consistent on every screen size.
    // Same room → same layout on mobile and desktop.
    while (p.length < 2) p.push([null, null]);
    return p;
  }, [participants]);

  const isStudying = timerPhaseType === "study" && roomStatus === "active";
  const isBreak    = timerPhaseType === "break"  && roomStatus === "active";
  const isPaused   = roomStatus === "paused";
  const isWaiting  = roomStatus === "waiting";
  const showTimer  = !!timerDisplay && roomStatus && roomStatus !== "waiting" && roomStatus !== "finished";

  // Dynamic height: grows to accommodate all benches so every participant is visible.
  // overflow-x-hidden clips decorative side elements (windows) without cutting off rows.
  const minH = compact
    ? 300 + pairs.length * 90
    : 370 + pairs.length * 108;

  return (
    <div className="relative w-full overflow-x-hidden select-none" style={{ minHeight: minH }}>

      {/* ── WALL BACKGROUND ──────────────────────────────────────────────── */}
      <div className={`absolute inset-0 bg-gradient-to-b ${tc.wallBg}`} />

      {/* ── NIGHT: warm lamp glow radiates from the side bulb ───────────── */}
      {theme === "night" && (
        <>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 70% 85% at 17% 5%, rgba(251,191,36,0.30) 0%, rgba(245,158,11,0.14) 35%, rgba(180,83,9,0.06) 60%, transparent 80%)" }} />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 50% 45% at 17% 5%, rgba(255,220,100,0.16) 0%, transparent 50%)" }} />
        </>
      )}

      {/* ── CLASSIC: soft ceiling ambient ────────────────────────────────── */}
      {theme !== "night" && (
        <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(254,243,199,0.55) 0%, transparent 100%)" }} />
      )}

      {/* Wainscoting — fixed pixel from top so it stays below the blackboard area
           regardless of how many benches are rendered (not percentage-based). */}
      <div className={`absolute inset-x-0 ${tc.wainscoteLine}`} style={{ top: compact ? 168 : 218, height: 2 }} />
      <div className={`absolute inset-x-0 bottom-0 ${tc.wainscotePanel}`} style={{ top: compact ? 168 : 218 }} />

      {/* ── CEILING LIGHT ────────────────────────────────────────────────── */}
      {theme === "night"
        ? <EdisonBulb   compact={compact} />
        : <ClassicCeilingLight />}

      {/* ── PRAYER FLAGS ─────────────────────────────────────────────────── */}
      <PrayerFlags compact={compact} theme={theme} />

      {/* ── WINDOWS ──────────────────────────────────────────────────────── */}
      <div className={`absolute ${compact ? "top-3 left-2" : "top-4 left-3"}`}>
        {theme === "night" ? <WindowNight compact={compact} /> : <WindowClassic compact={compact} />}
      </div>
      <div className={`absolute ${compact ? "top-3 right-2" : "top-4 right-3"}`}>
        {theme === "night" ? <WindowNight compact={compact} /> : <WindowClassic compact={compact} />}
      </div>

      {/* ── BLACKBOARD ───────────────────────────────────────────────────── */}
      <div className={`relative mx-auto ${compact ? "max-w-[220px] pt-3" : "max-w-xs pt-4"} px-2`}>
        <div className={`${theme === "night" ? "bg-gradient-to-b from-amber-950 to-stone-900" : "bg-gradient-to-b from-amber-800 to-amber-900"} rounded-sm p-1.5 shadow-xl`}
          style={{ boxShadow: theme === "night" ? "inset 0 1px 0 rgba(255,180,50,0.18), 0 4px 20px rgba(0,0,0,0.50)" : "inset 0 1px 0 rgba(255,200,100,0.15), 0 4px 16px rgba(0,0,0,0.25)" }}>
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

        <div className="mx-4 h-2 bg-black/15 rounded-b-full blur-sm" />

        {/* ── TEACHER'S DESK ─────────────────────────────────────────── */}
        <div className="flex justify-center mt-2.5 mb-5">
          <div className="relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-3">
              <div className="w-1.5 h-3 bg-blue-500/55 rounded-t-sm" />
              <div className="w-3 h-2 bg-red-500/50 rounded-sm" />
              <div className="w-2 h-3 bg-amber-400/60 rounded-t-sm" />
              <div className="w-1 h-3 bg-amber-500/50 rounded-t-sm" />
            </div>
            <div className={`${compact ? "w-28" : "w-36"} h-3.5 bg-gradient-to-b ${tc.deskTop} rounded-t-lg shadow-md border-t border-amber-400/30`} />
            <div className={`${compact ? "w-28" : "w-36"} h-2 bg-gradient-to-b ${tc.deskSide} rounded-b-sm`} />
          </div>
        </div>
      </div>

      {/* ── STUDENT ROWS ─────────────────────────────────────────────── */}
      <div className="relative px-3 pb-5">
        {pairs.map((pair, row) => {
          const totalRows  = Math.max(pairs.length, 1);
          const depthFactor = row / Math.max(totalRows - 1, 1);
          const scale       = 0.84 + depthFactor * 0.16;
          const opacity     = 0.88 + depthFactor * 0.12;
          return (
            <div key={row} className="flex justify-center"
              style={{ marginBottom: compact ? 12 : 16, transform: `scale(${scale})`, transformOrigin: "center bottom", opacity }}>
              <Bench left={pair[0]} right={pair[1]} hostUid={hostUid} onSelect={handleSelect} compact={compact} tc={tc} myUid={myUid} myStudyMins={myStudyMins} />
            </div>
          );
        })}
      </div>

      {/* ── FLOOR ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 h-6 pointer-events-none"
        style={{ background: `linear-gradient(to top, ${tc.floorColor} 0%, transparent 100%)` }} />
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: 6 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute bottom-0 bg-amber-700/10"
            style={{ left: `${i * 12.5}%`, width: "11.5%", height: "100%", borderRight: "1px solid rgba(139,90,43,0.10)" }} />
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
