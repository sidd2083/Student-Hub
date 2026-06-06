import { useState, useCallback, useEffect } from "react";
import { X, Download, Share2 } from "lucide-react";
import { makeShareCard } from "@/components/makeShareCard";

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
  const badges: { label: string }[] = [];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekMins = logs
    .filter((l) => new Date(l.date) >= weekAgo)
    .reduce((s, l) => s + l.studyMinutes, 0);
  const totalTasks = logs.reduce((s, l) => s + l.tasksCompleted, 0);

  if (stats.streak >= 3)            badges.push({ label: "3-Day Streak" });
  if (stats.streak >= 7)            badges.push({ label: "Week Warrior" });
  if (stats.streak >= 30)           badges.push({ label: "Month Master" });
  if (stats.totalStudyTime >= 60)   badges.push({ label: "1 Hour Legend" });
  if (stats.totalStudyTime >= 600)  badges.push({ label: "10 Hours Total" });
  if (stats.totalStudyTime >= 3000) badges.push({ label: "50 Hours Club" });
  if (totalTasks >= 5)              badges.push({ label: "Task Crusher" });
  if (weekMins >= 120)              badges.push({ label: "Consistent Learner" });
  return badges;
}

function getPeriodStats(period: Period, stats: StudyStats, dailyLogs: DailyLog[]) {
  const today = new Date().toISOString().slice(0, 10);
  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const prevCutoff = new Date();
  prevCutoff.setDate(prevCutoff.getDate() - days * 2);

  const pLogs = dailyLogs.filter((l) => new Date(l.date) >= cutoff);
  const prevLogs = dailyLogs.filter(
    (l) => new Date(l.date) >= prevCutoff && new Date(l.date) < cutoff
  );

  const studyMinutes =
    period === "day"
      ? stats.lastActiveDate === today
        ? stats.todayStudyTime
        : pLogs[0]?.studyMinutes ?? 0
      : pLogs.reduce((s, l) => s + l.studyMinutes, 0);

  const prevMins = prevLogs.reduce((s, l) => s + l.studyMinutes, 0);
  const tasksCompleted =
    period === "day"
      ? pLogs[0]?.tasksCompleted ?? 0
      : pLogs.reduce((s, l) => s + l.tasksCompleted, 0);
  const notesRead =
    period === "day"
      ? pLogs[0]?.notesViewed ?? 0
      : pLogs.reduce((s, l) => s + l.notesViewed, 0);
  const improvePct =
    prevMins > 0
      ? Math.round(((studyMinutes - prevMins) / prevMins) * 100)
      : studyMinutes > 0
      ? 100
      : 0;

  return { studyMinutes, tasksCompleted, notesRead, improvePct };
}

function fmtTime(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

// ── Small in-modal preview (purely decorative, NOT used for capture) ───────

const PREVIEW_THEMES: Record<Period, { bg: string; accent: string; pill: string }> = {
  day:   { bg: "linear-gradient(160deg,#120d2a,#1e1545)", accent: "#9b72ff", pill: "rgba(155,114,255,0.22)" },
  week:  { bg: "linear-gradient(160deg,#08152e,#0d2347)", accent: "#3b82f6", pill: "rgba(59,130,246,0.22)" },
  month: { bg: "linear-gradient(160deg,#180520,#250c3a)", accent: "#ec4899", pill: "rgba(236,72,153,0.22)" },
};
const PERIOD_LABELS: Record<Period, string> = { day: "TODAY", week: "THIS WEEK", month: "THIS MONTH" };
const GRAD: Record<Period, string> = {
  day:   "linear-gradient(135deg,#7c6fff,#a78bfa)",
  week:  "linear-gradient(135deg,#0ea5e9,#38bdf8)",
  month: "linear-gradient(135deg,#ec4899,#f472b6)",
};
const SHADOW: Record<Period, string> = {
  day:   "0 4px 20px rgba(124,111,255,0.45)",
  week:  "0 4px 20px rgba(14,165,233,0.45)",
  month: "0 4px 20px rgba(236,72,153,0.45)",
};

function buildBarDays(logs: DailyLog[], count: number) {
  const DAY = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      minutes: logs.find((l) => l.date === key)?.studyMinutes ?? 0,
      isToday: i === count - 1,
      dayName: DAY[d.getDay()],
      dayNum: d.getDate(),
    };
  });
}

function MiniPreview({
  period, userName, userGrade, studyMinutes, streak, tasksCompleted, notesRead, dailyLogs,
}: {
  period: Period; userName: string; userGrade: string;
  studyMinutes: number; streak: number; tasksCompleted: number; notesRead: number;
  dailyLogs: DailyLog[];
}) {
  const t = PREVIEW_THEMES[period];
  const isMonth = period === "month";
  const days = buildBarDays(dailyLogs, isMonth ? 30 : 7);
  const maxM = Math.max(...days.map((d) => d.minutes), 1);
  const CHART_H = 52;

  return (
    <div
      style={{
        background: t.bg,
        borderRadius: 20,
        padding: "18px 18px 14px",
        fontFamily: "system-ui, -apple-system, Arial, sans-serif",
        color: "#fff",
        width: "100%",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>SH</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>Student Hub</span>
        </div>
        <div style={{ background: t.pill, border: `1px solid ${t.accent}55`, borderRadius: 20, padding: "3px 10px", fontSize: 8.5, fontWeight: 800, color: t.accent, letterSpacing: 1 }}>
          {PERIOD_LABELS[period]}
        </div>
      </div>

      {/* Name */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName || "Student"}</div>
        {userGrade && <div style={{ fontSize: 11, fontWeight: 600, color: t.accent, marginTop: 2 }}>Grade {userGrade}</div>}
      </div>

      {/* Study time */}
      <div style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${t.accent}44`, borderRadius: 12, padding: "10px 13px", marginBottom: 8 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.40)", letterSpacing: 1, marginBottom: 4 }}>STUDY TIME</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{fmtTime(studyMinutes)}</div>
      </div>

      {/* Mini bar chart */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "8px 10px 6px", marginBottom: 8 }}>
        <div style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 0.8, marginBottom: 6 }}>{isMonth ? "LAST 30 DAYS" : "LAST 7 DAYS"}</div>
        <div style={{ display: "flex", gap: isMonth ? 1.5 : 5, alignItems: "flex-end", height: CHART_H + 14 }}>
          {days.map(({ minutes, isToday, dayName, dayNum }, i) => {
            const h = Math.max((minutes / maxM) * CHART_H, minutes > 0 ? 4 : 1.5);
            let lbl = "";
            if (isMonth) {
              if (isToday) lbl = "Now";
              else if (dayNum === 1 || dayNum === 14) lbl = String(dayNum);
            } else {
              lbl = isToday ? "Today" : dayName;
            }
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", height: CHART_H, display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: h, borderRadius: isMonth ? 2 : 3, background: isToday ? t.accent : minutes > 0 ? t.accent + "bb" : "rgba(255,255,255,0.10)" }} />
                </div>
                <span style={{ fontSize: isMonth ? 5.5 : 7.5, color: isToday ? t.accent : lbl ? "rgba(255,255,255,0.38)" : "transparent", fontWeight: isToday ? 700 : 400 }}>{lbl || "·"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 6 }}>
        {[{ v: `${streak}d`, l: "STREAK" }, { v: String(tasksCompleted), l: "TASKS" }, { v: String(notesRead), l: "NOTES" }].map(({ v, l }) => (
          <div key={l} style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: `1px solid ${t.accent}33`, borderRadius: 9, padding: "7px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{v}</div>
            <div style={{ fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.accent }}>Student Hub Nepal</span>
        <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.30)" }}>studenthubnp.com</span>
      </div>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
type ToastState = { kind: "success" | "info" | "error"; msg: string } | null;

// ── Modal ──────────────────────────────────────────────────────────────────
export default function ShareCardModal({
  open, onClose, userName, userGrade, stats, dailyLogs,
}: ShareCardModalProps) {
  const [period, setPeriod] = useState<Period>("week");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => { setToast(null); }, [period]);

  const { studyMinutes, tasksCompleted, notesRead, improvePct } =
    getPeriodStats(period, stats, dailyLogs);
  const badges = getBadges(stats, dailyLogs);

  const showToast = useCallback(
    (kind: "success" | "info" | "error", msg: string) => {
      setToast({ kind, msg });
      setTimeout(() => setToast(null), 4500);
    },
    []
  );

  /** Generate the card using Canvas 2D — no html2canvas, pixel-perfect */
  const generateBlob = useCallback(async (): Promise<Blob | null> => {
    try {
      return await makeShareCard({
        name: userName,
        grade: userGrade,
        period,
        studyMinutes,
        tasksCompleted,
        notesRead,
        streak: stats.streak,
        totalStudyTime: stats.totalStudyTime,
        improvePct,
        dailyLogs,
        badges,
      });
    } catch (e) {
      console.error("makeShareCard failed", e);
      return null;
    }
  }, [userName, userGrade, period, studyMinutes, tasksCompleted, notesRead, stats, improvePct, dailyLogs, badges]);

  const doDownload = useCallback((blob: Blob) => {
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
      const blob = await generateBlob();
      if (!blob) { showToast("error", "Could not generate card. Try again."); return; }
      doDownload(blob);
      showToast("success", "Saved! Instagram \u2192 + \u2192 Story \u2192 pick from gallery.");
    } catch { showToast("error", "Download failed. Try again."); }
    finally { setBusy(false); }
  }, [generateBlob, doDownload, showToast]);

  const handleShare = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await generateBlob();
      if (!blob) { showToast("error", "Could not generate card. Try again."); return; }
      const file = new File([blob], `studenthub-${period}-report.png`, { type: "image/png" });

      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `My Study Report – Student Hub Nepal`,
          text: "Check my study progress! 📊 studenthubnp.com",
        });
        showToast("success", "Shared!");
      } else {
        doDownload(blob);
        showToast("info", "Downloaded! On Instagram \u2192 + \u2192 Story \u2192 choose from gallery.");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      showToast("error", "Share failed. Use Download instead.");
    } finally { setBusy(false); }
  }, [generateBlob, doDownload, period, showToast]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.84)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full sm:max-w-sm bg-[#0d0d14] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-sm">Share Report Card</h2>
            <p className="text-white/35 text-[11px] mt-0.5">1080 × 1920 px — Instagram Story ready</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pb-1">
          {/* Period toggle */}
          <div className="flex gap-2 px-5 pt-4 pb-3">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  period === p ? "text-gray-900 shadow" : "bg-white/8 text-white/45 hover:bg-white/12 hover:text-white/70"
                }`}
                style={period === p ? { background: GRAD[p] } : undefined}
              >
                {p === "day" ? "Today" : p === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>

          {/* Mini preview */}
          <div className="px-5 pb-3">
            <MiniPreview
              period={period}
              userName={userName}
              userGrade={userGrade}
              studyMinutes={studyMinutes}
              streak={stats.streak}
              tasksCompleted={tasksCompleted}
              notesRead={notesRead}
              dailyLogs={dailyLogs}
            />
            <p className="text-white/25 text-[10px] text-center mt-2">
              Preview · downloaded image is 1080 × 1920 px
            </p>
          </div>

          {/* Toast */}
          {toast && (
            <div
              className={`mx-5 mb-3 px-4 py-2.5 rounded-2xl text-xs font-medium flex items-start gap-2 ${
                toast.kind === "success"
                  ? "bg-green-500/15 border border-green-500/30 text-green-300"
                  : toast.kind === "error"
                  ? "bg-red-500/15 border border-red-500/30 text-red-300"
                  : "bg-blue-400/15 border border-blue-400/30 text-blue-200"
              }`}
            >
              <span className="flex-shrink-0 mt-0.5">
                {toast.kind === "success" ? "✅" : toast.kind === "error" ? "❌" : "ℹ️"}
              </span>
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
            Mobile: opens Instagram, Facebook, Snapchat &amp; more.
            Desktop: downloads the image — then upload to your story.
          </p>
        </div>
      </div>
    </div>
  );
}
