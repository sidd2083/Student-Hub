import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, query, where,
  orderBy, limit, getDocs,
} from "firebase/firestore";
import {
  BarChart2, Flame, Trophy, Star, TrendingUp,
  CheckSquare, Clock, Calendar, Award,
} from "lucide-react";

interface DailyLog {
  date: string;
  studyMinutes: number;
  tasksCompleted: number;
}

interface ReportData {
  streak: number;
  totalStudyMinutes: number;
  weeklyMinutes: number;
  lastWeekMinutes: number;
  monthlyMinutes: number;
  dailyLogs: DailyLog[];
  tasksCompleted: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getBadges(data: ReportData) {
  const badges: { icon: string; label: string; color: string }[] = [];
  if (data.streak >= 3)  badges.push({ icon: "🔥", label: "3-Day Streak",    color: "bg-orange-50 text-orange-700 border-orange-200" });
  if (data.streak >= 7)  badges.push({ icon: "⚡", label: "Week Warrior",     color: "bg-yellow-50 text-yellow-700 border-yellow-200" });
  if (data.streak >= 30) badges.push({ icon: "👑", label: "Month Master",     color: "bg-purple-50 text-purple-700 border-purple-200" });
  if (data.totalStudyMinutes >= 60)   badges.push({ icon: "📚", label: "1 Hour Studied", color: "bg-blue-50 text-blue-700 border-blue-200" });
  if (data.totalStudyMinutes >= 600)  badges.push({ icon: "🎓", label: "10 Hours Total",  color: "bg-indigo-50 text-indigo-700 border-indigo-200" });
  if (data.tasksCompleted >= 5)  badges.push({ icon: "✅", label: "5 Tasks Done",      color: "bg-green-50 text-green-700 border-green-200" });
  if (data.weeklyMinutes >= 120) badges.push({ icon: "🌟", label: "Consistent Learner", color: "bg-pink-50 text-pink-700 border-pink-200" });
  return badges;
}

function StatBox({ icon: Icon, label, value, sub, color }: {
  icon: typeof Clock; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
      <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function WeeklyBar({ logs }: { logs: DailyLog[] }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const log = logs.find(l => l.date === key);
    return { day: DAYS[d.getDay()], minutes: log?.studyMinutes ?? 0, isToday: i === 6 };
  });
  const max = Math.max(...days.map(d => d.minutes), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-blue-500" />
        Last 7 Days
      </h3>
      <div className="flex items-end gap-2 h-28">
        {days.map(({ day, minutes, isToday }) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
              <div
                className={`w-full rounded-t-lg transition-all ${isToday ? "bg-blue-500" : minutes > 0 ? "bg-blue-200" : "bg-gray-100"}`}
                style={{ height: `${Math.max((minutes / max) * 80, minutes > 0 ? 4 : 2)}px` }}
                title={`${minutes} min`}
              />
            </div>
            <span className={`text-[10px] font-medium ${isToday ? "text-blue-600" : "text-gray-400"}`}>{day}</span>
            {minutes > 0 && <span className="text-[9px] text-gray-400">{minutes}m</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportContent() {
  const { user } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.data() ?? {};
        const streak = userData.streak ?? 0;
        const totalStudyMinutes = userData.totalStudyTime ?? userData.studyTime ?? 0;

        const logsSnap = await getDocs(
          query(
            collection(db, "users", user.uid, "studyLogs"),
            orderBy("date", "desc"),
            limit(30)
          )
        ).catch(() => ({ docs: [] as any[] }));

        const dailyLogs: DailyLog[] = logsSnap.docs.map((d: any) => ({
          date: d.data().date,
          studyMinutes: d.data().studyMinutes ?? 0,
          tasksCompleted: d.data().tasksCompleted ?? 0,
        }));

        const today = new Date();
        const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
        const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);
        const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 30);

        const weeklyMinutes = dailyLogs
          .filter(l => new Date(l.date) >= weekAgo)
          .reduce((s, l) => s + l.studyMinutes, 0);
        const lastWeekMinutes = dailyLogs
          .filter(l => new Date(l.date) >= twoWeeksAgo && new Date(l.date) < weekAgo)
          .reduce((s, l) => s + l.studyMinutes, 0);
        const monthlyMinutes = dailyLogs
          .filter(l => new Date(l.date) >= monthAgo)
          .reduce((s, l) => s + l.studyMinutes, 0);
        const tasksCompleted = dailyLogs.reduce((s, l) => s + l.tasksCompleted, 0);

        setData({ streak, totalStudyMinutes, weeklyMinutes, lastWeekMinutes, monthlyMinutes, dailyLogs, tasksCompleted });
      } catch (err) {
        console.error("Failed to load report data:", err);
        setData({ streak: 0, totalStudyMinutes: 0, weeklyMinutes: 0, lastWeekMinutes: 0, monthlyMinutes: 0, dailyLogs: [], tasksCompleted: 0 });
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

  const improvementPct = data.lastWeekMinutes > 0
    ? Math.round(((data.weeklyMinutes - data.lastWeekMinutes) / data.lastWeekMinutes) * 100)
    : data.weeklyMinutes > 0 ? 100 : 0;

  const badges = getBadges(data);
  const fmtTime = (mins: number) => mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : `${mins}m`;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-blue-500" />
          My Report Card
        </h1>
        <p className="text-gray-500 text-sm">Your study performance and progress</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatBox icon={Flame}      label="Current Streak"   value={`${data.streak}d`}           sub="days active"             color="bg-orange-100 text-orange-600" />
        <StatBox icon={Clock}      label="This Week"        value={fmtTime(data.weeklyMinutes)}  sub="study time"              color="bg-blue-100 text-blue-600"    />
        <StatBox icon={Calendar}   label="This Month"       value={fmtTime(data.monthlyMinutes)} sub="study time"              color="bg-indigo-100 text-indigo-600" />
        <StatBox icon={CheckSquare} label="Tasks Completed" value={`${data.tasksCompleted}`}     sub="all time"                color="bg-green-100 text-green-600"  />
      </div>

      <WeeklyBar logs={data.dailyLogs} />

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Weekly Progress
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">This week</p>
              <p className="text-xl font-bold text-gray-900">{fmtTime(data.weeklyMinutes)}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 mb-1">Last week</p>
              <p className="text-xl font-bold text-gray-900">{fmtTime(data.lastWeekMinutes)}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${improvementPct >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
              {improvementPct >= 0 ? "+" : ""}{improvementPct}%
            </div>
          </div>
          {data.weeklyMinutes === 0 && (
            <p className="text-xs text-gray-400 mt-3">Start a Pomodoro session to track your study time here.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            All-Time Stats
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Study Time</span>
              <span className="font-semibold text-gray-900">{fmtTime(data.totalStudyMinutes)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Best Streak</span>
              <span className="font-semibold text-gray-900">{data.streak} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Monthly Total</span>
              <span className="font-semibold text-gray-900">{fmtTime(data.monthlyMinutes)}</span>
            </div>
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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
      )}

      {badges.length === 0 && (
        <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No badges yet</p>
          <p className="text-xs text-gray-400 mt-1">Study consistently to earn badges and track your progress!</p>
        </div>
      )}
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
