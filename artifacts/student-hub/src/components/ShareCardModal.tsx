import { useRef, useState, useCallback, useEffect } from "react";
import { X, Download, Share2, Check, Copy } from "lucide-react";
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

function getBadges(stats: StudyStats, logs: DailyLog[]) {
  const badges: { icon: string; label: string }[] = [];
  const totalTasks = logs.reduce((s, l) => s + l.tasksCompleted, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMins = logs
    .filter((l) => new Date(l.date) >= weekAgo)
    .reduce((s, l) => s + l.studyMinutes, 0);

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

function getPeriodStats(
  period: Period,
  stats: StudyStats,
  dailyLogs: DailyLog[]
) {
  const today = new Date().toISOString().slice(0, 10);
  const periodDays = period === "day" ? 1 : period === "week" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays);
  const prevCutoff = new Date();
  prevCutoff.setDate(prevCutoff.getDate() - periodDays * 2);

  const periodLogs = dailyLogs.filter((l) => new Date(l.date) >= cutoff);
  const prevLogs = dailyLogs.filter(
    (l) => new Date(l.date) >= prevCutoff && new Date(l.date) < cutoff
  );

  let studyMinutes: number;
  if (period === "day") {
    studyMinutes =
      stats.lastActiveDate === today
        ? stats.todayStudyTime || periodLogs[0]?.studyMinutes || 0
        : periodLogs[0]?.studyMinutes || 0;
  } else {
    studyMinutes = periodLogs.reduce((s, l) => s + l.studyMinutes, 0);
  }

  const prevMins = prevLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const tasksCompleted =
    period === "day"
      ? periodLogs[0]?.tasksCompleted || 0
      : periodLogs.reduce((s, l) => s + l.tasksCompleted, 0);
  const notesRead =
    period === "day"
      ? periodLogs[0]?.notesViewed || 0
      : periodLogs.reduce((s, l) => s + l.notesViewed, 0);
  const improvePct =
    prevMins > 0
      ? Math.round(((studyMinutes - prevMins) / prevMins) * 100)
      : studyMinutes > 0
      ? 100
      : 0;

  return { studyMinutes, tasksCompleted, notesRead, improvePct };
}

const ACCENT: Record<Period, string> = {
  day: "linear-gradient(135deg, #7c6fff, #a78bfa)",
  week: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
  month: "linear-gradient(135deg, #ec4899, #f472b6)",
};
const ACCENT_SHADOW: Record<Period, string> = {
  day: "0 4px 20px rgba(124,111,255,0.45)",
  week: "0 4px 20px rgba(14,165,233,0.45)",
  month: "0 4px 20px rgba(236,72,153,0.45)",
};
const PERIOD_LABELS: Record<Period, string> = {
  day: "Today",
  week: "This Week",
  month: "This Month",
};

type Toast = { kind: "success" | "info" | "error"; msg: string } | null;

export default function ShareCardModal({
  open,
  onClose,
  userName,
  userGrade,
  stats,
  dailyLogs,
}: ShareCardModalProps) {
  const [period, setPeriod] = useState<Period>("week");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  // Hidden off-screen card used for capturing
  const cardRef = useRef<HTMLDivElement>(null);

  // Reset toast when period changes
  useEffect(() => { setToast(null); }, [period]);

  const { studyMinutes, tasksCompleted, notesRead, improvePct } =
    getPeriodStats(period, stats, dailyLogs);
  const badges = getBadges(stats, dailyLogs);

  const showToast = useCallback((kind: "success" | "info" | "error", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  /** Captures the hidden card at 1080×1920 (2.77× scale) */
  const captureBlob = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const { default: html2canvas } = await import("html2canvas");
    // 390×693 card × 2.769 ≈ 1080×1919 — Instagram story native resolution
    const canvas = await html2canvas(cardRef.current, {
      scale: 2.769,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      allowTaint: true,
      imageTimeout: 0,
    });
    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 1.0)
    );
  }, []);

  const handleDownload = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await captureBlob();
      if (!blob) { showToast("error", "Could not generate card. Try again."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studenthub-${period}-report.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("success", "Downloaded! Open Instagram → + → Story → Gallery to share.");
    } catch {
      showToast("error", "Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [captureBlob, period, showToast]);

  const handleShare = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await captureBlob();
      if (!blob) { showToast("error", "Could not generate card. Try again."); return; }

      const file = new File([blob], `studenthub-${period}-report.png`, {
        type: "image/png",
      });

      // Web Share API with file — works on Android Chrome, iOS Safari, Samsung Browser
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `My ${PERIOD_LABELS[period]} Study Report – Student Hub Nepal`,
          text: `📊 Check my study progress! studenthubnp.com`,
        });
        showToast("success", "Shared!");
      } else {
        // Desktop fallback — download + instructions
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `studenthub-${period}-report.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(
          "info",
          "Downloaded! On Instagram/Facebook → Tap + → Story → choose from Gallery."
        );
      }
    } catch (err: unknown) {
      // User cancelled share — not an error
      if (err instanceof Error && err.name === "AbortError") return;
      showToast("error", "Share failed. Use Download instead.");
    } finally {
      setBusy(false);
    }
  }, [captureBlob, period, showToast]);

  if (!open) return null;

  // Card preview scale: fit 390px card into ~340px container
  const CARD_W = 390;
  const CARD_H = 693;
  const previewW = Math.min(340, window.innerWidth - 56);
  const scale = previewW / CARD_W;
  const previewH = CARD_H * scale;

  return (
    <>
      {/* ── Off-screen hidden card for capture ── */}
      <div
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: CARD_W,
          height: CARD_H,
          zIndex: -1,
          pointerEvents: "none",
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

      {/* ── Modal backdrop ── */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="relative w-full sm:max-w-md bg-[#0e0e14] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[95vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
            <div>
              <h2 className="text-white font-bold text-base">Share Report Card</h2>
              <p className="text-white/40 text-xs mt-0.5">High-res card · Perfect for Instagram Stories</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-xl hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Period toggle */}
            <div className="flex gap-2 px-5 pt-4 pb-3">
              {(["day", "week", "month"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    period === p
                      ? "text-gray-900 shadow-lg"
                      : "bg-white/8 text-white/50 hover:bg-white/12 hover:text-white/70"
                  }`}
                  style={period === p ? { background: ACCENT[p] } : undefined}
                >
                  {p === "day" ? "☀️ Today" : p === "week" ? "📅 Week" : "📆 Month"}
                </button>
              ))}
            </div>

            {/* Card preview — visual only, not used for capture */}
            <div className="flex justify-center px-5 pb-2">
              <div
                style={{
                  width: previewW,
                  height: previewH,
                  position: "relative",
                  borderRadius: 20,
                  overflow: "hidden",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: CARD_W,
                    height: CARD_H,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  <ShareCard
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
            </div>

            {/* Toast */}
            {toast && (
              <div
                className={`mx-5 mb-3 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2 transition-all ${
                  toast.kind === "success"
                    ? "bg-green-500/15 border border-green-500/30 text-green-300"
                    : toast.kind === "error"
                    ? "bg-red-500/15 border border-red-500/30 text-red-300"
                    : "bg-blue-500/15 border border-blue-500/30 text-blue-200"
                }`}
              >
                <span className="flex-shrink-0 text-base">
                  {toast.kind === "success" ? "✅" : toast.kind === "error" ? "❌" : "ℹ️"}
                </span>
                <span>{toast.msg}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={handleDownload}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all bg-white/10 hover:bg-white/15 text-white border border-white/10 disabled:opacity-50 active:scale-95"
              >
                {busy ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download
              </button>
              <button
                onClick={handleShare}
                disabled={busy}
                className="flex-[1.6] flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-50 active:scale-95"
                style={{
                  background: ACCENT[period],
                  boxShadow: ACCENT_SHADOW[period],
                }}
              >
                {busy ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                Share to Story
              </button>
            </div>

            {/* Instruction hint */}
            <p className="text-white/25 text-[10px] text-center pb-5 px-5 leading-relaxed">
              On mobile, tap "Share to Story" to open Instagram, Facebook & more.{"\n"}
              On desktop, download and upload to your story manually.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
