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

function fmtTime(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

// ── Theme constants ────────────────────────────────────────────────────────
const THEMES = {
  day:   { bg: "linear-gradient(160deg,#07061a 0%,#0d0b28 100%)", accent: "#8b5cf6", accentBright: "#c4b5fd", pill: "rgba(139,92,246,0.20)", pillBorder: "rgba(139,92,246,0.45)", label: "TODAY",      glow: "rgba(109,40,217,0.35)",  btnGrad: "linear-gradient(135deg,#7c3aed,#8b5cf6)", btnShadow: "0 4px 22px rgba(109,40,217,0.50)" },
  week:  { bg: "linear-gradient(160deg,#030d1e 0%,#061529 100%)", accent: "#3b82f6", accentBright: "#93c5fd", pill: "rgba(59,130,246,0.20)",  pillBorder: "rgba(59,130,246,0.45)",  label: "THIS WEEK",  glow: "rgba(29,78,216,0.35)",   btnGrad: "linear-gradient(135deg,#1d4ed8,#3b82f6)", btnShadow: "0 4px 22px rgba(29,78,216,0.50)" },
  month: { bg: "linear-gradient(160deg,#0d0414 0%,#160720 100%)", accent: "#ec4899", accentBright: "#f9a8d4", pill: "rgba(236,72,153,0.20)", pillBorder: "rgba(236,72,153,0.45)", label: "THIS MONTH", glow: "rgba(157,23,77,0.35)",   btnGrad: "linear-gradient(135deg,#be185d,#ec4899)", btnShadow: "0 4px 22px rgba(157,23,77,0.50)" },
};

function buildBarDays(logs: DailyLog[], count: number) {
  const DN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (count - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { minutes: logs.find((l) => l.date === key)?.studyMinutes ?? 0, isToday: i === count - 1, dayName: DN[d.getDay()], dayNum: d.getDate() };
  });
}

// ── Mini Preview — matches the canvas card's aesthetic ────────────────────
function MiniPreview({ period, userName, userGrade, studyMinutes, streak, tasksCompleted, notesRead, improvePct, dailyLogs }: {
  period: Period; userName: string; userGrade: string;
  studyMinutes: number; streak: number; tasksCompleted: number; notesRead: number; improvePct: number;
  dailyLogs: DailyLog[];
}) {
  const t = THEMES[period];
  const isMonth = period === "month";
  const days = buildBarDays(dailyLogs, isMonth ? 30 : 7);
  const maxM = Math.max(...days.map((d) => d.minutes), 1);
  const CHART_H = 56;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const F = "system-ui,-apple-system,Arial,sans-serif";

  return (
    <div style={{ background: t.bg, borderRadius: 18, overflow: "hidden", fontFamily: F, color: "#fff", width: "100%", position: "relative" }}>
      {/* Top accent line */}
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${t.accent},transparent)` }} />

      <div style={{ padding: "14px 16px 14px" }}>
        {/* Brand row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, letterSpacing: -0.2 }}>Student Hub</span>
          <div style={{ background: t.pill, border: `1px solid ${t.pillBorder}`, borderRadius: 20, padding: "2px 10px", fontSize: 8.5, fontWeight: 800, color: t.accentBright, letterSpacing: 1 }}>
            {t.label}
          </div>
        </div>

        {/* Thin divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 10 }} />

        {/* Date */}
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.30)", marginBottom: 5 }}>{dateStr}</div>

        {/* Name — hero */}
        <div style={{ fontSize: Math.max(16, Math.min(22, 22 - Math.max(0, userName.length - 12))), fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {userName || "Student"}
        </div>
        {userGrade && (
          <div style={{ display: "inline-block", background: `${t.accent}28`, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 600, color: t.accentBright, marginBottom: 10 }}>
            Grade {userGrade}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: `${t.accent}30`, marginBottom: 10 }} />

        {/* Study time */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.32)", letterSpacing: 1, marginBottom: 3 }}>STUDY TIME</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -1, textShadow: `0 0 20px ${t.accent}` }}>{fmtTime(studyMinutes)}</span>
            {improvePct !== 0 && (
              <div style={{ background: improvePct > 0 ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)", border: `1px solid ${improvePct > 0 ? "rgba(52,211,153,0.40)" : "rgba(248,113,113,0.40)"}`, borderRadius: 20, padding: "3px 8px", fontSize: 11, fontWeight: 800, color: improvePct > 0 ? "#34d399" : "#f87171", whiteSpace: "nowrap" }}>
                {improvePct > 0 ? "+" : ""}{improvePct}%
              </div>
            )}
          </div>
        </div>

        {/* Bar chart */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 7.5, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: 0.8, marginBottom: 5 }}>
            {isMonth ? "LAST 30 DAYS" : "LAST 7 DAYS"}
          </div>
          <div style={{ display: "flex", gap: isMonth ? 1.5 : 5, alignItems: "flex-end", height: CHART_H + 14 }}>
            {days.map(({ minutes, isToday, dayName, dayNum }, i) => {
              const h = Math.max((minutes / maxM) * CHART_H, minutes > 0 ? 4 : 1.5);
              let lbl = "";
              if (isMonth) { if (isToday) lbl = "Now"; else if (dayNum === 1 || dayNum === 14) lbl = String(dayNum); }
              else { lbl = isToday ? "Today" : dayName; }
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: "100%", height: CHART_H, display: "flex", alignItems: "flex-end" }}>
                    <div style={{ width: "100%", height: h, borderRadius: isMonth ? 2 : 4, background: isToday ? t.accentBright : minutes > 0 ? t.accent + "cc" : "rgba(255,255,255,0.08)", boxShadow: isToday ? `0 0 8px ${t.accent}` : "none" }} />
                  </div>
                  <span style={{ fontSize: isMonth ? 5 : 7, color: isToday ? t.accentBright : lbl ? "rgba(255,255,255,0.32)" : "transparent", fontWeight: isToday ? 700 : 400 }}>{lbl || "·"}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[{ v: `${streak}d`, l: "STREAK" }, { v: String(tasksCompleted), l: "TASKS" }, { v: String(notesRead), l: "NOTES" }].map(({ v, l }) => (
            <div key={l} style={{ flex: 1, background: `${t.accent}14`, border: `1px solid ${t.accent}30`, borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.32)", letterSpacing: 0.5 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ height: 1, background: `${t.accent}22`, marginBottom: 8 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>Student Hub Nepal</div>
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.25)" }}>studenthubnp.com</div>
          </div>
          <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.25)" }}>Study. Rank. Succeed.</div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${t.accent},transparent)` }} />
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
type ToastState = { kind: "success" | "info" | "error"; msg: string } | null;

// ── Modal ──────────────────────────────────────────────────────────────────
export default function ShareCardModal({ open, onClose, userName, userGrade, stats, dailyLogs }: ShareCardModalProps) {
  const [period, setPeriod] = useState<Period>("week");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => { setToast(null); }, [period]);

  const { studyMinutes, tasksCompleted, notesRead, improvePct } = getPeriodStats(period, stats, dailyLogs);
  const t = THEMES[period];

  const showToast = useCallback((kind: "success" | "info" | "error", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const generateBlob = useCallback(async (): Promise<Blob | null> => {
    try {
      return await makeShareCard({ name: userName, grade: userGrade, period, studyMinutes, tasksCompleted, notesRead, streak: stats.streak, totalStudyTime: stats.totalStudyTime, improvePct, dailyLogs });
    } catch (e) { console.error("makeShareCard:", e); return null; }
  }, [userName, userGrade, period, studyMinutes, tasksCompleted, notesRead, stats, improvePct, dailyLogs]);

  const doDownload = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studenthub-${period}-report.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [period]);

  const handleDownload = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await generateBlob();
      if (!blob) { showToast("error", "Could not generate card. Try again."); return; }
      doDownload(blob);
      showToast("success", "Saved! Instagram → + → Story → pick from gallery.");
    } catch { showToast("error", "Download failed."); }
    finally { setBusy(false); }
  }, [generateBlob, doDownload, showToast]);

  const handleShare = useCallback(async () => {
    setBusy(true);
    try {
      const blob = await generateBlob();
      if (!blob) { showToast("error", "Could not generate card. Try again."); return; }
      const file = new File([blob], `studenthub-${period}-report.png`, { type: "image/png" });
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Study Report – Student Hub Nepal", text: "Check my study progress! 📊 studenthubnp.com" });
        showToast("success", "Shared!");
      } else {
        doDownload(blob);
        showToast("info", "Downloaded! On Instagram → + → Story → choose from gallery.");
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
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full sm:max-w-sm bg-[#09090f] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-sm tracking-tight">Share Report Card</h2>
            <p className="text-white/30 text-[11px] mt-0.5">1080 × 1920 — Instagram Story ready</p>
          </div>
          <button onClick={onClose} className="text-white/35 hover:text-white/75 p-1.5 rounded-xl hover:bg-white/8 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Period toggle */}
          <div className="flex gap-2 px-5 pt-4 pb-3">
            {(["day","week","month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${period === p ? "text-white shadow-lg" : "bg-white/6 text-white/40 hover:bg-white/10 hover:text-white/60"}`}
                style={period === p ? { background: THEMES[p].btnGrad, boxShadow: THEMES[p].btnShadow } : undefined}
              >
                {p === "day" ? "Today" : p === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>

          {/* Preview card */}
          <div className="px-5 pb-2">
            <MiniPreview
              period={period} userName={userName} userGrade={userGrade}
              studyMinutes={studyMinutes} streak={stats.streak}
              tasksCompleted={tasksCompleted} notesRead={notesRead}
              improvePct={improvePct} dailyLogs={dailyLogs}
            />
            <p className="text-white/20 text-[9.5px] text-center mt-2">
              Preview — downloaded image is crisp 1080 × 1920 px
            </p>
          </div>

          {/* Toast */}
          {toast && (
            <div className={`mx-5 mb-3 px-4 py-2.5 rounded-2xl text-xs font-medium flex items-start gap-2.5 ${
              toast.kind === "success" ? "bg-emerald-500/12 border border-emerald-500/25 text-emerald-300"
              : toast.kind === "error" ? "bg-red-500/12 border border-red-500/25 text-red-300"
              : "bg-sky-500/12 border border-sky-500/25 text-sky-200"
            }`}>
              <span className="flex-shrink-0 mt-px">{toast.kind === "success" ? "✓" : toast.kind === "error" ? "✕" : "i"}</span>
              <span>{toast.msg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="px-5 pb-4 flex gap-3">
            <button
              onClick={handleDownload} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl font-semibold text-sm bg-white/8 hover:bg-white/12 text-white/80 hover:text-white border border-white/8 disabled:opacity-40 active:scale-95 transition-all"
            >
              {busy ? <span className="w-3.5 h-3.5 border-2 border-white/25 border-t-white/70 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
              Download
            </button>
            <button
              onClick={handleShare} disabled={busy}
              className="flex-[1.6] flex items-center justify-center gap-1.5 py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-40 active:scale-95 transition-all"
              style={{ background: t.btnGrad, boxShadow: t.btnShadow }}
            >
              {busy ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Share2 className="w-4 h-4" />}
              Share to Story
            </button>
          </div>

          <p className="text-white/18 text-[9px] text-center pb-5 px-6 leading-relaxed">
            On mobile, tap Share to open Instagram, Facebook &amp; more.
            On desktop, the image downloads — then add to your story.
          </p>
        </div>
      </div>
    </div>
  );
}
