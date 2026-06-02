import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { collection, getDocs, orderBy, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trophy, Flame, Clock, Sun, RefreshCw } from "lucide-react";
import { getNepaliDate, getNepaliYesterday } from "@/lib/nepaliDate";
import { gradeLabel } from "@/lib/gradeUtils";

const SELECTED_BADGE_KEY = "studenthub_selected_leaderboard_badge";

interface CustomBadge { id: string; text: string; emoji: string; color: string }

interface LeaderEntry {
  uid: string;
  name: string;
  grade: number;
  streak: number;
  totalStudyTime: number;
  todayStudyTime: number;
  lastActiveDate: string;
  lastMissionsCompletedDate?: string;
  role: string;
  badges?: CustomBadge[];
}

let leaderboardCache: { data: LeaderEntry[]; ts: number } | null = null;
const LEADER_CACHE_TTL = 5 * 60_000;

type SortKey = "totalStudyTime" | "streak" | "todayStudyTime";

function fmtTime(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function medal(i: number) {
  if (i === 0) return "bg-yellow-100 text-yellow-700";
  if (i === 1) return "bg-gray-100 text-gray-500";
  if (i === 2) return "bg-orange-100 text-orange-600";
  return "bg-white text-gray-500 border border-gray-100";
}

const STUDY_TIERS = [
  { mins: 24000, emoji: "🏆", label: "Champion",  bg: "linear-gradient(135deg,#94a3b8,#e2e8f0,#94a3b8)" },
  { mins: 12000, emoji: "🌟", label: "Master",    bg: "linear-gradient(135deg,#d97706,#fcd34d,#d97706)" },
  { mins: 6000,  emoji: "👑", label: "Legend",    bg: "linear-gradient(135deg,#b45309,#fbbf24,#b45309)" },
  { mins: 4500,  emoji: "💎", label: "Scholar",   bg: "linear-gradient(135deg,#6d28d9,#a78bfa,#6d28d9)" },
  { mins: 3000,  emoji: "🔥", label: "Achiever",  bg: "linear-gradient(135deg,#c2410c,#fb923c,#c2410c)" },
  { mins: 1500,  emoji: "⚡", label: "Explorer",  bg: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)" },
  { mins: 180,   emoji: "🌱", label: "Beginner",  bg: "linear-gradient(135deg,#15803d,#4ade80,#15803d)" },
];

const STREAK_TIERS = [
  { days: 100, emoji: "🦁", label: "Elite",        bg: "linear-gradient(135deg,#1e1b4b,#4338ca,#1e1b4b)" },
  { days: 60,  emoji: "⭐", label: "Legendary",    bg: "linear-gradient(135deg,#92400e,#fcd34d,#92400e)" },
  { days: 30,  emoji: "🚀", label: "Unstoppable",  bg: "linear-gradient(135deg,#5b21b6,#c4b5fd,#5b21b6)" },
  { days: 15,  emoji: "💪", label: "Dedicated",    bg: "linear-gradient(135deg,#991b1b,#f87171,#991b1b)" },
  { days: 5,   emoji: "🎯", label: "Consistent",   bg: "linear-gradient(135deg,#164e63,#67e8f9,#164e63)" },
];

function getTopBadge(entry: LeaderEntry) {
  return STUDY_TIERS.find(t => entry.totalStudyTime >= t.mins)
    ?? STREAK_TIERS.find(t => entry.streak >= t.days)
    ?? null;
}

function getMySelectedBadge(entry: LeaderEntry, myUid: string | undefined): { emoji: string; label: string; bg: string } | null {
  if (entry.uid !== myUid) return null;
  const key = localStorage.getItem(`${SELECTED_BADGE_KEY}_${myUid}`);
  if (!key) return null;

  const studyMatch = STUDY_TIERS.find(t => t.label === key);
  if (studyMatch) return studyMatch;
  const streakMatch = STREAK_TIERS.find(t => t.label === key);
  if (streakMatch) return streakMatch;

  if (entry.badges) {
    const custom = entry.badges.find(b => b.id === key);
    if (custom) return { emoji: custom.emoji, label: custom.text, bg: custom.color };
  }
  return null;
}

function RowBadge({ badge, custom }: {
  badge: { emoji: string; label: string; bg: string } | null;
  custom: CustomBadge | null;
}) {
  if (custom) {
    return (
      <span
        style={{ background: custom.color, boxShadow: `0 2px 8px ${custom.color}55` }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold leading-none flex-shrink-0"
      >
        {custom.emoji} {custom.text}
      </span>
    );
  }
  if (badge) {
    return (
      <span
        style={{ background: badge.bg }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-[10px] font-bold leading-none flex-shrink-0"
      >
        {badge.emoji} {badge.label}
      </span>
    );
  }
  return null;
}

// ─── Animated fire icon ───────────────────────────────────────────────────────
function FireBadge() {
  return (
    <span
      className="mission-fire-icon text-sm leading-none flex-shrink-0"
      title="Completed all daily missions today!"
    >
      🔥
    </span>
  );
}

function LeaderboardContent() {
  const { user } = useAuth();
  const [entries, setEntries]         = useState<LeaderEntry[]>(() => leaderboardCache?.data ?? []);
  const [loading, setLoading]         = useState(() => !leaderboardCache);
  const [sortBy, setSortBy]           = useState<SortKey>("totalStudyTime");
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => leaderboardCache ? new Date(leaderboardCache.ts) : null);

  const load = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && leaderboardCache && now - leaderboardCache.ts < LEADER_CACHE_TTL) return;
    if (!leaderboardCache) setLoading(true);
    try {
      const today     = getNepaliDate();
      const yesterday = getNepaliYesterday();
      const snap  = await getDocs(
        query(collection(db, "users"), orderBy("totalStudyTime", "desc"), limit(200)),
      );
      const list: LeaderEntry[] = snap.docs.map(d => {
        const data = d.data();
        const lastActive: string = data.lastActiveDate ?? "";
        const actualToday = lastActive === today ? (data.todayStudyTime ?? 0) : 0;
        const isStreakAlive = lastActive === today || lastActive === yesterday;
        const effectiveStreak = isStreakAlive ? (data.streak ?? 0) : 0;
        return {
          uid: d.id,
          name: data.name ?? "",
          grade: data.grade ?? 0,
          streak: effectiveStreak,
          totalStudyTime: data.totalStudyTime ?? 0,
          todayStudyTime: actualToday,
          lastActiveDate: lastActive,
          lastMissionsCompletedDate: data.lastMissionsCompletedDate ?? "",
          role: data.role ?? "user",
          badges: data.badges ?? [],
        };
      }).filter(e => e.name && typeof e.grade === "number" && e.role !== "admin");
      leaderboardCache = { data: list, ts: now };
      setEntries(list);
      setLastUpdated(new Date(now));
    } catch (e) {
      console.error("[Leaderboard] Load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always force-refresh on mount so study time from a just-left room
    // is visible immediately — cache is stale at that point.
    load(true);
    const id = setInterval(load, 60_000);

    // Also refresh when the tab comes back into focus
    const onVisible = () => { if (document.visibilityState === "visible") load(true); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const filtered = entries
    .filter(e => gradeFilter === "all" || e.grade === gradeFilter)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const myRank = filtered.findIndex(e => e.uid === user?.uid);

  const tabBtn = (key: SortKey, label: string, icon: React.ReactNode, active: string, inactive: string) => (
    <button
      onClick={() => setSortBy(key)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${sortBy === key ? active : inactive}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <>
      {/* Leaderboard glow — GPU-only animations (no box-shadow/text-shadow repaints) */}
      <style>{`
        @keyframes missionFireFloat {
          0%, 100% { transform: translateY(0) scale(1) rotate(-3deg); }
          33%       { transform: translateY(-4px) scale(1.2) rotate(3deg); }
          66%       { transform: translateY(-2px) scale(1.1) rotate(-1deg); }
        }
        /* Row uses static outline + background — zero animation cost, smooth scroll */
        .mission-glow-row {
          outline: 2px solid rgba(251,191,36,0.8);
          outline-offset: -1px;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 55%, #fff7ed 100%) !important;
          contain: layout style;
        }
        /* Name: static amber color, no animation */
        .mission-glow-row .mission-name {
          color: #b45309 !important;
          font-weight: 700 !important;
        }
        /* Fire: transform-only = cheap GPU composite */
        .mission-fire-icon {
          animation: missionFireFloat 1.8s ease-in-out infinite;
          will-change: transform;
          display: inline-block;
        }
      `}</style>

      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Leaderboard</h1>
            <p className="text-gray-500 text-sm">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {tabBtn("totalStudyTime", "All Time", <Clock className="w-3.5 h-3.5" />, "bg-blue-500 text-white shadow-sm", "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          {tabBtn("todayStudyTime", "Today",    <Sun   className="w-3.5 h-3.5" />, "bg-green-500 text-white shadow-sm", "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          {tabBtn("streak",         "Streak",   <Flame className="w-3.5 h-3.5" />, "bg-orange-500 text-white shadow-sm", "bg-gray-100 text-gray-600 hover:bg-gray-200")}
          <div className="w-px bg-gray-200" />
          {(["all", 9, 10, 11, 12, 13, 14, 15, 0] as (number | "all")[]).map(g => (
            <button key={g} onClick={() => setGradeFilter(g as number | "all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                gradeFilter === g ? "bg-indigo-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {g === "all" ? "All Grades" : gradeLabel(g as number)}
            </button>
          ))}
        </div>

        <div className="mb-3 text-xs text-gray-400 font-medium uppercase tracking-wide">
          {sortBy === "totalStudyTime" && "📚 All-time study time"}
          {sortBy === "todayStudyTime" && "☀️ Today's study time (NPT)"}
          {sortBy === "streak"         && "🔥 Study streak (days)"}
          {gradeFilter !== "all" && ` · ${gradeLabel(gradeFilter as number)} only`}
        </div>

        {/* Legend for mission glow */}
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
          <span className="mission-fire-icon text-base">🔥</span>
          Glowing names = completed all daily missions today
        </div>

        {!loading && myRank >= 0 && (
          <div className="mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
            You are ranked #{myRank + 1} {gradeFilter !== "all" ? `in ${gradeLabel(gradeFilter as number)}` : "overall"} 🎯
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No students here yet.</p>
            <p className="text-sm mt-1">Complete a Pomodoro session to appear!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry, i) => {
              const isMe     = entry.uid === user?.uid;
              const topBadge = isMe
                ? (getMySelectedBadge(entry, user?.uid) ?? getTopBadge(entry))
                : getTopBadge(entry);

              const custom = (!isMe && entry.badges && entry.badges.length > 0)
                ? entry.badges[0]
                : null;

              const hasBadge = topBadge || custom;

              const missionsDoneToday = entry.lastMissionsCompletedDate === getNepaliDate();

              return (
                <div
                  key={entry.uid}
                  className={`flex items-center gap-3 sm:gap-4 rounded-2xl border px-4 sm:px-5 py-3.5 transition-all ${
                    isMe ? "border-blue-200 bg-blue-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"
                  } ${missionsDoneToday ? "mission-glow-row" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${medal(i)}`}>
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {missionsDoneToday && <FireBadge />}
                      <p className={`font-semibold text-sm sm:text-base leading-tight ${
                        missionsDoneToday
                          ? "mission-name"
                          : isMe ? "text-blue-700" : "text-gray-900"
                      }`}>
                        {entry.name}
                        {isMe && <span className="text-xs font-normal text-blue-400 ml-1">(you)</span>}
                      </p>
                      {hasBadge && <RowBadge badge={topBadge} custom={custom} />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{gradeLabel(entry.grade)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right min-w-[60px]">
                    {sortBy === "totalStudyTime" && (
                      <>
                        <div className="flex items-center gap-1 text-blue-600 justify-end">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-sm font-bold">{fmtTime(entry.totalStudyTime)}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">all time</p>
                      </>
                    )}
                    {sortBy === "todayStudyTime" && (
                      <>
                        <div className="flex items-center gap-1 text-green-600 justify-end">
                          <Sun className="w-3.5 h-3.5" />
                          <span className="text-sm font-bold">{fmtTime(entry.todayStudyTime)}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">today</p>
                      </>
                    )}
                    {sortBy === "streak" && (
                      <>
                        <div className="flex items-center gap-1 text-orange-500 justify-end">
                          <Flame className="w-3.5 h-3.5" />
                          <span className="text-sm font-bold">{entry.streak}d</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">streak</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function Leaderboard() {
  return (
    <>
      <Helmet>
        <title>Leaderboard — Student Hub</title>
        <meta name="description" content="Top students on Student Hub ranked by study time and streak." />
      </Helmet>
      <SoftGate feature="the leaderboard">
        <LeaderboardContent />
      </SoftGate>
    </>
  );
}
