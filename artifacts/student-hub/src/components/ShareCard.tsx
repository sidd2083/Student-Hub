import { forwardRef } from "react";

export interface ShareCardProps {
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

// ── Guaranteed cross-platform font stack (no web fonts needed)
const FONT = `"Helvetica Neue", Helvetica, Arial, sans-serif`;

function fmtTime(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

const PERIOD_LABEL: Record<string, string> = {
  day: "TODAY",
  week: "THIS WEEK",
  month: "THIS MONTH",
};

// Glow baked into bg gradient — no filter:blur needed (html2canvas-safe)
const THEMES = {
  day: {
    bg: `radial-gradient(ellipse at 85% 8%, rgba(124,111,255,0.32) 0%, transparent 48%),
         radial-gradient(ellipse at 12% 92%, rgba(124,111,255,0.22) 0%, transparent 40%),
         linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #1a1040 100%)`,
    accent: "#a78bfa",
    accentRgb: "167,139,250",
    pill: "rgba(167,139,250,0.20)",
    pillText: "#ddd6fe",
    bar: "#a78bfa",
    barActive: "#c4b5fd",
    barDim: "rgba(167,139,250,0.15)",
    statCard: "rgba(255,255,255,0.08)",
    statBorder: "rgba(167,139,250,0.22)",
    badgeBg: "rgba(167,139,250,0.18)",
    badgeText: "#ddd6fe",
    divider: "rgba(167,139,250,0.20)",
    heroCard: "rgba(167,139,250,0.10)",
    heroBorder: "rgba(167,139,250,0.28)",
    chartCard: "rgba(255,255,255,0.05)",
  },
  week: {
    bg: `radial-gradient(ellipse at 85% 8%, rgba(56,189,248,0.28) 0%, transparent 48%),
         radial-gradient(ellipse at 12% 92%, rgba(56,189,248,0.18) 0%, transparent 40%),
         linear-gradient(160deg, #071428 0%, #0c2444 55%, #0a2e58 100%)`,
    accent: "#38bdf8",
    accentRgb: "56,189,248",
    pill: "rgba(56,189,248,0.18)",
    pillText: "#bae6fd",
    bar: "#38bdf8",
    barActive: "#7dd3fc",
    barDim: "rgba(56,189,248,0.15)",
    statCard: "rgba(255,255,255,0.07)",
    statBorder: "rgba(56,189,248,0.22)",
    badgeBg: "rgba(56,189,248,0.15)",
    badgeText: "#bae6fd",
    divider: "rgba(56,189,248,0.20)",
    heroCard: "rgba(56,189,248,0.10)",
    heroBorder: "rgba(56,189,248,0.28)",
    chartCard: "rgba(255,255,255,0.05)",
  },
  month: {
    bg: `radial-gradient(ellipse at 85% 8%, rgba(244,114,182,0.28) 0%, transparent 48%),
         radial-gradient(ellipse at 12% 92%, rgba(244,114,182,0.18) 0%, transparent 40%),
         linear-gradient(160deg, #160524 0%, #2d1b69 50%, #0f3060 100%)`,
    accent: "#f472b6",
    accentRgb: "244,114,182",
    pill: "rgba(244,114,182,0.18)",
    pillText: "#fbcfe8",
    bar: "#f472b6",
    barActive: "#f9a8d4",
    barDim: "rgba(244,114,182,0.12)",
    statCard: "rgba(255,255,255,0.07)",
    statBorder: "rgba(244,114,182,0.22)",
    badgeBg: "rgba(244,114,182,0.15)",
    badgeText: "#fbcfe8",
    divider: "rgba(244,114,182,0.20)",
    heroCard: "rgba(244,114,182,0.10)",
    heroBorder: "rgba(244,114,182,0.28)",
    chartCard: "rgba(255,255,255,0.05)",
  },
};

function buildDays(logs: { date: string; studyMinutes: number }[], count: number) {
  const DNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      minutes: logs.find((l) => l.date === key)?.studyMinutes ?? 0,
      isToday: i === count - 1,
      dayName: DNAMES[d.getDay()],
      dayNum: d.getDate(),
    };
  });
}

function WeekBars({
  logs,
  theme,
  chartH,
}: {
  logs: { date: string; studyMinutes: number }[];
  theme: (typeof THEMES)["day"];
  chartH: number;
}) {
  const days = buildDays(logs, 7);
  const max = Math.max(...days.map((d) => d.minutes), 1);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: chartH + 22 }}>
      {days.map(({ minutes, isToday, dayName }, i) => {
        const h = Math.max((minutes / max) * chartH, minutes > 0 ? 5 : 2);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{ width: "100%", height: chartH, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: "3px 3px 0 0",
                  background: isToday ? theme.barActive : minutes > 0 ? theme.bar : theme.barDim,
                  opacity: isToday ? 1 : minutes > 0 ? 0.80 : 0.35,
                }}
              />
            </div>
            <span style={{ fontSize: 10, fontWeight: isToday ? 700 : 500, color: isToday ? theme.accent : "rgba(255,255,255,0.45)", lineHeight: 1, fontFamily: FONT }}>
              {isToday ? "Today" : dayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MonthBars({
  logs,
  theme,
  chartH,
}: {
  logs: { date: string; studyMinutes: number }[];
  theme: (typeof THEMES)["day"];
  chartH: number;
}) {
  const days = buildDays(logs, 30);
  const max = Math.max(...days.map((d) => d.minutes), 1);
  // show label only for 1st, 7th, 14th, 21st, today
  const showLabel = (dayNum: number, isToday: boolean) =>
    isToday || dayNum === 1 || dayNum === 7 || dayNum === 14 || dayNum === 21;

  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: chartH + 18 }}>
      {days.map(({ minutes, isToday, dayNum }, i) => {
        const h = Math.max((minutes / max) * chartH, minutes > 0 ? 4 : 1.5);
        const show = showLabel(dayNum, isToday);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", height: chartH, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: "2px 2px 0 0",
                  background: isToday ? theme.barActive : minutes > 0 ? theme.bar : theme.barDim,
                  opacity: isToday ? 1 : minutes > 0 ? 0.72 : 0.25,
                }}
              />
            </div>
            <span style={{ fontSize: 7, fontWeight: isToday ? 700 : 400, color: isToday ? theme.accent : show ? "rgba(255,255,255,0.50)" : "transparent", lineHeight: 1, fontFamily: FONT }}>
              {show ? (isToday ? "Now" : String(dayNum)) : "·"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ name, grade, period, studyMinutes, tasksCompleted, notesRead, streak, totalStudyTime, improvePct, dailyLogs, badges }, ref) => {
    const theme = THEMES[period];
    const label = PERIOD_LABEL[period];
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const chartTitle = period === "month" ? "Last 30 Days" : "Last 7 Days";
    const CHART_H = 68;

    return (
      <div
        ref={ref}
        style={{
          width: 390,
          height: 693,
          background: theme.bg,
          borderRadius: 24,
          overflow: "hidden",
          position: "relative",
          fontFamily: FONT,
          display: "flex",
          flexDirection: "column",
          padding: "24px 24px 18px",
          boxSizing: "border-box",
          color: "#fff",
        }}
      >
        {/* ── TOP: Brand + Period ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: theme.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              📘
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.88)", fontFamily: FONT }}>
              Student Hub
            </span>
          </div>
          <div
            style={{
              background: theme.pill,
              border: `1.5px solid rgba(${theme.accentRgb},0.38)`,
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 9,
              fontWeight: 800,
              color: theme.pillText,
              letterSpacing: 1.3,
              fontFamily: FONT,
            }}
          >
            {label}
          </div>
        </div>

        {/* ── Student info ── */}
        <div style={{ marginBottom: 13 }}>
          <p style={{ color: "rgba(255,255,255,0.40)", fontSize: 10, fontWeight: 500, margin: 0, marginBottom: 4, fontFamily: FONT }}>
            Study Report · {dateStr}
          </p>
          <h2
            style={{
              color: "#fff",
              fontSize: Math.max(22, Math.min(26, 26 - Math.max(0, name.length - 14))),
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.15,
              letterSpacing: -0.4,
              fontFamily: FONT,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name || "Student"}
          </h2>
          {grade && (
            <p style={{ color: theme.accent, fontSize: 12, fontWeight: 600, margin: 0, marginTop: 3, fontFamily: FONT }}>
              Grade {grade}
            </p>
          )}
        </div>

        {/* ── Hero Stat ── */}
        <div
          style={{
            background: theme.heroCard,
            border: `1.5px solid ${theme.heroBorder}`,
            borderRadius: 18,
            padding: "14px 18px",
            marginBottom: 10,
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 9, fontWeight: 700, margin: 0, marginBottom: 5, letterSpacing: 1.1, fontFamily: FONT }}>
            STUDY TIME
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                letterSpacing: -1.5,
                fontFamily: FONT,
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {fmtTime(studyMinutes)}
            </span>
            {improvePct !== 0 && (
              <div
                style={{
                  background: improvePct > 0 ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)",
                  border: `1.5px solid ${improvePct > 0 ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
                  borderRadius: 10,
                  padding: "4px 9px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: improvePct > 0 ? "#34d399" : "#f87171",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  fontFamily: FONT,
                }}
              >
                {improvePct > 0 ? "↑" : "↓"} {Math.abs(improvePct)}%
              </div>
            )}
          </div>
          <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 10, margin: 0, marginTop: 4, fontFamily: FONT }}>
            {fmtTime(totalStudyTime)} total all time
          </p>
        </div>

        {/* ── Bar Chart ── */}
        <div
          style={{
            background: theme.chartCard,
            border: `1px solid rgba(255,255,255,0.07)`,
            borderRadius: 14,
            padding: "11px 14px 8px",
            marginBottom: 10,
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, fontWeight: 600, margin: 0, marginBottom: 9, letterSpacing: 0.8, fontFamily: FONT }}>
            {chartTitle.toUpperCase()}
          </p>
          {period === "month" ? (
            <MonthBars logs={dailyLogs} theme={theme} chartH={CHART_H} />
          ) : (
            <WeekBars logs={dailyLogs} theme={theme} chartH={CHART_H} />
          )}
        </div>

        {/* ── Stats Row ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: badges.length > 0 ? 10 : 0 }}>
          {[
            { icon: "🔥", value: `${streak}d`, label: "STREAK" },
            { icon: "✅", value: String(tasksCompleted), label: "TASKS" },
            { icon: "📚", value: String(notesRead), label: "NOTES" },
          ].map(({ icon, value, label: lbl }) => (
            <div
              key={lbl}
              style={{
                flex: 1,
                background: theme.statCard,
                border: `1px solid ${theme.statBorder}`,
                borderRadius: 12,
                padding: "10px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 3, lineHeight: 1 }}>{icon}</div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, lineHeight: 1, marginBottom: 2, fontFamily: FONT }}>{value}</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8, fontWeight: 700, letterSpacing: 0.6, fontFamily: FONT }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* ── Badges ── */}
        {badges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {badges.slice(0, 4).map((b) => (
              <div
                key={b.label}
                style={{
                  background: theme.badgeBg,
                  border: `1px solid rgba(${theme.accentRgb},0.30)`,
                  borderRadius: 20,
                  padding: "4px 9px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: theme.badgeText,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                  fontFamily: FONT,
                }}
              >
                <span style={{ fontSize: 11 }}>{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── Footer ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${theme.divider}`,
            paddingTop: 12,
          }}
        >
          <div>
            <p style={{ color: theme.accent, fontSize: 14, fontWeight: 800, margin: 0, fontFamily: FONT }}>
              Student Hub Nepal
            </p>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, margin: 0, marginTop: 1, fontFamily: FONT }}>
              studenthubnp.com
            </p>
          </div>
          <div
            style={{
              background: `rgba(${theme.accentRgb},0.15)`,
              border: `1px solid rgba(${theme.accentRgb},0.28)`,
              borderRadius: 10,
              padding: "5px 10px",
              fontSize: 10,
              fontWeight: 700,
              color: theme.pillText,
              whiteSpace: "nowrap",
              fontFamily: FONT,
            }}
          >
            Study. Rank. Succeed.
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";
export default ShareCard;
