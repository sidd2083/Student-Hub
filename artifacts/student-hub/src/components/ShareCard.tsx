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
    bg: "linear-gradient(160deg, #0f0c29 0%, #302b63 55%, #24243e 100%)",
    accent: "#a78bfa",
    accentRgb: "167,139,250",
    pill: "rgba(167,139,250,0.20)",
    pillText: "#ddd6fe",
    bar: "#a78bfa",
    barActive: "#c4b5fd",
    barDim: "rgba(167,139,250,0.18)",
    statCard: "rgba(255,255,255,0.07)",
    statBorder: "rgba(167,139,250,0.20)",
    badgeBg: "rgba(167,139,250,0.16)",
    badgeText: "#ddd6fe",
    divider: "rgba(167,139,250,0.18)",
  },
  week: {
    bg: "linear-gradient(160deg, #071428 0%, #0c2444 55%, #0a3060 100%)",
    accent: "#38bdf8",
    accentRgb: "56,189,248",
    pill: "rgba(56,189,248,0.18)",
    pillText: "#bae6fd",
    bar: "#38bdf8",
    barActive: "#7dd3fc",
    barDim: "rgba(56,189,248,0.18)",
    statCard: "rgba(255,255,255,0.06)",
    statBorder: "rgba(56,189,248,0.20)",
    badgeBg: "rgba(56,189,248,0.14)",
    badgeText: "#bae6fd",
    divider: "rgba(56,189,248,0.18)",
  },
  month: {
    bg: "linear-gradient(160deg, #160524 0%, #2d1b69 50%, #0f3460 100%)",
    accent: "#f472b6",
    accentRgb: "244,114,182",
    pill: "rgba(244,114,182,0.18)",
    pillText: "#fbcfe8",
    bar: "#f472b6",
    barActive: "#f9a8d4",
    barDim: "rgba(244,114,182,0.15)",
    statCard: "rgba(255,255,255,0.06)",
    statBorder: "rgba(244,114,182,0.20)",
    badgeBg: "rgba(244,114,182,0.14)",
    badgeText: "#fbcfe8",
    divider: "rgba(244,114,182,0.18)",
  },
};

/** Builds an array of {date, minutes, label, isToday} for the chart */
function buildChartDays(
  logs: { date: string; studyMinutes: number }[],
  count: number
) {
  const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const log = logs.find((l) => l.date === key);
    const dayNum = d.getDate();
    return {
      key,
      minutes: log?.studyMinutes ?? 0,
      isToday: i === count - 1,
      dayNum,
      dayName: SHORT_DAYS[d.getDay()],
    };
  });
}

function WeekChart({
  logs,
  theme,
}: {
  logs: { date: string; studyMinutes: number }[];
  theme: (typeof THEMES)["day"];
}) {
  const days = buildChartDays(logs, 7);
  const max = Math.max(...days.map((d) => d.minutes), 1);
  const chartH = 72;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: chartH + 20 }}>
      {days.map(({ minutes, isToday, dayName }, i) => {
        const barH = Math.max((minutes / max) * chartH, minutes > 0 ? 5 : 2);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{ width: "100%", height: chartH, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: barH,
                  borderRadius: "4px 4px 0 0",
                  background: isToday ? theme.barActive : minutes > 0 ? theme.bar : theme.barDim,
                  opacity: isToday ? 1 : minutes > 0 ? 0.75 : 0.3,
                  boxShadow: isToday ? `0 -3px 12px rgba(${theme.accentRgb},0.5)` : "none",
                  transition: "all 0.2s",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: isToday ? 700 : 500,
                color: isToday ? theme.accent : "rgba(255,255,255,0.45)",
                lineHeight: 1,
                letterSpacing: 0.2,
              }}
            >
              {dayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MonthChart({
  logs,
  theme,
}: {
  logs: { date: string; studyMinutes: number }[];
  theme: (typeof THEMES)["day"];
}) {
  const days = buildChartDays(logs, 30);
  const max = Math.max(...days.map((d) => d.minutes), 1);
  const chartH = 64;
  // show label only for day 1, 10, 20, and today
  const showLabel = (dayNum: number, isToday: boolean) =>
    isToday || dayNum === 1 || dayNum === 10 || dayNum === 20;

  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: chartH + 18 }}>
      {days.map(({ minutes, isToday, dayNum }, i) => {
        const barH = Math.max((minutes / max) * chartH, minutes > 0 ? 4 : 1.5);
        const show = showLabel(dayNum, isToday);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", height: chartH, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: barH,
                  borderRadius: "2px 2px 0 0",
                  background: isToday ? theme.barActive : minutes > 0 ? theme.bar : theme.barDim,
                  opacity: isToday ? 1 : minutes > 0 ? 0.70 : 0.25,
                  boxShadow: isToday ? `0 -2px 8px rgba(${theme.accentRgb},0.5)` : "none",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 7.5,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? theme.accent : show ? "rgba(255,255,255,0.45)" : "transparent",
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              {show ? (isToday ? "Now" : String(dayNum)) : "."}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DayChart({
  logs,
  theme,
}: {
  logs: { date: string; studyMinutes: number }[];
  theme: (typeof THEMES)["day"];
}) {
  // For daily view, show last 7 days with today highlighted more
  const days = buildChartDays(logs, 7);
  const max = Math.max(...days.map((d) => d.minutes), 1);
  const chartH = 72;
  const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: chartH + 20 }}>
      {days.map(({ minutes, isToday, dayName }, i) => {
        const barH = Math.max((minutes / max) * chartH, minutes > 0 ? 5 : 2);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{ width: "100%", height: chartH, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: barH,
                  borderRadius: "4px 4px 0 0",
                  background: isToday ? theme.barActive : minutes > 0 ? theme.bar : theme.barDim,
                  opacity: isToday ? 1 : minutes > 0 ? 0.5 : 0.2,
                  boxShadow: isToday ? `0 -3px 14px rgba(${theme.accentRgb},0.6)` : "none",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? theme.accent : "rgba(255,255,255,0.35)",
                lineHeight: 1,
              }}
            >
              {isToday ? "Today" : dayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The actual card — rendered off-screen for html2canvas capture */
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
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const periodTitle =
      period === "day" ? "Last 7 Days" : period === "week" ? "Last 7 Days" : "Last 30 Days";

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
          fontFamily:
            "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: "26px 26px 20px",
          boxSizing: "border-box",
          color: "#fff",
        }}
      >
        {/* Glow orbs */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: `rgba(${theme.accentRgb},0.22)`,
            filter: "blur(70px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: `rgba(${theme.accentRgb},0.16)`,
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />

        {/* ── TOP: Brand + Period pill ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: theme.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
                boxShadow: `0 0 16px rgba(${theme.accentRgb},0.5)`,
                flexShrink: 0,
              }}
            >
              📘
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
                letterSpacing: 0.1,
              }}
            >
              Student Hub
            </span>
          </div>
          <div
            style={{
              background: theme.pill,
              border: `1px solid rgba(${theme.accentRgb},0.35)`,
              borderRadius: 20,
              padding: "5px 13px",
              fontSize: 10,
              fontWeight: 800,
              color: theme.pillText,
              letterSpacing: 1.4,
            }}
          >
            {label}
          </div>
        </div>

        {/* ── Student info ── */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: 16 }}>
          <p
            style={{
              color: "rgba(255,255,255,0.40)",
              fontSize: 11,
              fontWeight: 500,
              margin: 0,
              marginBottom: 5,
              letterSpacing: 0.2,
            }}
          >
            Study Report · {dateStr}
          </p>
          <h2
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: -0.6,
            }}
          >
            {name || "Student"}
          </h2>
          {grade && (
            <p
              style={{
                color: theme.accent,
                fontSize: 13,
                fontWeight: 600,
                margin: 0,
                marginTop: 4,
              }}
            >
              Grade {grade}
            </p>
          )}
        </div>

        {/* ── Hero Stat ── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(255,255,255,0.07)",
            border: `1px solid rgba(${theme.accentRgb},0.25)`,
            borderRadius: 20,
            padding: "16px 20px",
            marginBottom: 12,
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 10,
              fontWeight: 700,
              margin: 0,
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
          >
            ⏱ Study Time
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 50,
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                letterSpacing: -2,
                textShadow: `0 0 40px rgba(${theme.accentRgb},0.5)`,
              }}
            >
              {fmtTime(studyMinutes)}
            </span>
            {improvePct !== 0 && (
              <div
                style={{
                  background:
                    improvePct > 0
                      ? "rgba(52,211,153,0.15)"
                      : "rgba(248,113,113,0.15)",
                  border: `1px solid ${
                    improvePct > 0
                      ? "rgba(52,211,153,0.30)"
                      : "rgba(248,113,113,0.30)"
                  }`,
                  borderRadius: 12,
                  padding: "5px 10px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: improvePct > 0 ? "#34d399" : "#f87171",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexShrink: 0,
                }}
              >
                {improvePct > 0 ? "↑" : "↓"} {Math.abs(improvePct)}%
              </div>
            )}
          </div>
          <p
            style={{
              color: "rgba(255,255,255,0.30)",
              fontSize: 11,
              margin: 0,
              marginTop: 5,
            }}
          >
            {fmtTime(totalStudyTime)} total all time
          </p>
        </div>

        {/* ── Bar Chart ── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid rgba(255,255,255,0.07)`,
            borderRadius: 16,
            padding: "13px 15px 10px",
            marginBottom: 12,
          }}
        >
          <p
            style={{
              color: "rgba(255,255,255,0.38)",
              fontSize: 10,
              fontWeight: 600,
              margin: 0,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 0.9,
            }}
          >
            {periodTitle}
          </p>
          {period === "month" ? (
            <MonthChart logs={dailyLogs} theme={theme} />
          ) : period === "week" ? (
            <WeekChart logs={dailyLogs} theme={theme} />
          ) : (
            <DayChart logs={dailyLogs} theme={theme} />
          )}
        </div>

        {/* ── Stats Row ── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            gap: 10,
            marginBottom: badges.length > 0 ? 12 : 0,
          }}
        >
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
                padding: "11px 8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4, lineHeight: 1 }}>
                {icon}
              </div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 19,
                  fontWeight: 800,
                  lineHeight: 1,
                  marginBottom: 3,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.38)",
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 0.7,
                }}
              >
                {lbl}
              </div>
            </div>
          ))}
        </div>

        {/* ── Badges ── */}
        {badges.length > 0 && (
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {badges.slice(0, 4).map((b) => (
              <div
                key={b.label}
                style={{
                  background: theme.badgeBg,
                  border: `1px solid rgba(${theme.accentRgb},0.28)`,
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

        {/* ── Spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── Footer: Branding ── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${theme.divider}`,
            paddingTop: 14,
          }}
        >
          <div>
            <p
              style={{
                color: theme.accent,
                fontSize: 15,
                fontWeight: 800,
                margin: 0,
                letterSpacing: -0.3,
              }}
            >
              Student Hub Nepal
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.38)",
                fontSize: 11,
                margin: 0,
                marginTop: 1,
                letterSpacing: 0.2,
              }}
            >
              studenthubnp.com
            </p>
          </div>
          <div
            style={{
              background: `rgba(${theme.accentRgb},0.15)`,
              border: `1px solid rgba(${theme.accentRgb},0.30)`,
              borderRadius: 10,
              padding: "6px 12px",
              fontSize: 10,
              fontWeight: 700,
              color: theme.pillText,
              letterSpacing: 0.3,
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
