import { useRef, useState, useCallback } from "react";
import { X, Download, Share2, Instagram, Check } from "lucide-react";
import ShareCard from "@/components/ShareCard";

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

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userGrade: string;
  stats: StudyStats;
  dailyLogs: DailyLog[];
}

type Period = "day" | "week" | "month";

const PERIOD_OPTIONS: { value: Period; label: string; emoji: string }[] = [
  { value: "day", label: "Today", emoji: "☀️" },
  { value: "week", label: "This Week", emoji: "📅" },
  { value: "month", label: "This Month", emoji: "📆" },
];

function getBadges(stats: StudyStats, logs: DailyLog[]) {
  const badges: { icon: string; label: string }[] = [];
  const totalTasks = logs.reduce((s, l) => s + l.tasksCompleted, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMins = logs.filter((l) => new Date(l.date) >= weekAgo).reduce((s, l) => s + l.studyMinutes, 0);

  if (stats.streak >= 3)  badges.push({ icon: "🔥", label: "3-Day Streak" });
  if (stats.streak >= 7)  badges.push({ icon: "⚡", label: "Week Warrior" });
  if (stats.streak >= 30) badges.push({ icon: "👑", label: "Month Master" });
  if (stats.totalStudyTime >= 60)   badges.push({ icon: "📚", label: "1 Hour Legend" });
  if (stats.totalStudyTime >= 600)  badges.push({ icon: "🎓", label: "10 Hours Total" });
  if (stats.totalStudyTime >= 3000) badges.push({ icon: "🏆", label: "50 Hours Club" });
  if (totalTasks >= 5)  badges.push({ icon: "✅", label: "Task Crusher" });
  if (weekMins >= 120)  badges.push({ icon: "🌟", label: "Consistent Learner" });
  return badges;
}

function getPeriodStats(period: Period, stats: StudyStats, dailyLogs: DailyLog[], nepaliToday: string) {
  const periodDays = period === "day" ? 1 : period === "week" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const prevCutoff = new Date();
  prevCutoff.setDate(prevCutoff.getDate() - periodDays * 2);

  const periodLogs = dailyLogs.filter((l) => new Date(l.date) >= cutoff);
  const prevLogs = dailyLogs.filter((l) => new Date(l.date) >= prevCutoff && new Date(l.date) < cutoff);

  let studyMinutes: number;
  if (period === "day") {
    studyMinutes =
      stats.lastActiveDate === nepaliToday
        ? stats.todayStudyTime || periodLogs[0]?.studyMinutes || 0
        : periodLogs[0]?.studyMinutes || 0;
  } else {
    studyMinutes = periodLogs.reduce((s, l) => s + l.studyMinutes, 0);
  }

  const prevMins = prevLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const tasksCompleted = period === "day"
    ? periodLogs[0]?.tasksCompleted || 0
    : periodLogs.reduce((s, l) => s + l.tasksCompleted, 0);
  const notesRead = period === "day"
    ? periodLogs[0]?.notesViewed || 0
    : periodLogs.reduce((s, l) => s + l.notesViewed, 0);
  const improvePct =
    prevMins > 0 ? Math.round(((studyMinutes - prevMins) / prevMins) * 100) : studyMinutes > 0 ? 100 : 0;

  return { studyMinutes, tasksCompleted, notesRead, improvePct };
}

export default function ShareCardModal({
  open,
  onClose,
  userName,
  userGrade,
  stats,
  dailyLogs,
}: ShareCardModalProps) {
  const [period, setPeriod] = useState<Period>("week");
  const [downloading, setDownloading] = useState(false);
  const [shared, setShared] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const nepaliToday = new Date().toISOString().slice(0, 10);
  const { studyMinutes, tasksCompleted, notesRead, improvePct } = getPeriodStats(
    period,
    stats,
    dailyLogs,
    nepaliToday
  );
  const badges = getBadges(stats, dailyLogs);

  const captureCard = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(cardRef.current, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      allowTaint: true,
    });
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1.0));
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const periodLabel = period === "day" ? "daily" : period === "week" ? "weekly" : "monthly";
      a.download = `studenthub-${periodLabel}-report.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [captureCard, period]);

  const handleShare = useCallback(async () => {
    try {
      const blob = await captureCard();
      if (!blob) return;
      const file = new File([blob], "studenthub-report.png", { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Study Report – Student Hub Nepal",
          text: `Check out my study progress on Student Hub Nepal 🎓 studenthubnp.com`,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2500);
      } else {
        await handleDownload();
      }
    } catch {
      await handleDownload();
    }
  }, [captureCard, handleDownload]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-[#111] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="text-white font-bold text-lg">Share Your Report</h2>
            <p className="text-white/40 text-xs mt-0.5">Download or share to your story</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-xl hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Switcher */}
        <div className="flex gap-2 px-5 pt-4 pb-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                period === opt.value
                  ? "bg-white text-gray-900 shadow"
                  : "bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/70"
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>

        {/* Card Preview */}
        <div className="flex justify-center py-4 px-5 overflow-x-auto">
          <div
            style={{
              transform: "scale(0.72)",
              transformOrigin: "top center",
              width: 390,
              height: 693,
              flexShrink: 0,
              marginBottom: -(693 * 0.28),
            }}
          >
            <ShareCard
              ref={cardRef}
              name={userName}
              grade={userGrade}
              period={period}
              studyMinutes={studyMinutes}
              tasksCompleted={tasksCompleted}
              notesRead={notesRead}
              streak={stats.streak}
              totalStudyTime={stats.totalStudyTime}
              improvePct={improvePct}
              dailyLogs={dailyLogs}
              badges={badges}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 pb-5 pt-2 flex gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all bg-white/10 hover:bg-white/15 text-white border border-white/10 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Saving…" : "Download"}
          </button>
          <button
            onClick={handleShare}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all text-white disabled:opacity-50"
            style={{
              background:
                period === "day"
                  ? "linear-gradient(135deg, #7c6fff, #a78bfa)"
                  : period === "week"
                  ? "linear-gradient(135deg, #0ea5e9, #38bdf8)"
                  : "linear-gradient(135deg, #ec4899, #f472b6)",
              boxShadow:
                period === "day"
                  ? "0 4px 20px rgba(124,111,255,0.4)"
                  : period === "week"
                  ? "0 4px 20px rgba(14,165,233,0.4)"
                  : "0 4px 20px rgba(236,72,153,0.4)",
            }}
          >
            {shared ? (
              <>
                <Check className="w-4 h-4" /> Shared!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" /> Share to Story
              </>
            )}
          </button>
        </div>

        {/* Tip */}
        <div className="flex items-center gap-2 px-5 pb-5">
          <Instagram className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
          <p className="text-white/30 text-[10px]">
            Tap "Share to Story" to post directly to Instagram, Snapchat, or any app. Or download and share manually.
          </p>
        </div>
      </div>
    </div>
  );
}
