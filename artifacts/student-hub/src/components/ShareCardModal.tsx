import { useRef, useState, useCallback, useEffect } from "react";
import { X, Download, Share2 } from "lucide-react";
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
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMins = logs.filter((l) => new Date(l.date) >= weekAgo).reduce((s, l) => s + l.studyMinutes, 0);
  const totalTasks = logs.reduce((s, l) => s + l.tasksCompleted, 0);

  if (stats.streak >= 3)              badges.push({ icon: "🔥", label: "3-Day Streak" });
  if (stats.streak >= 7)              badges.push({ icon: "⚡", label: "Week Warrior" });
  if (stats.streak >= 30)             badges.push({ icon: "👑", label: "Month Master" });
  if (stats.totalStudyTime >= 60)     badges.push({ icon: "📚", label: "1 Hour Legend" });
  if (stats.totalStudyTime >= 600)    badges.push({ icon: "🎓", label: "10 Hours Total" });
  if (stats.totalStudyTime >= 3000)   badges.push({ icon: "🏆", label: "50 Hours Club" });
  if (totalTasks >= 5)                badges.push({ icon: "✅", label: "Task Crusher" });
  if (weekMins >= 120)                badges.push({ icon: "🌟", label: "Consistent Learner" });
  return badges;
}

function getPeriodStats(period: Period, stats: StudyStats, dailyLogs: DailyLog[]) {
  const today = new Date().toISOString().slice(0, 10);
  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const prevCutoff = new Date(); prevCutoff.setDate(prevCutoff.getDate() - days * 2);

  const pLogs = dailyLogs.filter((l) => new Date(l.date) >= cutoff);
  const prevLogs = dailyLogs.filter((l) => new Date(l.date) >= prevCutoff && new Date(l.date) < cutoff);

  const studyMinutes = period === "day"
    ? (stats.lastActiveDate === today ? stats.todayStudyTime : pLogs[0]?.studyMinutes ?? 0)
    : pLogs.reduce((s, l) => s + l.studyMinutes, 0);

  const prevMins = prevLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const tasksCompleted = period === "day" ? (pLogs[0]?.tasksCompleted ?? 0) : pLogs.reduce((s, l) => s + l.tasksCompleted, 0);
  const notesRead = period === "day" ? (pLogs[0]?.notesViewed ?? 0) : pLogs.reduce((s, l) => s + l.notesViewed, 0);
  const improvePct = prevMins > 0 ? Math.round(((studyMinutes - prevMins) / prevMins) * 100) : studyMinutes > 0 ? 100 : 0;

  return { studyMinutes, tasksCompleted, notesRead, improvePct };
}

const GRAD: Record<Period, string> = {
  day:   "linear-gradient(135deg, #7c6fff, #a78bfa)",
  week:  "linear-gradient(135deg, #0ea5e9, #38bdf8)",
  month: "linear-gradient(135deg, #ec4899, #f472b6)",
};
const SHADOW: Record<Period, string> = {
  day:   "0 4px 20px rgba(124,111,255,0.45)",
  week:  "0 4px 20px rgba(14,165,233,0.45)",
  month: "0 4px 20px rgba(236,72,153,0.45)",
};
const PERIOD_LABELS: Record<Period, string> = {
  day: "Today", week: "This Week", month: "This Month",
};

type ToastState = { kind: "success" | "info" | "error"; msg: string } | null;

// The card is 390×693 in the DOM.
// html2canvas ignores CSS transform, so it captures raw 390×693.
// Multiplying by 2.769 → 1080×1919 px (Instagram Story native).
const CARD_W = 390;
const CARD_H = 693;
const CAPTURE_SCALE = 1080 / CARD_W; // ≈ 2.769

export default function ShareCardModal({
  open, onClose, userName, userGrade, stats, dailyLogs,
}: ShareCardModalProps) {
  const [period, setPeriod] = useState<Period>("week");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  // ref points directly at the rendered card div
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setToast(null); }, [period]);

  const { studyMinutes, tasksCompleted, notesRead, improvePct } = getPeriodStats(period, stats, dailyLogs);
  const badges = getBadges(stats, dailyLogs);

  const showToast = useCallback((kind: "success" | "info" | "error", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /**
   * Capture the card at 1080×1919.
   * We capture the raw 390×693 DOM element with scale=CAPTURE_SCALE.
   * html2canvas ignores CSS transforms, so the preview's transform:scale() wrapper
   * does NOT affect capture — we get exactly the un-scaled card.
   */
  const captureBlob = useCallback(async (): Promise<Blob | null> => {
    const el = cardRef.current;
    if (!el) return null;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      allowTaint: true,
      imageTimeout: 0,
      // Force exact dimensions
      width: CARD_W,
      height: CARD_H,
    });
    return new Promise((res) => canvas.toBlob((b) => res(b), "image/png", 1.0));
  }, []);

  const doDownload = useCallback(async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studenthub-${period}-report.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [period]);

  const handleDownload = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await captureBlob();
      if (!blob) { showToast("error", "Could not generate card."); return; }
      await doDownload(blob);
      showToast("success", "Saved! Go to Instagram → + → Story → pick from gallery.");
    } catch { showToast("error", "Download failed. Try again."); }
    finally { setBusy(false); }
  }, [captureBlob, doDownload, showToast]);

  const handleShare = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await captureBlob();
      if (!blob) { showToast("error", "Could not generate card."); return; }
      const file = new File([blob], `studenthub-${period}-report.png`, { type: "image/png" });

      if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `My ${PERIOD_LABELS[period]} Study Report – Student Hub Nepal`,
          text: "Check my study progress! 📊 studenthubnp.com",
        });
        showToast("success", "Shared!");
      } else {
        // Desktop: download + instructions
        await doDownload(blob);
        showToast("info", "Downloaded! On Instagram/Facebook → + → Story → choose from gallery.");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return; // user dismissed share sheet
      showToast("error", "Share failed. Use Download instead.");
    } finally { setBusy(false); }
  }, [captureBlob, doDownload, period, showToast]);

  if (!open) return null;

  // Scale the 390×693 card to fit nicely inside the modal
  const maxW = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 48 : 320);
  const previewScale = maxW / CARD_W;
  const previewH = Math.round(CARD_H * previewScale);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full sm:max-w-sm bg-[#0d0d14] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-sm">Share Report Card</h2>
            <p className="text-white/35 text-[11px] mt-0.5">1080 × 1920 px · Instagram Story ready</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-1.5 rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pb-2">

          {/* Period toggle */}
          <div className="flex gap-2 px-5 pt-4 pb-3">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${period === p ? "text-gray-900 shadow" : "bg-white/8 text-white/45 hover:bg-white/12 hover:text-white/65"}`}
                style={period === p ? { background: GRAD[p] } : undefined}
              >
                {p === "day" ? "☀️ Today" : p === "week" ? "📅 Week" : "📆 Month"}
              </button>
            ))}
          </div>

          {/* Card preview — this is ALSO what gets captured */}
          <div className="flex justify-center px-5 pb-3">
            <div
              style={{
                width: Math.round(CARD_W * previewScale),
                height: previewH,
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 8px 48px rgba(0,0,0,0.65)",
                flexShrink: 0,
                position: "relative",
              }}
            >
              {/*
                IMPORTANT: The outer div is sized to previewW×previewH via CSS.
                The inner ShareCard is 390×693 in the DOM, then scaled down with transform.
                html2canvas captures the inner div at its real 390×693 size (ignores transform),
                then multiplies by CAPTURE_SCALE → 1080×1919.
              */}
              <div
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                  pointerEvents: "none",
                  userSelect: "none",
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
          </div>

          {/* Toast */}
          {toast && (
            <div className={`mx-5 mb-3 px-4 py-2.5 rounded-2xl text-xs font-medium flex items-start gap-2 ${
              toast.kind === "success" ? "bg-green-500/15 border border-green-500/30 text-green-300"
              : toast.kind === "error"   ? "bg-red-500/15 border border-red-500/30 text-red-300"
              :                           "bg-blue-500/15 border border-blue-500/30 text-blue-200"
            }`}>
              <span className="flex-shrink-0 mt-0.5">{toast.kind === "success" ? "✅" : toast.kind === "error" ? "❌" : "ℹ️"}</span>
              <span>{toast.msg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-5 pb-4 flex gap-3">
            <button
              onClick={handleDownload}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm bg-white/10 hover:bg-white/14 text-white border border-white/10 disabled:opacity-50 active:scale-95 transition-all"
            >
              {busy
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Download className="w-4 h-4" />}
              Download
            </button>
            <button
              onClick={handleShare}
              disabled={busy}
              className="flex-[1.5] flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-50 active:scale-95 transition-all"
              style={{ background: GRAD[period], boxShadow: SHADOW[period] }}
            >
              {busy
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Share2 className="w-4 h-4" />}
              Share to Story
            </button>
          </div>

          <p className="text-white/22 text-[10px] text-center pb-4 px-6 leading-relaxed">
            On mobile: "Share to Story" opens Instagram, Facebook, Snapchat &amp; more.
            On desktop: image downloads — then upload to your story manually.
          </p>
        </div>
      </div>
    </div>
  );
}
