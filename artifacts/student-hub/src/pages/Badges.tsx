import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Link } from "wouter";
import { ArrowLeft, Lock } from "lucide-react";

const STUDY_TIERS = [
  { mins: 24000, emoji: "🏆", label: "Champion",   bg: "linear-gradient(135deg,#94a3b8,#e2e8f0,#94a3b8)", shadow: "0 4px 20px rgba(148,163,184,0.5)", hours: 400,  desc: "400 total study hours" },
  { mins: 12000, emoji: "🌟", label: "Master",     bg: "linear-gradient(135deg,#d97706,#fcd34d,#d97706)", shadow: "0 4px 20px rgba(217,119,6,0.5)",   hours: 200,  desc: "200 total study hours" },
  { mins: 6000,  emoji: "👑", label: "Legend",     bg: "linear-gradient(135deg,#b45309,#fbbf24,#b45309)", shadow: "0 4px 20px rgba(180,83,9,0.5)",    hours: 100,  desc: "100 total study hours" },
  { mins: 4500,  emoji: "💎", label: "Scholar",    bg: "linear-gradient(135deg,#6d28d9,#a78bfa,#6d28d9)", shadow: "0 4px 20px rgba(109,40,217,0.5)",  hours: 75,   desc: "75 total study hours"  },
  { mins: 3000,  emoji: "🔥", label: "Achiever",   bg: "linear-gradient(135deg,#c2410c,#fb923c,#c2410c)", shadow: "0 4px 20px rgba(194,65,12,0.5)",   hours: 50,   desc: "50 total study hours"  },
  { mins: 1500,  emoji: "⚡", label: "Explorer",   bg: "linear-gradient(135deg,#1d4ed8,#60a5fa,#1d4ed8)", shadow: "0 4px 20px rgba(29,78,216,0.5)",   hours: 25,   desc: "25 total study hours"  },
  { mins: 180,   emoji: "🌱", label: "Beginner",   bg: "linear-gradient(135deg,#15803d,#4ade80,#15803d)", shadow: "0 4px 20px rgba(21,128,61,0.5)",   hours: 3,    desc: "3 total study hours"   },
];

const STREAK_TIERS = [
  { days: 100, emoji: "🦁", label: "Elite",        bg: "linear-gradient(135deg,#1e1b4b,#4338ca,#1e1b4b)", shadow: "0 4px 20px rgba(30,27,75,0.6)",  desc: "100-day study streak" },
  { days: 60,  emoji: "⭐", label: "Legendary",    bg: "linear-gradient(135deg,#92400e,#fcd34d,#92400e)", shadow: "0 4px 20px rgba(146,64,14,0.5)", desc: "60-day study streak"  },
  { days: 30,  emoji: "🚀", label: "Unstoppable",  bg: "linear-gradient(135deg,#5b21b6,#c4b5fd,#5b21b6)", shadow: "0 4px 20px rgba(91,33,182,0.5)", desc: "30-day study streak"  },
  { days: 15,  emoji: "💪", label: "Dedicated",    bg: "linear-gradient(135deg,#991b1b,#f87171,#991b1b)", shadow: "0 4px 20px rgba(153,27,27,0.5)", desc: "15-day study streak"  },
  { days: 5,   emoji: "🎯", label: "Consistent",   bg: "linear-gradient(135deg,#164e63,#67e8f9,#164e63)", shadow: "0 4px 20px rgba(22,78,99,0.5)",  desc: "5-day study streak"   },
];

function fmtMins(mins: number) {
  return mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`;
}

function BadgeCard({
  emoji, label, bg, shadow, requirement, earned, next,
}: {
  emoji: string;
  label: string;
  bg: string;
  shadow: string;
  requirement: string;
  earned: boolean;
  next?: { current: number; target: number; unit: string };
}) {
  return (
    <div className={`relative rounded-2xl border transition-all ${earned ? "border-transparent" : "border-gray-100"}`}>
      <div
        className={`flex items-center gap-4 px-4 py-4 rounded-2xl ${earned ? "" : "opacity-40 grayscale"}`}
        style={earned ? { background: bg, boxShadow: shadow } : { background: "#f9fafb" }}
      >
        <span className="text-3xl leading-none flex-shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm leading-tight ${earned ? "text-white" : "text-gray-700"}`}>{label}</p>
          <p className={`text-xs mt-0.5 leading-snug ${earned ? "text-white/75" : "text-gray-400"}`}>{requirement}</p>
          {!earned && next && (
            <div className="mt-2">
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((next.current / next.target) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {next.unit === "hours"
                  ? `${Math.floor(next.current / 60)}h / ${Math.floor(next.target / 60)}h`
                  : `${next.current} / ${next.target} days`}
              </p>
            </div>
          )}
        </div>
        {earned ? (
          <span className="text-white/90 text-lg flex-shrink-0">✓</span>
        ) : (
          <Lock className="w-4 h-4 text-gray-300 flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

export default function Badges() {
  const { user } = useAuth();
  const [studyMins, setStudyMins] = useState(0);
  const [streak, setStreak]       = useState(0);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    getDoc(doc(db, "users", user.uid))
      .then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          setStudyMins(d.totalStudyTime ?? 0);
          setStreak(d.streak ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const earnedStudy  = STUDY_TIERS.filter(t => studyMins >= t.mins);
  const earnedStreak = STREAK_TIERS.filter(t => streak >= t.days);
  const totalEarned  = earnedStudy.length + earnedStreak.length;

  const nextStudy  = STUDY_TIERS.slice().reverse().find(t => studyMins < t.mins);
  const nextStreak = STREAK_TIERS.slice().reverse().find(t => streak < t.days);

  return (
    <>
      <Helmet>
        <title>Badges — Student Hub</title>
        <meta name="description" content="See all badges you can earn on Student Hub by studying and building streaks." />
      </Helmet>

      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard"
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Badges</h1>
            <p className="text-gray-500 text-sm">
              {user
                ? loading
                  ? "Loading your progress…"
                  : `${totalEarned} earned · keep studying to unlock more!`
                : "Login to track your badge progress"}
            </p>
          </div>
        </div>

        {user && !loading && totalEarned > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl">
            <p className="text-sm font-semibold text-purple-800 mb-1">🎉 You've earned {totalEarned} badge{totalEarned !== 1 ? "s" : ""}!</p>
            <p className="text-xs text-purple-600">Keep using the Pomodoro timer daily to unlock more.</p>
          </div>
        )}

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-gray-900">📚 Study Time Badges</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Earned by total study time logged with the Pomodoro timer</p>
          <div className="space-y-3">
            {STUDY_TIERS.map(t => {
              const earned = studyMins >= t.mins;
              const isNext = t === nextStudy;
              return (
                <BadgeCard
                  key={t.label}
                  emoji={t.emoji}
                  label={t.label}
                  bg={t.bg}
                  shadow={t.shadow}
                  requirement={t.desc}
                  earned={earned}
                  next={isNext ? { current: studyMins, target: t.mins, unit: "hours" } : undefined}
                />
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-gray-900">🔥 Streak Badges</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">Earned by studying at least 5 minutes every day without missing a day</p>
          <div className="space-y-3">
            {STREAK_TIERS.map(t => {
              const earned = streak >= t.days;
              const isNext = t === nextStreak;
              return (
                <BadgeCard
                  key={t.label}
                  emoji={t.emoji}
                  label={t.label}
                  bg={t.bg}
                  shadow={t.shadow}
                  requirement={t.desc}
                  earned={earned}
                  next={isNext ? { current: streak, target: t.days, unit: "days" } : undefined}
                />
              );
            })}
          </div>
        </section>

        <section className="mb-4">
          <h2 className="text-base font-bold text-gray-900 mb-1">🌟 Special Badges</h2>
          <p className="text-xs text-gray-400 mb-4">Awarded by the Student Hub team for special achievements</p>
          <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-2xl mb-2">🎖️</p>
            <p className="text-sm font-medium text-gray-600">Special badges are awarded by admins</p>
            <p className="text-xs text-gray-400 mt-1">Participate in events and competitions to earn them</p>
          </div>
        </section>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <p className="text-sm font-semibold text-blue-800 mb-1">💡 How to earn badges</p>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Use the <Link href="/pomodoro" className="underline font-medium">Pomodoro timer</Link> — all study time is tracked automatically</li>
            <li>• Study at least 5 minutes every day to build your streak</li>
            <li>• Don't skip days — a missed day resets your streak to 0!</li>
          </ul>
        </div>
      </div>
    </>
  );
}
