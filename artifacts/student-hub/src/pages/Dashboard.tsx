import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import {
  collection, query, where, getDocs, doc, getDoc, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  BookOpen, BarChart2, FileText, CheckSquare,
  Timer, MessageCircle, Flame, Megaphone, X, Bookmark,
  ChevronDown,
} from "lucide-react";
import { SiteGuide } from "@/components/SiteGuide";

const sections = [
  { href: "/notes",      icon: BookOpen,      label: "Notes",              desc: "Study materials by subject",  color: "bg-blue-50 text-blue-600"    },
  { href: "/report",     icon: BarChart2,     label: "Report Card",        desc: "Track your study progress",   color: "bg-purple-50 text-purple-600" },
  { href: "/pyqs",       icon: FileText,      label: "Previous Questions", desc: "Past exam papers",            color: "bg-orange-50 text-orange-600" },
  { href: "/todo",       icon: CheckSquare,   label: "To-Do",              desc: "Track your tasks",            color: "bg-green-50 text-green-600"   },
  { href: "/pomodoro",   icon: Timer,         label: "Pomodoro Timer",     desc: "Focus and study",             color: "bg-red-50 text-red-600"       },
  { href: "/ai",         icon: MessageCircle, label: "Nep AI",             desc: "AI study assistant",          color: "bg-indigo-50 text-indigo-600" },
  { href: "/saved",      icon: Bookmark,      label: "Saved",              desc: "Your bookmarked items",       color: "bg-teal-50 text-teal-600"     },
];

interface Announcement { id: string; title: string; body: string; createdAt: string }
interface CustomBadge { id: string; text: string; emoji: string; color: string; createdAt: string }
interface AutoBadge { emoji: string; label: string; bg: string; shadow: string; type: "study" | "streak" }

const DISMISSED_KEY   = "studenthub_dismissed_announcements";
const STATS_CACHE_KEY = "sh_dash_v1";

interface StatsCache {
  uid: string;
  streak: number;
  studyMins: number;
  pendingTasks: number;
  customBadges: CustomBadge[];
  ts: number;
}

function readStatsCache(uid: string): StatsCache | null {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as StatsCache;
    if (d.uid !== uid) return null;
    if (Date.now() - d.ts > 10 * 60_000) return null; // 10-min TTL
    return d;
  } catch { return null; }
}

function writeStatsCache(uid: string, data: Omit<StatsCache, "uid" | "ts">) {
  try {
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ uid, ...data, ts: Date.now() }));
  } catch {}
}

const STUDY_TIERS = [
  { mins: 24000, emoji: "🏆", label: "Champion",    bg: "linear-gradient(135deg,#94a3b8,#e2e8f0,#94a3b8)", shadow: "0 4px 20px rgba(148,163,184,0.5)" },
  { mins: 12000, emoji: "🌟", label: "Master",      bg: "linear-gradient(135deg,#d97706,#fcd34d,#d97706)", shadow: "0 4px 20px rgba(217,119,6,0.5)"   },
  { mins: 6000,  emoji: "👑", label: "Legend",      bg: "linear-gradient(135deg,#b45309,#fbbf24,#b45309)", shadow: "0 4px 20px rgba(180,83,9,0.5)"    },
  { mins: 4500,  emoji: "💎", label: "Scholar",     bg: "linear-gradient(135deg,#6d28d9,#a78bfa,#6d28d9)", shadow: "0 4px 20px rgba(109,40,217,0.5)"  },
  { mins: 3000,  emoji: "🔥", label: "Achiever",    bg: "linear-gradient(135deg,#c2410c,#fb923c,#c2410c)", shadow: "0 4px 20px rgba(194,65,12,0.5)"   },
  { mins: 1500,  emoji: "⚡", label: "Explorer",    bg: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)", shadow: "0 4px 20px rgba(29,78,216,0.5)"   },
  { mins: 180,   emoji: "🌱", label: "Beginner",    bg: "linear-gradient(135deg,#15803d,#4ade80,#15803d)", shadow: "0 4px 20px rgba(21,128,61,0.5)"   },
];

const STREAK_TIERS = [
  { days: 100, emoji: "🦁", label: "Elite",         bg: "linear-gradient(135deg,#1e1b4b,#4338ca,#1e1b4b)", shadow: "0 4px 20px rgba(30,27,75,0.6)"   },
  { days: 60,  emoji: "⭐", label: "Legendary",     bg: "linear-gradient(135deg,#92400e,#fcd34d,#92400e)", shadow: "0 4px 20px rgba(146,64,14,0.5)"  },
  { days: 30,  emoji: "🚀", label: "Unstoppable",   bg: "linear-gradient(135deg,#5b21b6,#c4b5fd,#5b21b6)", shadow: "0 4px 20px rgba(91,33,182,0.5)"  },
  { days: 15,  emoji: "💪", label: "Dedicated",     bg: "linear-gradient(135deg,#991b1b,#f87171,#991b1b)", shadow: "0 4px 20px rgba(153,27,27,0.5)"  },
  { days: 5,   emoji: "🎯", label: "Consistent",    bg: "linear-gradient(135deg,#164e63,#67e8f9,#164e63)", shadow: "0 4px 20px rgba(22,78,99,0.5)"   },
];

function getHighestStudyBadge(mins: number) { return STUDY_TIERS.find(t => mins >= t.mins) ?? null; }
function getHighestStreakBadge(days: number) { return STREAK_TIERS.find(t => days >= t.days) ?? null; }

const SELECTED_BADGE_KEY = "studenthub_selected_leaderboard_badge";

function AchievementsCard({
  studyMins, streak, customBadges, uid,
}: { studyMins: number; streak: number; customBadges: CustomBadge[]; uid: string }) {
  const studyBadge  = getHighestStudyBadge(studyMins);
  const streakBadge = getHighestStreakBadge(streak);
  const autoBadges: AutoBadge[]  = [
    ...(studyBadge  ? [{ ...studyBadge,  type: "study"  as const }] : []),
    ...(streakBadge ? [{ ...streakBadge, type: "streak" as const }] : []),
  ];
  const total = autoBadges.length + customBadges.length;
  const storageKey = `${SELECTED_BADGE_KEY}_${uid}`;
  const [selectedKey, setSelectedKey] = useState<string>(() => localStorage.getItem(storageKey) || "");
  const [showPicker, setShowPicker] = useState(false);

  if (total === 0) return null;

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    localStorage.setItem(storageKey, key);
    setShowPicker(false);
  };

  const currentSelected = selectedKey
    ? ([...autoBadges, ...customBadges.map(b => ({ label: b.text, emoji: b.emoji, id: b.id }))] as { label?: string; text?: string; emoji: string; id?: string }[]).find(
        b => (b as { label?: string }).label === selectedKey || (b as { id?: string }).id === selectedKey
      )
    : null;

  return (
    <div className="mb-6 sm:mb-8 rounded-2xl border border-purple-100 shadow-sm">
      <div
        className="px-4 sm:px-5 py-3 flex items-center gap-2"
        style={{ background: "linear-gradient(135deg,#6d28d9 0%,#7c3aed 50%,#4f46e5 100%)" }}
      >
        <span className="text-lg leading-none">🏅</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Your Achievements</p>
          <p className="text-purple-200 text-xs leading-tight">
            {total} badge{total !== 1 ? "s" : ""} earned
          </p>
        </div>
        <span className="text-purple-200 text-xs font-medium">{total} / ∞</span>
      </div>

      <div className="bg-white px-4 sm:px-5 py-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {autoBadges.map(b => (
            <div
              key={b.label}
              style={{ background: b.bg, boxShadow: b.shadow }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-white select-none"
            >
              <span className="text-xl leading-none">{b.emoji}</span>
              <div>
                <p className="text-xs font-bold leading-tight">{b.label}</p>
                <p className="text-[10px] opacity-75 leading-tight">
                  {b.type === "study" ? "Study badge" : "Streak badge"}
                </p>
              </div>
            </div>
          ))}
          {customBadges.map(b => (
            <div
              key={b.id}
              style={{ background: b.color, boxShadow: `0 4px 20px ${b.color}55` }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-white select-none"
            >
              <span className="text-xl leading-none">{b.emoji}</span>
              <div>
                <p className="text-xs font-bold leading-tight">{b.text}</p>
                <p className="text-[10px] opacity-75 leading-tight">Special award</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-50 pt-3">
          <p className="text-xs text-gray-500 mb-2">Badge shown on leaderboard:</p>
          <div className="relative">
            <button
              onClick={() => setShowPicker(p => !p)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm hover:bg-gray-100 transition-all w-full sm:w-auto"
            >
              {selectedKey && currentSelected ? (
                <>
                  <span>{currentSelected.emoji}</span>
                  <span className="font-medium text-gray-800">
                    {(currentSelected as { label?: string }).label || (currentSelected as { text?: string }).text}
                  </span>
                </>
              ) : (
                <span className="text-gray-500">Choose badge…</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
            </button>

            {showPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 min-w-[200px] overflow-hidden">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => handleSelect("")}
                    className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-xl transition-all"
                  >
                    Auto (highest earned)
                  </button>
                  {autoBadges.map(b => (
                    <button
                      key={b.label}
                      onClick={() => handleSelect(b.label)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm hover:bg-gray-50 transition-all ${selectedKey === b.label ? "bg-gray-100" : ""}`}
                    >
                      <span>{b.emoji}</span>
                      <span className="font-medium text-gray-800">{b.label}</span>
                      {selectedKey === b.label && <span className="ml-auto text-blue-500 text-xs">✓</span>}
                    </button>
                  ))}
                  {customBadges.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleSelect(b.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm hover:bg-gray-50 transition-all ${selectedKey === b.id ? "bg-gray-100" : ""}`}
                    >
                      <span>{b.emoji}</span>
                      <span className="font-medium text-gray-800">{b.text}</span>
                      {selectedKey === b.id && <span className="ml-auto text-blue-500 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">Saved automatically in your browser</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile, user } = useAuth();

  // profile is seeded from localStorage by AuthContext on the very first render —
  // so profile?.uid is available synchronously. We use it to read the stats cache
  // before any Firestore request fires, giving instant display on repeat visits.
  const uid = user?.uid ?? profile?.uid;
  const [streak, setStreak]             = useState<number>(() => readStatsCache(uid ?? "")?.streak ?? 0);
  const [studyMins, setStudyMins]       = useState<number>(() => readStatsCache(uid ?? "")?.studyMins ?? 0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed]       = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const [customBadges, setCustomBadges] = useState<CustomBadge[]>(() => readStatsCache(uid ?? "")?.customBadges ?? []);
  const [pendingTasks, setPendingTasks] = useState<number>(() => readStatsCache(uid ?? "")?.pendingTasks ?? 0);
  // Mark loaded immediately if we have a cache — no skeleton needed on repeat visits
  const [statsLoaded, setStatsLoaded]   = useState<boolean>(() => !!readStatsCache(uid ?? ""));

  const dismissAnnouncement = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set([...prev, id]);
      try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const announcementsPromise = getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));

        if (uid) {
          const [userSnap, tasksSnap, announcementsSnap] = await Promise.all([
            getDoc(doc(db, "users", uid)),
            getDocs(query(collection(db, "tasks"), where("uid", "==", uid), where("completed", "==", false))),
            announcementsPromise,
          ]);

          if (!mounted) return;

          let newStreak = 0, newMins = 0, newBadges: CustomBadge[] = [];
          if (userSnap.exists()) {
            const d = userSnap.data();
            newMins   = d.totalStudyTime ?? 0;
            newStreak = d.streak ?? 0;
            newBadges = d.badges ?? [];
            setStudyMins(newMins);
            setStreak(newStreak);
            setCustomBadges(newBadges);
          }
          const newPending = tasksSnap.size;
          setPendingTasks(newPending);
          // Persist fresh stats so next visit is instant
          writeStatsCache(uid, { streak: newStreak, studyMins: newMins, pendingTasks: newPending, customBadges: newBadges });

          const list: Announcement[] = announcementsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
          setAnnouncements(list.slice(0, 3));
        } else {
          const announcementsSnap = await announcementsPromise;
          if (!mounted) return;
          const list: Announcement[] = announcementsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
          setAnnouncements(list.slice(0, 3));
        }
      } catch (e) {
        console.error("[Dashboard] Load failed:", e);
        if (mounted) setAnnouncements([]);
      } finally {
        if (mounted) setStatsLoaded(true);
      }
    })();
    return () => { mounted = false; };
  // uid is stable once auth resolves — using it instead of `user` prevents
  // re-runs when the Firebase User object reference changes but uid hasn't
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const fmtStudy = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id));

  const studyBadge  = getHighestStudyBadge(studyMins);
  const streakBadge = getHighestStreakBadge(streak);
  const hasBadges   = studyBadge || streakBadge || customBadges.length > 0;

  return (
    <>
      <Helmet><title>Dashboard — Student Hub</title></Helmet>
      <SiteGuide />
      <div className="p-4 sm:p-6 lg:p-8">

        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {greeting()}, {profile?.name?.split(" ")[0]}
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              Grade {profile?.grade}
            </span>
          </div>
          <p className="text-gray-500 text-sm">Ready to learn something new today?</p>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Pending Tasks</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{pendingTasks}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Study Time</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {!statsLoaded ? "—" : studyMins > 0 ? fmtStudy(studyMins) : "0m"}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
              <p className="text-xs sm:text-sm text-gray-500">Streak</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-orange-500">
              {streak}<span className="text-xs sm:text-base font-normal text-gray-400 ml-1">days</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-1 leading-tight">Study ≥5 min/day to keep streak</p>
          </div>
        </div>

        {statsLoaded && hasBadges && (
          <AchievementsCard
            studyMins={studyMins}
            streak={streak}
            customBadges={customBadges}
            uid={user?.uid ?? ""}
          />
        )}

        {statsLoaded && !hasBadges && (
          <div className="mb-6 sm:mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-0.5">🎯 Earn your first badge!</p>
            <p className="text-xs text-blue-600">Study for 3 hours with the Pomodoro timer to unlock the 🌱 Beginner badge.</p>
          </div>
        )}

        {visibleAnnouncements.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Megaphone className="w-4 h-4 text-gray-400" />
              <h2 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">Announcements</h2>
            </div>
            <div className="space-y-3">
              {visibleAnnouncements.map(a => (
                <div key={a.id} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 relative">
                  <button
                    onClick={() => dismissAnnouncement(a.id)}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-blue-200/60 transition-all"
                  >
                    <X className="w-4 h-4 text-blue-400" />
                  </button>
                  <p className="font-semibold text-blue-900 text-sm mb-1 pr-6">{a.title}</p>
                  <p className="text-blue-700 text-sm leading-relaxed">{a.body}</p>
                  <p className="text-blue-400 text-xs mt-2">
                    {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {sections.map(({ href, icon: Icon, label, desc, color }) => (
            <Link key={href} href={href}>
              <a className="block bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 ${color} rounded-xl flex items-center justify-center mb-3 sm:mb-4`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-0.5 sm:mb-1 leading-tight">{label}</h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-tight">{desc}</p>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
