/**
 * makeShareCard — draws a 1080×1920 share card using Canvas 2D API.
 * No html2canvas, no CSS rendering quirks. What you draw is what you get.
 */

export interface MakeShareCardOptions {
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
  badges: { label: string }[];
}

// ── Palette ────────────────────────────────────────────────────────────────

const PALETTES = {
  day: {
    bgTop: "#120d2a",
    bgBot: "#1e1545",
    accent: "#9b72ff",
    accentLight: "#c4b5fd",
    barFill: "#9b72ff",
    barToday: "#c4b5fd",
    cardBg: "rgba(155,114,255,0.10)",
    cardBorder: "rgba(155,114,255,0.30)",
    pillBg: "rgba(155,114,255,0.22)",
    label: "TODAY",
  },
  week: {
    bgTop: "#08152e",
    bgBot: "#0d2347",
    accent: "#3b82f6",
    accentLight: "#7dd3fc",
    barFill: "#3b82f6",
    barToday: "#7dd3fc",
    cardBg: "rgba(59,130,246,0.10)",
    cardBorder: "rgba(59,130,246,0.30)",
    pillBg: "rgba(59,130,246,0.22)",
    label: "THIS WEEK",
  },
  month: {
    bgTop: "#180520",
    bgBot: "#250c3a",
    accent: "#ec4899",
    accentLight: "#f9a8d4",
    barFill: "#ec4899",
    barToday: "#f9a8d4",
    cardBg: "rgba(236,72,153,0.10)",
    cardBorder: "rgba(236,72,153,0.30)",
    pillBg: "rgba(236,72,153,0.22)",
    label: "THIS MONTH",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function card(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: string,
  border: string,
  radius = 36
) {
  rr(ctx, x, y, w, h, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  rr(ctx, x, y, w, h, radius);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function fmt(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function buildDays(
  logs: { date: string; studyMinutes: number }[],
  count: number
) {
  const DAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
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

// ── Main draw function ────────────────────────────────────────────────────

export async function makeShareCard(opts: MakeShareCardOptions): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const PAD = 84;
  const CONTENT_W = W - PAD * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const pal = PALETTES[opts.period];
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // ── Background ───────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, pal.bgTop);
  bgGrad.addColorStop(1, pal.bgBot);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot texture overlay
  ctx.fillStyle = "rgba(255,255,255,0.015)";
  for (let yy = 0; yy < H; yy += 24) {
    for (let xx = 0; xx < W; xx += 24) {
      ctx.fillRect(xx, yy, 1, 1);
    }
  }

  // ── Top bar: Brand + Period pill ─────────────────────────────────────────
  const TOP_Y = 90;

  // Logo square
  rr(ctx, PAD, TOP_Y, 72, 72, 18);
  ctx.fillStyle = pal.accent;
  ctx.fill();
  ctx.font = "bold 38px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("SH", PAD + 36, TOP_Y + 38);

  // Brand name
  ctx.textAlign = "left";
  ctx.font = "bold 44px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Student Hub", PAD + 90, TOP_Y + 28);
  ctx.font = "400 30px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillText("studenthubnp.com", PAD + 90, TOP_Y + 62);

  // Period pill
  const pillTxt = pal.label;
  ctx.font = "bold 26px Arial, Helvetica, sans-serif";
  const pillW = ctx.measureText(pillTxt).width + 52;
  const pillH = 52;
  const pillX = W - PAD - pillW;
  const pillY = TOP_Y + 10;
  rr(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = pal.pillBg;
  ctx.fill();
  rr(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.strokeStyle = pal.cardBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = pal.accentLight;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillTxt, pillX + pillW / 2, pillY + pillH / 2);

  // ── Divider line ─────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(PAD, TOP_Y + 96);
  ctx.lineTo(W - PAD, TOP_Y + 96);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Student name + grade ─────────────────────────────────────────────────
  const NAME_Y = TOP_Y + 130;

  ctx.textAlign = "left";
  ctx.font = "400 28px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.textBaseline = "top";
  ctx.fillText(`Study Report  ·  ${dateStr}`, PAD, NAME_Y);

  // Name — auto-size to fit
  const displayName = opts.name || "Student";
  let namePx = 80;
  ctx.font = `800 ${namePx}px Arial, Helvetica, sans-serif`;
  while (ctx.measureText(displayName).width > CONTENT_W && namePx > 46) {
    namePx -= 4;
    ctx.font = `800 ${namePx}px Arial, Helvetica, sans-serif`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.fillText(displayName, PAD, NAME_Y + 46);

  if (opts.grade) {
    ctx.font = "600 34px Arial, Helvetica, sans-serif";
    ctx.fillStyle = pal.accentLight;
    ctx.textBaseline = "top";
    ctx.fillText(`Grade ${opts.grade}`, PAD, NAME_Y + 46 + namePx + 10);
  }

  // ── Hero stat card ───────────────────────────────────────────────────────
  const HERO_Y = NAME_Y + 46 + namePx + (opts.grade ? 60 : 30);
  const HERO_H = 220;

  card(ctx, PAD, HERO_Y, CONTENT_W, HERO_H, pal.cardBg, pal.cardBorder, 40);

  ctx.font = "700 26px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("STUDY TIME", PAD + 44, HERO_Y + 36);

  // Time — big number
  const timeStr = fmt(opts.studyMinutes);
  let timePx = 96;
  ctx.font = `900 ${timePx}px Arial, Helvetica, sans-serif`;
  while (ctx.measureText(timeStr).width > CONTENT_W - 200 && timePx > 60) {
    timePx -= 4;
    ctx.font = `900 ${timePx}px Arial, Helvetica, sans-serif`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.fillText(timeStr, PAD + 44, HERO_Y + 72);

  // Improvement badge
  if (opts.improvePct !== 0) {
    const sign = opts.improvePct > 0 ? "+" : "";
    const impStr = `${sign}${opts.improvePct}%`;
    ctx.font = "bold 28px Arial, Helvetica, sans-serif";
    const impW = ctx.measureText(impStr).width + 36;
    const impH = 52;
    const impX = W - PAD - impW - 8;
    const impY = HERO_Y + 80;
    rr(ctx, impX, impY, impW, impH, impH / 2);
    ctx.fillStyle =
      opts.improvePct > 0 ? "rgba(52,211,153,0.20)" : "rgba(248,113,113,0.20)";
    ctx.fill();
    rr(ctx, impX, impY, impW, impH, impH / 2);
    ctx.strokeStyle =
      opts.improvePct > 0 ? "rgba(52,211,153,0.50)" : "rgba(248,113,113,0.50)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = opts.improvePct > 0 ? "#34d399" : "#f87171";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(impStr, impX + impW / 2, impY + impH / 2);
  }

  // All-time sub-label
  ctx.font = "400 26px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${fmt(opts.totalStudyTime)} total · all time`, PAD + 44, HERO_Y + HERO_H - 52);

  // ── Bar chart ─────────────────────────────────────────────────────────────
  const CHART_Y = HERO_Y + HERO_H + 32;
  const isMonth = opts.period === "month";
  const barCount = isMonth ? 30 : 7;
  const CHART_H = 280;

  card(ctx, PAD, CHART_Y, CONTENT_W, CHART_H, "rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)", 36);

  // Chart label
  ctx.font = "700 24px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.36)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(isMonth ? "LAST 30 DAYS" : "LAST 7 DAYS", PAD + 40, CHART_Y + 32);

  const days = buildDays(opts.dailyLogs, barCount);
  const maxMins = Math.max(...days.map((d) => d.minutes), 1);

  const CHART_INNER_TOP = CHART_Y + 72;
  const CHART_INNER_H = CHART_H - 110;
  const CHART_INNER_W = CONTENT_W - 80;
  const CHART_INNER_X = PAD + 40;
  const BAR_GAP = isMonth ? 4 : 12;
  const BAR_W = (CHART_INNER_W - BAR_GAP * (barCount - 1)) / barCount;

  days.forEach(({ minutes, isToday, dayName, dayNum }, i) => {
    const barH = Math.max((minutes / maxMins) * CHART_INNER_H, minutes > 0 ? 8 : 3);
    const barX = CHART_INNER_X + i * (BAR_W + BAR_GAP);
    const barY = CHART_INNER_TOP + CHART_INNER_H - barH;

    rr(ctx, barX, barY, BAR_W, barH, isMonth ? 3 : 6);
    ctx.fillStyle = isToday
      ? pal.barToday
      : minutes > 0
      ? pal.barFill
      : "rgba(255,255,255,0.12)";
    ctx.globalAlpha = isToday ? 1 : minutes > 0 ? 0.75 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Labels
    ctx.font = `${isToday ? "700" : "400"} ${isMonth ? "19" : "22"}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = isToday ? pal.accentLight : "rgba(255,255,255,0.40)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    let lbl = "";
    if (isMonth) {
      if (isToday) lbl = "Now";
      else if (dayNum === 1 || dayNum === 7 || dayNum === 14 || dayNum === 21) lbl = String(dayNum);
    } else {
      lbl = isToday ? "Today" : dayName;
    }
    if (lbl) ctx.fillText(lbl, barX + BAR_W / 2, CHART_INNER_TOP + CHART_INNER_H + 8);
  });

  // ── Stats row ─────────────────────────────────────────────────────────────
  const STATS_Y = CHART_Y + CHART_H + 32;
  const STAT_H = 180;
  const STAT_GAP = 24;
  const STAT_W = (CONTENT_W - STAT_GAP * 2) / 3;

  const stats = [
    { label: "STREAK", value: `${opts.streak}d`, icon: "Streak" },
    { label: "TASKS", value: String(opts.tasksCompleted), icon: "Tasks" },
    { label: "NOTES READ", value: String(opts.notesRead), icon: "Notes" },
  ];

  stats.forEach(({ label, value }, i) => {
    const sx = PAD + i * (STAT_W + STAT_GAP);
    card(ctx, sx, STATS_Y, STAT_W, STAT_H, pal.cardBg, pal.cardBorder, 30);

    // Value
    let valPx = 64;
    ctx.font = `800 ${valPx}px Arial, Helvetica, sans-serif`;
    while (ctx.measureText(value).width > STAT_W - 32 && valPx > 40) {
      valPx -= 4;
      ctx.font = `800 ${valPx}px Arial, Helvetica, sans-serif`;
    }
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(value, sx + STAT_W / 2, STATS_Y + 44);

    ctx.font = "600 22px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(label, sx + STAT_W / 2, STATS_Y + 44 + valPx + 10);
  });

  // ── Badges ────────────────────────────────────────────────────────────────
  if (opts.badges.length > 0) {
    const BADGE_Y = STATS_Y + STAT_H + 32;
    let bx = PAD;
    let by = BADGE_Y;
    const BADGE_H = 60;
    const BADGE_PAD_X = 32;
    const BADGE_GAP = 16;

    ctx.font = "600 26px Arial, Helvetica, sans-serif";

    opts.badges.slice(0, 5).forEach(({ label }) => {
      const tw = ctx.measureText(label).width;
      const bw = tw + BADGE_PAD_X * 2;
      if (bx + bw > W - PAD && bx > PAD) {
        bx = PAD;
        by += BADGE_H + 14;
      }

      rr(ctx, bx, by, bw, BADGE_H, BADGE_H / 2);
      ctx.fillStyle = pal.pillBg;
      ctx.fill();
      rr(ctx, bx, by, bw, BADGE_H, BADGE_H / 2);
      ctx.strokeStyle = pal.cardBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = pal.accentLight;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + BADGE_PAD_X, by + BADGE_H / 2);

      bx += bw + BADGE_GAP;
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const FOOTER_Y = H - 140;

  // Divider
  ctx.beginPath();
  ctx.moveTo(PAD, FOOTER_Y);
  ctx.lineTo(W - PAD, FOOTER_Y);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Brand left
  ctx.font = "800 40px Arial, Helvetica, sans-serif";
  ctx.fillStyle = pal.accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Student Hub Nepal", PAD, FOOTER_Y + 28);

  ctx.font = "400 26px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText("studenthubnp.com", PAD, FOOTER_Y + 76);

  // Tagline right
  const tag = "Study. Rank. Succeed.";
  ctx.font = "700 26px Arial, Helvetica, sans-serif";
  const tagW = ctx.measureText(tag).width + 48;
  const tagH = 52;
  const tagX = W - PAD - tagW;
  const tagY = FOOTER_Y + 36;
  rr(ctx, tagX, tagY, tagW, tagH, tagH / 2);
  ctx.fillStyle = pal.pillBg;
  ctx.fill();
  ctx.fillStyle = pal.accentLight;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, tagX + tagW / 2, tagY + tagH / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("canvas.toBlob returned null"));
    }, "image/png", 1.0);
  });
}
