import { forwardRef } from "react";

interface ShareCardProps {
  name: string;
  grade: string;
  period: "day" | "week" | "month";
  studyMinutes: number;
  tasksCompleted: number;
  notesRead: number;
  streak: number;
  totalStudyTime: number;
  improvePct: number;
  dailyLogs: { date: string; studyMinutes: number }[];
  badges: { icon: string; label: string }[];
}

function fmtTime(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

const PERIOD_LABEL: Record<string, string> = {
  day: "TODAY",
  week: "THIS WEEK",
  month: "THIS MONTH",
};

const THEMES = {
  day: {
    bg: "linear-gradient(145deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    accent: "#7c6fff",
    accentGlow: "rgba(124,111,255,0.35)",
    pill: "rgba(124,111,255,0.22)",
    pillText: "#c4baff",
    bar: "#7c6fff",
    barDim: "rgba(124,111,255,0.22)",
    badge: "rgba(124,111,255,0.18)",
    badgeText: "#c4baff",
    statCard: "rgba(255,255,255,0.06)",
    statBorder: "rgba(255,255,255,0.09)",
    highlight: "#a78bfa",
  },
  week: {
    bg: "linear-gradient(145deg, #0a1628 0%, #0d2b4b 50%, #0a3d62 100%)",
    accent: "#38bdf8",
    accentGlow: "rgba(56,189,248,0.35)",
    pill: "rgba(56,189,248,0.18)",
    pillText: "#7dd3fc",
    bar: "#38bdf8",
    barDim: "rgba(56,189,248,0.18)",
    badge: "rgba(56,189,248,0.14)",
    badgeText: "#7dd3fc",
    statCard: "rgba(255,255,255,0.05)",
    statBorder: "rgba(255,255,255,0.08)",
    highlight: "#38bdf8",
  },
  month: {
    bg: "linear-gradient(145deg, #1a0533 0%, #2d1b69 45%, #0f3460 100%)",
    accent: "#f472b6",
    accentGlow: "rgba(244,114,182,0.35)",
    pill: "rgba(244,114,182,0.18)",
    pillText: "#f9a8d4",
    bar: "#f472b6",
    barDim: "rgba(244,114,182,0.18)",
    badge: "rgba(244,114,182,0.14)",
    badgeText: "#f9a8d4",
    statCard: "rgba(255,255,255,0.05)",
    statBorder: "rgba(255,255,255,0.08)",
    highlight: "#f472b6",
  },
};

function MiniBarChart({
  logs,
  period,
  theme,
}: {
  logs: { date: string; studyMinutes: number }[];
  period: "day" | "week" | "month";
  theme: (typeof THEMES)["day"];
}) {
  const count = period === "day" ? 7 : period === "week" ? 7 : 30;
  const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const days = Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const log = logs.find((l) => l.date === key);
    return {
      label: period === "month" ? String(d.getDate()) : DAYS_SHORT[d.getDay()],
      minutes: log?.studyMinutes ?? 0,
      isToday: i === count - 1,
    };
  });

  const max = Math.max(...days.map((d) => d.minutes), 1);
  const chartH = 52;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: period === "month" ? 3 : 6, height: chartH + 18 }}>
      {days.map(({ label, minutes, isToday }, idx) => {
        const barH = Math.max((minutes / max) * chartH, minutes > 0 ? 4 : 2);
        const showLabel = period !== "month" || isToday || Number(label) === 1 || Number(label) % 7 === 0;
        return (
          <div
            key={idx}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 3 }}
          >
            <div style={{ width: "100%", height: chartH, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: barH,
                  borderRadius: "3px 3px 0 0",
                  background: isToday
                    ? theme.accent
                    : minutes > 0
                    ? theme.bar
                    : theme.barDim,
                  opacity: isToday ? 1 : minutes > 0 ? 0.65 : 0.3,
                  boxShadow: isToday ? `0 0 8px ${theme.accentGlow}` : "none",
                  transition: "all 0.3s",
                }}
              />
            </div>
            {showLabel && (
              <span
                style={{
                  fontSize: period === "month" ? 7 : 9,
                  color: isToday ? theme.accent : "rgba(255,255,255,0.35)",
                  fontWeight: isToday ? 700 : 400,
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  (
    {
      name,
      grade,
      period,
      studyMinutes,
      tasksCompleted,
      notesRead,
      streak,
      totalStudyTime,
      improvePct,
      dailyLogs,
      badges,
    },
    ref
  ) => {
    const theme = THEMES[period];
    const label = PERIOD_LABEL[period];
    const showBars = period === "week" || period === "month";
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

    return (
      <div
        ref={ref}
        style={{
          width: 390,
          height: 693,
          background: theme.bg,
          borderRadius: 28,
          overflow: "hidden",
          position: "relative",
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: "28px 28px 22px",
          boxSizing: "border-box",
        }}
      >
        {/* Glow orb top-right */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: theme.accentGlow,
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />
        {/* Glow orb bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -40,
            left: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: theme.accentGlow,
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />

        {/* ── TOP ROW: branding + period pill ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: theme.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                boxShadow: `0 0 12px ${theme.accentGlow}`,
              }}
            >
              📘
            </div>
            <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>
              Student Hub
            </span>
          </div>
          <div
            style={{
              background: theme.pill,
              border: `1px solid ${theme.accent}40`,
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 10,
              fontWeight: 800,
              color: theme.pillText,
              letterSpacing: 1.2,
            }}
          >
            {label}
          </div>
        </div>

        {/* ── STUDENT INFO ── */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: 18 }}>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 500, margin: 0, marginBottom: 4, letterSpacing: 0.3 }}>
            Study Report · {dateStr}
          </p>
          <h2 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1.15, letterSpacing: -0.5 }}>
            {name || "Student"}
          </h2>
          {grade && (
            <p style={{ color: theme.accent, fontSize: 13, fontWeight: 600, margin: 0, marginTop: 3, letterSpacing: 0.2 }}>
              Grade {grade}
            </p>
          )}
        </div>

        {/* ── HERO STAT: Study Time ── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${theme.accent}30`,
            borderRadius: 20,
            padding: "18px 22px",
            marginBottom: 14,
            backdropFilter: "blur(10px)",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, margin: 0, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            ⏱ Study Time
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                letterSpacing: -2,
                textShadow: `0 0 30px ${theme.accentGlow}`,
              }}
            >
              {fmtTime(studyMinutes)}
            </span>
            {improvePct !== 0 && (
              <div
                style={{
                  background: improvePct > 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                  border: `1px solid ${improvePct > 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  borderRadius: 12,
                  padding: "5px 10px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: improvePct > 0 ? "#34d399" : "#f87171",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {improvePct > 0 ? "↑" : "↓"} {Math.abs(improvePct)}%
              </div>
            )}
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: 0, marginTop: 4 }}>
            {fmtTime(totalStudyTime)} total all time
          </p>
        </div>

        {/* ── BAR CHART (week/month) ── */}
        {showBars && (
          <div
            style={{
              position: "relative",
              zIndex: 1,
              background: "rgba(255,255,255,0.05)",
              border: `1px solid rgba(255,255,255,0.07)`,
              borderRadius: 16,
              padding: "14px 16px",
              marginBottom: 14,
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, margin: 0, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {period === "week" ? "Last 7 Days" : "Last 30 Days"}
            </p>
            <MiniBarChart logs={dailyLogs} period={period} theme={theme} />
          </div>
        )}

        {/* ── STATS ROW ── */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 10, marginBottom: 14 }}>
          {[
            { icon: "🔥", value: `${streak}d`, label: "Streak" },
            { icon: "✅", value: String(tasksCompleted), label: "Tasks" },
            { icon: "📚", value: String(notesRead), label: "Notes" },
          ].map(({ icon, value, label: lbl }) => (
            <div
              key={lbl}
              style={{
                flex: 1,
                background: theme.statCard,
                border: `1px solid ${theme.statBorder}`,
                borderRadius: 14,
                padding: "12px 8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4, lineHeight: 1 }}>{icon}</div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, lineHeight: 1, marginBottom: 3 }}>{value}</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* ── BADGES ── */}
        {badges.length > 0 && (
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {badges.slice(0, 4).map((b) => (
              <div
                key={b.label}
                style={{
                  background: theme.badge,
                  border: `1px solid ${theme.accent}30`,
                  borderRadius: 20,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: theme.badgeText,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {b.icon} {b.label}
              </div>
            ))}
          </div>
        )}

        {/* ── SPACER ── */}
        <div style={{ flex: 1 }} />

        {/* ── BOTTOM: Branding ── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 14,
          }}
        >
          <div>
            <p
              style={{
                color: theme.accent,
                fontSize: 14,
                fontWeight: 800,
                margin: 0,
                letterSpacing: -0.3,
              }}
            >
              Student Hub Nepal
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, margin: 0, marginTop: 1 }}>
              studenthubnp.com
            </p>
          </div>
          <div
            style={{
              background: theme.pill,
              border: `1px solid ${theme.accent}35`,
              borderRadius: 10,
              padding: "5px 12px",
              fontSize: 10,
              fontWeight: 700,
              color: theme.pillText,
              letterSpacing: 0.4,
            }}
          >
            Study. Rank. Succeed. 🚀
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";
export default ShareCard;
