import { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import {
  BarChart2, Flame, Trophy, Star, TrendingUp,
  CheckSquare, Clock, Calendar, Award, BookOpen,
  ChevronRight, TrendingDown, Minus,
} from "lucide-react";

interface DailyLog {
  date: string;
  studyMinutes: number;
  tasksCompleted: number;
  notesViewed: number;
}

interface StudyStats {
  streak: number;
  totalStudyTime: number;
  todayStudyTime: number;
  lastActiveDate: string | null;
}

interface ReportData {
  stats: StudyStats;
  dailyLogs: DailyLog[];
}

type ViewPeriod = "week" | "month";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Duolingo-style daily insights ──────────────────────────────────────────

function buildInsights(stats: StudyStats, dailyLogs: DailyLog[]): Array<{
  icon: string; text: string; type: "positive" | "warning" | "info";
}> {
  const insights: Array<{ icon: string; text: string; type: "positive" | "warning" | "info" }> = [];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const todayLog = dailyLogs.find(l => l.date === today);
  const yesterdayLog = dailyLogs.find(l => l.date === yesterday);
  const todayMins = stats.todayStudyTime || todayLog?.studyMinutes || 0;
  const yesterdayMins = yesterdayLog?.studyMinutes || 0;

  // Streak messages
  if (stats.streak >= 7) {
    insights.push({ icon: "🔥", text: `${stats.streak}-day streak! You're unstoppable — keep it going!`, type: "positive" });
  } else if (stats.streak >= 3) {
    insights.push({ icon: "🔥", text: `${stats.streak} days in a row! You're building a great habit.`, type: "positive" });
  } else if (stats.streak === 0 && stats.lastActiveDate && stats.lastActiveDate < yesterday) {
    insights.push({ icon: "⚠️", text: "Your streak broke. Study today to start a new one!", type: "warning" });
  }

  // Today vs yesterday
  if (todayMins > 0 && yesterdayMins > 0) {
    const diff = todayMins - yesterdayMins;
    if (diff > 0) {
      insights.push({ icon: "📈", text: `You studied ${diff} min more than yesterday. Amazing!`, type: "positive" });
    } else if (diff < -10) {
      insights.push({ icon: "📉", text: `You studied ${Math.abs(diff)} min less than yesterday. Try to push a bit more!`, type: "warning" });
    } else {
      insights.push({ icon: "👍", text: `Consistent! About the same study time as yesterday.`, type: "info" });
    }
  } else if (todayMins === 0) {
    const hour = new Date().getHours();
    if (hour >= 18) {
      insights.push({ icon: "😴", text: "You haven't studied yet today. Start a quick 25-min session now!", type: "warning" });
    } else {
      insights.push({ icon: "🌅", text: "Start your first study session of the day!", type: "info" });
    }
  }

  // Notes viewed
  const totalNotes = dailyLogs.reduce((s, l) => s + l.notesViewed, 0);
  if (totalNotes >= 10) {
    insights.push({ icon: "📚", text: `You've viewed ${totalNotes} notes total. Great reading habit!`, type: "positive" });
  }

  // Tasks
  const totalTasks = dailyLogs.reduce((s, l) => s + l.tasksCompleted, 0);
  if (totalTasks >= 5) {
    insights.push({ icon: "✅", text: `${totalTasks} tasks completed! You're getting things done.`, type: "positive" });
  }

  // All-time milestone
  const hours = Math.floor(stats.totalStudyTime / 60);
  if (hours >= 10) {
    insights.push({ icon: "🎓", text: `${hours}+ hours of total study time. You're dedicated!`, type: "positive" });
  }

  // Weekly comparison
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const thisWeek = dailyLogs.filter(l => new Date(l.date) >= weekAgo).reduce((s, l) => s + l.studyMinutes, 0);
  const lastWeek = dailyLogs.filter(l => new Date(l.date) >= twoWeeksAgo && new Date(l.date) < weekAgo).reduce((s, l) => s + l.studyMinutes, 0);
  if (thisWeek > 0 && lastWeek > 0) {
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    if (pct >= 20) {
      insights.push({ icon: "🚀", text: `This week you studied ${pct}% more than last week!`, type: "positive" });
    } else if (pct <= -20) {
      insights.push({ icon: "💪", text: `Last week was better. You can do more this week!`, type: "warning" });
    }
  }

  return insights.slice(0, 4); // Show max 4 insights
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function getBadges(stats: StudyStats, logs: DailyLog[]) {
  const badges: { icon: string; label: string; color: string }[] = [];
  const totalTasks = logs.reduce((s, l) => s + l.tasksCompleted, 0);
  const weekLogs = logs.filter(l => new Date(l.date) >= (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })());
  const weekMins = weekLogs.reduce((s, l) => s + l.studyMinutes, 0);

  if (stats.streak >= 3)  badges.push({ icon: "🔥", label: "3-Day Streak",      color: "bg-orange-50 text-orange-700 border-orange-200" });
  if (stats.streak >= 7)  badges.push({ icon: "⚡", label: "Week Warrior",       color: "bg-yellow-50 text-yellow-700 border-yellow-200" });
  if (stats.streak >= 30) badges.push({ icon: "👑", label: "Month Master",       color: "bg-purple-50 text-purple-700 border-purple-200" });
  if (stats.totalStudyTime >= 60)   badges.push({ icon: "📚", label: "1 Hour Studied",    color: "bg-blue-50 text-blue-700 border-blue-200"    });
  if (stats.totalStudyTime >= 600)  badges.push({ icon: "🎓", label: "10 Hours Total",    color: "bg-indigo-50 text-indigo-700 border-indigo-200" });
  if (stats.totalStudyTime >= 3000) badges.push({ icon: "🏆", label: "50 Hours Legend",   color: "bg-yellow-50 text-yellow-800 border-yellow-300" });
  if (totalTasks >= 5)  badges.push({ icon: "✅", label: "Task Crusher",         color: "bg-green-50 text-green-700 border-green-200"  });
  if (totalTasks >= 20) badges.push({ icon: "💼", label: "20 Tasks Done",        color: "bg-teal-50 text-teal-700 border-teal-200"     });
  if (weekMins >= 120)  badges.push({ icon: "🌟", label: "Consistent Learner",   color: "bg-pink-50 text-pink-700 border-pink-200"     });
  return badges;
}

function fmtTime(mins: number) { return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`; }

// ─── Bar chart ────────────────────────────────────────────────────────────────

function StudyBar({ logs, period }: { logs: DailyLog[]; period: ViewPeriod }) {
  const days = useMemo(() => {
    const count = period === "week" ? 7 : 30;
    const today = new Date();
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (count - 1 - i));
      const key = d.toISOString().slice(0, 10);
      const log = logs.find(l => l.date === key);
      return {
        label: period === "week" ? DAYS[d.getDay()] : String(d.getDate()),
        minutes: log?.studyMinutes ?? 0,
        isToday: i === count - 1,
      };
    });
  }, [logs, period]);

  const max = Math.max(...days.map(d => d.minutes), 1);

  return (
    <div className={`flex items-end gap-${period === "week" ? "2" : "1"} h-28`}>
      {days.map(({ label, minutes, isToday }, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
            <div
              className={`w-full rounded-t-sm transition-all ${isToday ? "bg-blue-500" : minutes > 0 ? "bg-blue-300" : "bg-gray-100"}`}
              style={{ height: `${Math.max((minutes / max) * 80, minutes > 0 ? 3 : 1)}px` }}
              title={`${minutes} min`}
            />
          </div>
          <span className={`text-[9px] font-medium ${isToday ? "text-blue-600" : "text-gray-400"}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Report Content ──────────────────────────────────────────────────────

function ReportContent() {
  const { user } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ViewPeriod>("week");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          fetch(`/api/study/stats/${user.uid}`),
          fetch(`/api/study/logs/${user.uid}`),
        ]);

        const stats: StudyStats = statsRes.ok ? await statsRes.json() : { streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null };
        const dailyLogs: DailyLog[] = logsRes.ok ? await logsRes.json() : [];

        setData({ stats, dailyLogs });
      } catch (err) {
        console.error("Failed to load report data:", err);
        setData({ stats: { streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null }, dailyLogs: [] });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <div className="h-8 w-40 bg-gray-100 rounded-xl animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!data) return null;
  const { stats, dailyLogs } = data;

  const periodDays = period === "week" ? 7 : 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - periodDays);
  const periodLogs = dailyLogs.filter(l => new Date(l.date) >= cutoff);
  const prevCutoff = new Date(); prevCutoff.setDate(prevCutoff.getDate() - periodDays * 2);
  const prevLogs = dailyLogs.filter(l => new Date(l.date) >= prevCutoff && new Date(l.date) < cutoff);

  const periodMins = periodLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const prevMins   = prevLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const periodTasks = periodLogs.reduce((s, l) => s + l.tasksCompleted, 0);
  const periodNotes = periodLogs.reduce((s, l) => s + l.notesViewed, 0);
  const improvePct = prevMins > 0 ? Math.round(((periodMins - prevMins) / prevMins) * 100) : periodMins > 0 ? 100 : 0;

  const badges = getBadges(stats, dailyLogs);
  const insights = buildInsights(stats, dailyLogs);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-500" />
            My Report Card
          </h1>
          <p className="text-gray-500 text-sm">Your study performance and progress</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setPeriod("week")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${period === "week" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            Week
          </button>
          <button onClick={() => setPeriod("month")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${period === "month" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            Month
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
            <Flame className="w-4 h-4" />
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Streak</p>
          <p className="text-2xl font-bold text-gray-900">{stats.streak}d</p>
          <p className="text-xs text-gray-400">days active</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-xs text-gray-500 mb-0.5">{period === "week" ? "This Week" : "This Month"}</p>
          <p className="text-2xl font-bold text-gray-900">{fmtTime(periodMins)}</p>
          <p className="text-xs text-gray-400">study time</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="w-9 h-9 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-3">
            <CheckSquare className="w-4 h-4" />
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Tasks Done</p>
          <p className="text-2xl font-bold text-gray-900">{periodTasks}</p>
          <p className="text-xs text-gray-400">{period === "week" ? "this week" : "this month"}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
            <BookOpen className="w-4 h-4" />
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Notes Read</p>
          <p className="text-2xl font-bold text-gray-900">{periodNotes}</p>
          <p className="text-xs text-gray-400">{period === "week" ? "this week" : "this month"}</p>
        </div>
      </div>

      {/* Duolingo-style insights */}
      {insights.length > 0 && (
        <div className="mb-5 space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium ${
              ins.type === "positive" ? "bg-green-50 border-green-100 text-green-800" :
              ins.type === "warning"  ? "bg-amber-50 border-amber-100 text-amber-800" :
                                       "bg-blue-50 border-blue-100 text-blue-800"
            }`}>
              <span className="text-xl flex-shrink-0">{ins.icon}</span>
              <span>{ins.text}</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-40 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Bar chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          {period === "week" ? "Last 7 Days" : "Last 30 Days"}
        </h3>
        <StudyBar logs={dailyLogs} period={period} />
        {periodMins === 0 && (
          <p className="text-xs text-gray-400 mt-3 text-center">Start a Pomodoro session to fill this chart!</p>
        )}
      </div>

      {/* Weekly comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            {period === "week" ? "Weekly" : "Monthly"} Progress
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">This {period}</p>
              <p className="text-xl font-bold text-gray-900">{fmtTime(periodMins)}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">Last {period}</p>
              <p className="text-xl font-bold text-gray-900">{fmtTime(prevMins)}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1 ${
              improvePct > 0 ? "bg-green-50 text-green-600" :
              improvePct < 0 ? "bg-red-50 text-red-500"    :
                               "bg-gray-50 text-gray-400"
            }`}>
              {improvePct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : improvePct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              {improvePct >= 0 ? "+" : ""}{improvePct}%
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            All-Time Stats
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Study Time</span>
              <span className="font-semibold text-gray-900">{fmtTime(stats.totalStudyTime)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Current Streak</span>
              <span className="font-semibold text-gray-900">{stats.streak} days 🔥</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Studied Today</span>
              <span className="font-semibold text-gray-900">{fmtTime(stats.todayStudyTime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-500" />
            Badges Earned
          </h3>
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <span key={b.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${b.color}`}>
                <span>{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No badges yet</p>
          <p className="text-xs text-gray-400 mt-1">Complete a 3-day streak or 1 hour of study to earn your first badge!</p>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-6">
        Daily report refreshes automatically · Study consistently to climb the leaderboard
      </p>
    </div>
  );
}

export default function ReportCard() {
  return (
    <>
      <Helmet>
        <title>Report Card — Student Hub</title>
        <meta name="description" content="Track your study progress, streaks, and performance on Student Hub." />
      </Helmet>
      <SoftGate feature="Report Card">
        <ReportContent />
      </SoftGate>
    </>
  );
}
