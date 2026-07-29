import { useMemo, useEffect, useState } from "react";
import { Calendar } from "lucide-react";

interface ExamInfo {
  label: string;
  date: Date;
  isApprox: boolean;
  gradient: string;
  ringColor: string;
  emoji: string;
  motivation: (days: number) => string;
}

function nextOccurrence(month: number, day: number): Date {
  // month is 0-indexed (0 = Jan, 9 = Oct)
  const now = new Date();
  const y = now.getFullYear();
  const d = new Date(y, month, day);
  if (d.getTime() - now.getTime() < 0) d.setFullYear(y + 1);
  return d;
}

function getExamInfo(grade: number | null | undefined): ExamInfo | null {
  if (grade == null) return null;

  // CEE (Health Sciences entrance) — Bhadra/Aswin, approx October 12
  if (grade === 13) {
    return {
      label: "CEE Entrance Exam",
      date: nextOccurrence(9, 12), // October 12
      isApprox: true,
      gradient: "from-rose-500 via-pink-500 to-orange-500",
      ringColor: "bg-rose-400/30",
      emoji: "🏥",
      motivation: (d) =>
        d <= 0   ? "🎯 Exam day! You've got this!"
        : d <= 7  ? `⚡ Final week — stay sharp!`
        : d <= 30 ? `🔥 Last month — push hard every day!`
        : d <= 60 ? `📚 ${d} days — build momentum now!`
        :           `💪 ${d} days — stay consistent!`,
    };
  }

  // SEE (Grade 10) — Chaitra first week, approx March 15
  if (grade === 10) {
    return {
      label: "SEE Exam",
      date: nextOccurrence(2, 15), // March 15
      isApprox: true,
      gradient: "from-blue-500 via-blue-600 to-indigo-600",
      ringColor: "bg-blue-400/30",
      emoji: "📝",
      motivation: (d) =>
        d <= 0   ? "🎯 Exam day! All the best!"
        : d <= 7  ? `⚡ Final days — revise everything!`
        : d <= 30 ? `🔥 ${d} days — focus on weak subjects!`
        :           `💡 ${d} days — keep a daily habit!`,
    };
  }

  // NEB Grade 12 Board — Jestha, approx May 18
  if (grade === 12) {
    return {
      label: "NEB Board Exam",
      date: nextOccurrence(4, 18), // May 18
      isApprox: true,
      gradient: "from-violet-500 via-purple-500 to-indigo-600",
      ringColor: "bg-violet-400/30",
      emoji: "🎓",
      motivation: (d) =>
        d <= 0   ? "🎯 Exam day! Go do great!"
        : d <= 7  ? `⚡ Final week — trust your prep!`
        : d <= 30 ? `🔥 ${d} days — tighten up revision!`
        :           `📖 ${d} days — steady pace wins!`,
    };
  }

  // Grades 9, 11, 14 (IOE), 15 — no countdown
  return null;
}

function daysUntil(date: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

export function ExamCountdown({ grade }: { grade: number | null | undefined }) {
  const info = useMemo(() => getExamInfo(grade), [grade]);

  // Re-compute days every minute so it stays live while the page is open
  const [days, setDays] = useState<number>(() => (info ? daysUntil(info.date) : 0));
  useEffect(() => {
    if (!info) return;
    setDays(daysUntil(info.date));
    const id = setInterval(() => setDays(daysUntil(info.date)), 60_000);
    return () => clearInterval(id);
  }, [info]);

  if (!info) return null;

  const urgency = days <= 30 ? "high" : days <= 90 ? "mid" : "low";

  return (
    <div
      className={`mb-5 sm:mb-6 rounded-2xl bg-gradient-to-r ${info.gradient} shadow-lg overflow-hidden`}
    >
      {/* Main row */}
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        {/* Left: icon + text */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`w-11 h-11 sm:w-13 sm:h-13 ${info.ringColor} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 backdrop-blur-sm border border-white/20`}>
            {info.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Calendar className="w-3 h-3 text-white/60 flex-shrink-0" />
              <p className="text-white/70 text-[11px] font-medium uppercase tracking-wide leading-none">
                Exam Countdown
              </p>
            </div>
            <p className="font-bold text-sm sm:text-base text-white leading-tight">
              {info.label}
            </p>
            <p className="text-white/60 text-[11px] mt-0.5 leading-tight">
              ~{info.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              {" "}
              <span className="opacity-70">(approx)</span>
            </p>
          </div>
        </div>

        {/* Right: big days counter */}
        <div className="flex-shrink-0 text-right">
          <div className="relative">
            <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none text-white drop-shadow-sm">
              {days}
            </p>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wide mt-0.5 text-center">
              days left
            </p>
          </div>
        </div>
      </div>

      {/* Motivation strip — shown when ≤90 days */}
      {urgency !== "low" && (
        <div className="px-4 sm:px-5 py-2.5 bg-black/15 border-t border-white/10">
          <p className="text-white/90 text-xs font-medium">
            {info.motivation(days)}
          </p>
        </div>
      )}

      {/* Progress bar — only when ≤180 days */}
      {days <= 180 && (
        <div className="px-4 sm:px-5 pb-3 pt-1 bg-black/10">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/70 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, ((180 - days) / 180) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
