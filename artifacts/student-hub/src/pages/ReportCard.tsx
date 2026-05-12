import { useEffect, useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getNepaliDate, getNepaliYesterday } from "@/lib/nepaliDate";
import {
  BarChart2, Flame, Trophy, Star, TrendingUp,
  CheckSquare, Clock, Calendar, Award, BookOpen,
  ChevronRight, TrendingDown, Minus, Sparkles, RefreshCw,
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

type ViewPeriod = "day" | "week" | "month";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function buildInsights(stats: StudyStats, dailyLogs: DailyLog[]) {
  const insights: Array<{ icon: string; text: string; type: "positive" | "warning" | "info" }> = [];
  const today = getNepaliDate();
  const yesterday = getNepaliYesterday();

  const todayLog = dailyLogs.find(l => l.date === today);
  const yesterdayLog = dailyLogs.find(l => l.date === yesterday);
  const todayMins = stats.lastActiveDate === today
    ? (stats.todayStudyTime || todayLog?.studyMinutes || 0)
    : (todayLog?.studyMinutes || 0);
  const yesterdayMins = yesterdayLog?.studyMinutes || 0;

  if (stats.streak >= 7)
    insights.push({ icon: "🔥", text: `${stats.streak}-day streak! You're on fire — keep it going!`, type: "positive" });
  else if (stats.streak >= 3)
    insights.push({ icon: "🔥", text: `${stats.streak} days in a row! Great consistency.`, type: "positive" });
  else if (stats.streak === 0 && stats.lastActiveDate && stats.lastActiveDate < yesterday)
    insights.push({ icon: "⚠️", text: "Your streak broke. Study today to start a new one!", type: "warning" });

  if (todayMins > 0 && yesterdayMins > 0) {
    const diff = todayMins - yesterdayMins;
    if (diff > 0)
      insights.push({ icon: "📈", text: `You studied ${diff} min more than yesterday. Amazing!`, type: "positive" });
    else if (diff < -10)
      insights.push({ icon: "📉", text: `${Math.abs(diff)} min less than yesterday. You can do more!`, type: "warning" });
    else
      insights.push({ icon: "👍", text: "Consistent! About the same study time as yesterday.", type: "info" });
  } else if (todayMins === 0) {
    const hour = new Date().getHours();
    if (hour >= 18)
      insights.push({ icon: "😴", text: "You haven't studied yet today. Start a quick 25-min session!", type: "warning" });
    else
      insights.push({ icon: "🌅", text: "Start your first study session of the day!", type: "info" });
  }

  const totalNotes = dailyLogs.reduce((s, l) => s + l.notesViewed, 0);
  if (totalNotes >= 10)
    insights.push({ icon: "📚", text: `${totalNotes} notes read total. Great reading habit!`, type: "positive" });

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const thisWeek = dailyLogs.filter(l => new Date(l.date) >= weekAgo).reduce((s, l) => s + l.studyMinutes, 0);
  const lastWeek = dailyLogs.filter(l => new Date(l.date) >= twoWeeksAgo && new Date(l.date) < weekAgo).reduce((s, l) => s + l.studyMinutes, 0);
  if (thisWeek > 0 && lastWeek > 0) {
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    if (pct >= 20) insights.push({ icon: "🚀", text: `This week you studied ${pct}% more than last week!`, type: "positive" });
  }

  return insights.slice(0, 4);
}

function StudyBar({ logs, period }: { logs: DailyLog[]; period: ViewPeriod }) {
  const days = useMemo(() => {
    const count = period === "day" ? 1 : period === "week" ? 7 : 30;
    const NPT_MS = (5 * 60 + 45) * 60 * 1000;
    const todayNpt = new Date(Date.now() + NPT_MS);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(todayNpt.getTime() - (count - 1 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      const log = logs.find(l => l.date === key);
      return {
        label: period === "week" ? DAYS[d.getUTCDay()] : String(d.getUTCDate()),
        minutes: log?.studyMinutes ?? 0,
        isToday: i === count - 1,
      };
    });
  }, [logs, period]);

  const max = Math.max(...days.map(d => d.minutes), 1);

  return (
    <div className="flex items-end gap-1 h-28">
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

function DailyReport({ stats, logs }: { stats: StudyStats; logs: DailyLog[] }) {
  const today = getNepaliDate();
  const yesterday = getNepaliYesterday();

  const todayLog = logs.find(l => l.date === today);
  const yesterdayLog = logs.find(l => l.date === yesterday);
  const todayMins = stats.lastActiveDate === today
    ? (stats.todayStudyTime || todayLog?.studyMinutes || 0)
    : (todayLog?.studyMinutes || 0);
  const yesterdayMins = yesterdayLog?.studyMinutes || 0;
  const tasksToday = todayLog?.tasksCompleted || 0;
  const notesToday = todayLog?.notesViewed || 0;

  const diff = todayMins - yesterdayMins;
  const diffPct = yesterdayMins > 0 ? Math.round((diff / yesterdayMins) * 100) : todayMins > 0 ? 100 : 0;

  const now = new Date();
  const nptOffset = 5 * 60 + 45;
  const nptMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + nptOffset) % (24 * 60);
  const nptHour = Math.floor(nptMinutes / 60);
  const isAfter10pmNPT = nptHour >= 22;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-4 h-4 opacity-80" />
          <span className="text-xs font-semibold opacity-80 uppercase tracking-wide">
            {isAfter10pmNPT ? "Today's Report" : "Today So Far"} · {new Date().toLocaleDateString("en-NP", { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>
        <p className="text-2xl font-bold">{fmtTime(todayMins)}</p>
        <p className="text-sm opacity-80 mt-0.5">studied today</p>

        {yesterdayMins > 0 && (
          <div className="mt-4 bg-white/10 rounded-xl p-3 text-sm">
            <div className="flex items-center gap-2">
              {diff >= 0
                ? <><TrendingUp className="w-3.5 h-3.5" /><span>{Math.abs(diffPct)}% more than yesterday</span></>
                : <><TrendingDown className="w-3.5 h-3.5" /><span>{Math.abs(diffPct)}% less than yesterday</span></>
              }
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{fmtTime(todayMins)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Studied</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{tasksToday}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tasks done</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{notesToday}</p>
          <p className="text-xs text-gray-500 mt-0.5">Notes read</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" /> Today vs Yesterday
        </h3>
        <div className="space-y-2.5">
          {[
            { label: "Study time", today: fmtTime(todayMins), yesterday: fmtTime(yesterdayMins), better: diff >= 0 },
            { label: "Tasks done", today: String(tasksToday), yesterday: String(yesterdayLog?.tasksCompleted || 0), better: tasksToday >= (yesterdayLog?.tasksCompleted || 0) },
            { label: "Notes read", today: String(notesToday), yesterday: String(yesterdayLog?.notesViewed || 0), better: notesToday >= (yesterdayLog?.notesViewed || 0) },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{row.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-xs">Yesterday: {row.yesterday}</span>
                <span className={`font-semibold px-2 py-0.5 rounded-lg ${row.better ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                  Today: {row.today}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl p-4 flex items-center gap-3 ${stats.streak > 0 ? "bg-orange-50 border border-orange-100" : "bg-gray-50 border border-gray-100"}`}>
        <span className="text-2xl">🔥</span>
        <div>
          <p className="font-semibold text-gray-800">
            {stats.streak > 0 ? `${stats.streak}-day streak` : "No streak yet"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.streak > 0 ? "Keep going — don't break it!" : "Study today to start your streak!"}
          </p>
        </div>
      </div>

      {!isAfter10pmNPT && (
        <p className="text-center text-xs text-gray-400">
          Full daily report published at 10:00 PM Nepal time
        </p>
      )}
    </div>
  );
}

function getBadges(stats: StudyStats, logs: DailyLog[]) {
  const badges: { icon: string; label: string; color: string }[] = [];
  const totalTasks = logs.reduce((s, l) => s + l.tasksCompleted, 0);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMins = logs.filter(l => new Date(l.date) >= weekAgo).reduce((s, l) => s + l.studyMinutes, 0);

  if (stats.streak >= 3)  badges.push({ icon: "🔥", label: "3-Day Streak",     color: "bg-orange-50 text-orange-700 border-orange-200" });
  if (stats.streak >= 7)  badges.push({ icon: "⚡", label: "Week Warrior",      color: "bg-yellow-50 text-yellow-700 border-yellow-200" });
  if (stats.streak >= 30) badges.push({ icon: "👑", label: "Month Master",      color: "bg-purple-50 text-purple-700 border-purple-200" });
  if (stats.totalStudyTime >= 60)   badges.push({ icon: "📚", label: "1 Hour Studied",   color: "bg-blue-50 text-blue-700 border-blue-200"    });
  if (stats.totalStudyTime >= 600)  badges.push({ icon: "🎓", label: "10 Hours Total",   color: "bg-indigo-50 text-indigo-700 border-indigo-200" });
  if (stats.totalStudyTime >= 3000) badges.push({ icon: "🏆", label: "50 Hours Legend",  color: "bg-yellow-50 text-yellow-800 border-yellow-300" });
  if (totalTasks >= 5)  badges.push({ icon: "✅", label: "Task Crusher",        color: "bg-green-50 text-green-700 border-green-200"  });
  if (weekMins >= 120)  badges.push({ icon: "🌟", label: "Consistent Learner",  color: "bg-pink-50 text-pink-700 border-pink-200"     });
  return badges;
}

interface CustomBadge { id: string; text: string; emoji: string; color: string }

function ReportContent() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ViewPeriod>("week");
  const [customBadges, setCustomBadges] = useState<CustomBadge[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [userSnap, logsSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(query(collection(db, "study_logs"), where("uid", "==", user.uid))),
      ]);

      if (userSnap.exists()) {
        const d = userSnap.data();
        setStats({
          streak: d.streak ?? 0,
          totalStudyTime: d.totalStudyTime ?? 0,
          todayStudyTime: d.todayStudyTime ?? 0,
          lastActiveDate: d.lastActiveDate ?? null,
        });
        setCustomBadges(d.badges ?? []);
      } else {
        setStats({ streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null });
      }

      const logs: DailyLog[] = logsSnap.docs
        .map(d => ({
          date: d.data().date,
          studyMinutes: d.data().studyMinutes ?? 0,
          tasksCompleted: d.data().tasksCompleted ?? 0,
          notesViewed: d.data().notesViewed ?? 0,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setDailyLogs(logs);
    } catch {
      setStats({ streak: 0, totalStudyTime: 0, todayStudyTime: 0, lastActiveDate: null });
      setDailyLogs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, [load]);

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

  if (!stats) return null;

  const periodDays = period === "day" ? 1 : period === "week" ? 7 : 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - periodDays);
  const prevCutoff = new Date(); prevCutoff.setDate(prevCutoff.getDate() - periodDays * 2);
  const periodLogs = dailyLogs.filter(l => new Date(l.date) >= cutoff);
  const prevLogs = dailyLogs.filter(l => new Date(l.date) >= prevCutoff && new Date(l.date) < cutoff);
  const periodMins  = periodLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const prevMins    = prevLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const periodTasks = periodLogs.reduce((s, l) => s + l.tasksCompleted, 0);
  const periodNotes = periodLogs.reduce((s, l) => s + l.notesViewed, 0);
  const improvePct  = prevMins > 0 ? Math.round(((periodMins - prevMins) / prevMins) * 100) : periodMins > 0 ? 100 : 0;
  const badges      = getBadges(stats, dailyLogs);
  const insights    = buildInsights(stats, dailyLogs);

  const aiContextParam = encodeURIComponent(`I want to improve my study habits. Here is my data: streak ${stats.streak} days, total study time ${stats.totalStudyTime} minutes, studied today ${stats.todayStudyTime} minutes, weekly study ${periodMins} minutes. Please analyze this and give me specific personalized advice.`);

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
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(["day", "week", "month"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${period === p ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                {p === "day" ? "Today" : p === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {period === "day" ? (
        <DailyReport stats={stats} logs={dailyLogs} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { icon: Flame,       label: "Streak",               value: `${stats.streak}d`,        sub: "days active",      color: "bg-orange-100 text-orange-600" },
              { icon: Clock,       label: period === "week" ? "This Week" : "This Month", value: fmtTime(periodMins), sub: "study time", color: "bg-blue-100 text-blue-600" },
              { icon: CheckSquare, label: "Tasks Done",            value: String(periodTasks),       sub: "completed",        color: "bg-green-100 text-green-600"  },
              { icon: BookOpen,    label: "Notes Read",            value: String(periodNotes),       sub: "this period",      color: "bg-indigo-100 text-indigo-600" },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {insights.length > 0 && (
            <div className="mb-5 space-y-2">
              {insights.map((ins, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium ${
                  ins.type === "positive" ? "bg-green-50 border-green-100 text-green-800" :
                  ins.type === "warning"  ? "bg-amber-50 border-amber-100 text-amber-800" :
                                           "bg-blue-50 border-blue-100 text-blue-800"
                }`}>
                  <span className="text-xl flex-shrink-0">{ins.icon}</span>
                  <span className="flex-1">{ins.text}</span>
                  <ChevronRight className="w-4 h-4 opacity-40 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

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
                  improvePct < 0 ? "bg-red-50 text-red-500" :
                                   "bg-gray-50 text-gray-400"
                }`}>
                  {improvePct > 0 ? <TrendingUp className="w-3 h-3" /> : improvePct < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
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
                {[
                  { label: "Total Study Time", value: fmtTime(stats.totalStudyTime) },
                  { label: "Current Streak",   value: `${stats.streak} days 🔥` },
                  { label: "Studied Today",    value: fmtTime(stats.lastActiveDate === getNepaliDate() ? stats.todayStudyTime : 0) },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{r.label}</span>
                    <span className="font-semibold text-gray-900">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <Link
        href={`/ai?q=${aiContextParam}`}
        className="flex items-center justify-between w-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl px-5 py-4 mb-5 hover:from-indigo-100 hover:to-purple-100 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Get AI Study Advice</p>
            <p className="text-xs text-gray-500">Nep AI will analyze your report and suggest improvements</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
      </Link>

      {(badges.length > 0 || customBadges.length > 0) ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-500" />
            Badges Earned
          </h3>
          <div className="flex flex-wrap gap-2">
            {customBadges.map(b => (
              <span
                key={b.id}
                style={{ background: b.color, boxShadow: `0 2px 8px ${b.color}55` }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
              >
                {b.emoji} {b.text}
              </span>
            ))}
            {badges.map(b => (
              <span key={b.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${b.color}`}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No badges yet</p>
          <p className="text-xs text-gray-400 mt-1">Study 3 days in a row or 1 hour total to earn your first badge!</p>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-6">
        Data refreshes automatically · Daily report at 10:00 PM Nepal Time
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
