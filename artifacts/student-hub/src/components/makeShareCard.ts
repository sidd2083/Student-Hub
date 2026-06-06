/**
 * makeShareCard — Canvas 2D drawn 1080×1920 share card.
 * Apple-inspired: bold typography, whitespace, one hero moment.
 * No html2canvas — what we draw is exactly what you get.
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

// ── Palettes ───────────────────────────────────────────────────────────────
const PAL = {
  day: {
    bg0: "#07061a",      // very top
    bg1: "#0d0b28",      // bottom
    glow: "#6d28d9",     // radial glow color
    accent: "#8b5cf6",
    accentBright: "#a78bfa",
    accentDim: "#4c1d95",
    barFill: "#8b5cf6",
    barToday: "#c4b5fd",
    barEmpty: "rgba(139,92,246,0.15)",
    label: "TODAY",
    tagBg: "rgba(139,92,246,0.18)",
    tagBorder: "rgba(139,92,246,0.45)",
    divider: "rgba(139,92,246,0.22)",
  },
  week: {
    bg0: "#030d1e",
    bg1: "#061529",
    glow: "#1d4ed8",
    accent: "#3b82f6",
    accentBright: "#93c5fd",
    accentDim: "#1e3a5f",
    barFill: "#3b82f6",
    barToday: "#93c5fd",
    barEmpty: "rgba(59,130,246,0.15)",
    label: "THIS WEEK",
    tagBg: "rgba(59,130,246,0.18)",
    tagBorder: "rgba(59,130,246,0.45)",
    divider: "rgba(59,130,246,0.22)",
  },
  month: {
    bg0: "#0d0414",
    bg1: "#160720",
    glow: "#9d174d",
    accent: "#ec4899",
    accentBright: "#f9a8d4",
    accentDim: "#500724",
    barFill: "#ec4899",
    barToday: "#f9a8d4",
    barEmpty: "rgba(236,72,153,0.15)",
    label: "THIS MONTH",
    tagBg: "rgba(236,72,153,0.18)",
    tagBorder: "rgba(236,72,153,0.45)",
    divider: "rgba(236,72,153,0.22)",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function hex2rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  r = Math.min(r, w / 2, h / 2);
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

function fmt(mins: number) {
  if (mins <= 0) return "0m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function buildDays(logs: { date: string; studyMinutes: number }[], count: number) {
  const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      minutes: logs.find((l) => l.date === key)?.studyMinutes ?? 0,
      isToday: i === count - 1,
      dayName: DN[d.getDay()],
      dayNum: d.getDate(),
    };
  });
}

// Draw a floating pill/chip
function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  font: string,
  textColor: string,
  bgColor: string,
  borderColor: string,
  padX = 32,
  height = 52
) {
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const pw = tw + padX * 2;
  const px = cx - pw / 2;
  const py = cy - height / 2;
  rr(ctx, px, py, pw, height, height / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  rr(ctx, px, py, pw, height, height / 2);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
  return { pw, px, py };
}

// ── Main ───────────────────────────────────────────────────────────────────
export async function makeShareCard(opts: MakeShareCardOptions): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const PAD = 88;
  const CW = W - PAD * 2; // content width

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const p = PAL[opts.period];

  // ── Background gradient ──────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, p.bg0);
  bg.addColorStop(1, p.bg1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow near top-center
  const glowGrad = ctx.createRadialGradient(W / 2, 300, 0, W / 2, 300, 600);
  glowGrad.addColorStop(0, hex2rgba(p.glow, 0.25));
  glowGrad.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // Bottom glow
  const glowGrad2 = ctx.createRadialGradient(W / 2, H - 200, 0, W / 2, H - 200, 400);
  glowGrad2.addColorStop(0, hex2rgba(p.glow, 0.12));
  glowGrad2.addColorStop(1, "transparent");
  ctx.fillStyle = glowGrad2;
  ctx.fillRect(0, 0, W, H);

  // ── Top accent line (6px) ────────────────────────────────────────────────
  const topLineGrad = ctx.createLinearGradient(0, 0, W, 0);
  topLineGrad.addColorStop(0, "transparent");
  topLineGrad.addColorStop(0.2, p.accent);
  topLineGrad.addColorStop(0.8, p.accent);
  topLineGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topLineGrad;
  ctx.fillRect(0, 0, W, 6);

  // ── Brand row ────────────────────────────────────────────────────────────
  let y = 72;

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  ctx.font = "700 32px Arial, Helvetica, sans-serif";
  ctx.fillStyle = p.accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Student Hub", PAD, y + 18);

  // Period pill on the right
  const pillFont = "700 24px Arial, Helvetica, sans-serif";
  ctx.font = pillFont;
  const pLabelW = ctx.measureText(p.label).width;
  const pPillW = pLabelW + 48;
  const pPillH = 46;
  const pPillX = W - PAD - pPillW;
  const pPillY = y - 4;
  rr(ctx, pPillX, pPillY, pPillW, pPillH, pPillH / 2);
  ctx.fillStyle = p.tagBg;
  ctx.fill();
  rr(ctx, pPillX, pPillY, pPillW, pPillH, pPillH / 2);
  ctx.strokeStyle = p.tagBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = p.accentBright;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.label, pPillX + pPillW / 2, pPillY + pPillH / 2);

  y += 56;

  // ── Thin divider ─────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
  y += 60;

  // ── Date label ───────────────────────────────────────────────────────────
  ctx.font = "400 28px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(dateStr, PAD, y);
  y += 46;

  // ── Student name — THE HERO ───────────────────────────────────────────────
  const displayName = opts.name || "Student";
  let namePx = 108;
  ctx.font = `800 ${namePx}px Arial, Helvetica, sans-serif`;
  while (ctx.measureText(displayName).width > CW && namePx > 52) {
    namePx -= 4;
    ctx.font = `800 ${namePx}px Arial, Helvetica, sans-serif`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(displayName, PAD, y);
  y += namePx + 8;

  // Grade chip
  if (opts.grade) {
    ctx.font = "600 30px Arial, Helvetica, sans-serif";
    const gradeLabel = `Grade ${opts.grade}`;
    const gLabelW = ctx.measureText(gradeLabel).width;
    const gW = gLabelW + 40;
    const gH = 50;
    rr(ctx, PAD, y, gW, gH, gH / 2);
    ctx.fillStyle = hex2rgba(p.accent, 0.18);
    ctx.fill();
    ctx.fillStyle = p.accentBright;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(gradeLabel, PAD + 20, y + gH / 2);
    y += gH + 60;
  } else {
    y += 50;
  }

  // ── Wide separator ────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.strokeStyle = p.divider;
  ctx.lineWidth = 1;
  ctx.stroke();
  y += 60;

  // ── Study time section ────────────────────────────────────────────────────
  ctx.font = "600 26px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("STUDY TIME", PAD, y);

  // % change badge on the right
  if (opts.improvePct !== 0) {
    const isPos = opts.improvePct > 0;
    const impStr = `${isPos ? "+" : ""}${opts.improvePct}%`;
    ctx.font = "700 26px Arial, Helvetica, sans-serif";
    const iw = ctx.measureText(impStr).width + 40;
    const ih = 46;
    const ix = W - PAD - iw;
    const iy = y + 1;
    rr(ctx, ix, iy, iw, ih, ih / 2);
    ctx.fillStyle = isPos ? "rgba(52,211,153,0.18)" : "rgba(248,113,113,0.18)";
    ctx.fill();
    rr(ctx, ix, iy, iw, ih, ih / 2);
    ctx.strokeStyle = isPos ? "rgba(52,211,153,0.45)" : "rgba(248,113,113,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = isPos ? "#34d399" : "#f87171";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(impStr, ix + iw / 2, iy + ih / 2);
  }

  y += 42;

  // Big study time number
  const timeStr = fmt(opts.studyMinutes);
  let timePx = 140;
  ctx.font = `900 ${timePx}px Arial, Helvetica, sans-serif`;
  while (ctx.measureText(timeStr).width > CW - 80 && timePx > 80) {
    timePx -= 4;
    ctx.font = `900 ${timePx}px Arial, Helvetica, sans-serif`;
  }

  // Subtle glow behind the number
  ctx.shadowColor = p.accent;
  ctx.shadowBlur = 60;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(timeStr, PAD, y);
  ctx.shadowBlur = 0;
  y += timePx + 14;

  // Sub-label: total all time
  ctx.font = "400 26px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${fmt(opts.totalStudyTime)} total all time`, PAD, y);
  y += 70;

  // ── Bar chart ─────────────────────────────────────────────────────────────
  const isMonth = opts.period === "month";
  const barCount = isMonth ? 30 : 7;
  const CHART_H = 200;
  const CHART_LABEL_H = 40;

  ctx.font = "600 24px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(isMonth ? "LAST 30 DAYS" : "LAST 7 DAYS", PAD, y);
  y += 44;

  const days = buildDays(opts.dailyLogs, barCount);
  const maxMins = Math.max(...days.map((d) => d.minutes), 1);
  const BAR_GAP = isMonth ? 5 : 16;
  const BAR_W = (CW - BAR_GAP * (barCount - 1)) / barCount;
  const BAR_RADIUS = isMonth ? 4 : 8;

  days.forEach(({ minutes, isToday, dayName, dayNum }, i) => {
    const barH = Math.max((minutes / maxMins) * CHART_H, minutes > 0 ? 10 : 3);
    const bx = PAD + i * (BAR_W + BAR_GAP);
    const by = y + CHART_H - barH;

    // Bar fill
    if (isToday) {
      // Gradient bar for today
      const todayGrad = ctx.createLinearGradient(bx, by, bx, y + CHART_H);
      todayGrad.addColorStop(0, p.barToday);
      todayGrad.addColorStop(1, p.barFill);
      rr(ctx, bx, by, BAR_W, barH, BAR_RADIUS);
      ctx.fillStyle = todayGrad;
      ctx.fill();
      // Glow effect on today bar
      ctx.shadowColor = p.accent;
      ctx.shadowBlur = 18;
      rr(ctx, bx, by, BAR_W, barH, BAR_RADIUS);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      rr(ctx, bx, by, BAR_W, barH, BAR_RADIUS);
      ctx.fillStyle = minutes > 0 ? hex2rgba(p.barFill, 0.65) : hex2rgba(p.barFill, 0.12);
      ctx.fill();
    }

    // Labels
    let lbl = "";
    if (isMonth) {
      if (isToday) lbl = "Now";
      else if (dayNum === 1 || dayNum === 7 || dayNum === 14 || dayNum === 21) lbl = String(dayNum);
    } else {
      lbl = isToday ? "Today" : dayName;
    }

    if (lbl) {
      ctx.font = `${isToday ? "700" : "400"} ${isMonth ? "20" : "26"}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = isToday ? p.accentBright : "rgba(255,255,255,0.35)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(lbl, bx + BAR_W / 2, y + CHART_H + 12);
    }
  });

  y += CHART_H + CHART_LABEL_H + 56;

  // ── Stats row ─────────────────────────────────────────────────────────────
  const STAT_H = 196;
  const STAT_GAP = 20;
  const STAT_W = (CW - STAT_GAP * 2) / 3;

  const stats = [
    { label: "STREAK", value: `${opts.streak}d` },
    { label: "TASKS DONE", value: String(opts.tasksCompleted) },
    { label: "NOTES READ", value: String(opts.notesRead) },
  ];

  stats.forEach(({ label, value }, i) => {
    const sx = PAD + i * (STAT_W + STAT_GAP);

    // Card background
    rr(ctx, sx, y, STAT_W, STAT_H, 32);
    const cardGrad = ctx.createLinearGradient(sx, y, sx, y + STAT_H);
    cardGrad.addColorStop(0, hex2rgba(p.accent, 0.10));
    cardGrad.addColorStop(1, hex2rgba(p.accent, 0.04));
    ctx.fillStyle = cardGrad;
    ctx.fill();
    rr(ctx, sx, y, STAT_W, STAT_H, 32);
    ctx.strokeStyle = hex2rgba(p.accent, 0.25);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Value — big number
    let valPx = 72;
    ctx.font = `800 ${valPx}px Arial, Helvetica, sans-serif`;
    while (ctx.measureText(value).width > STAT_W - 24 && valPx > 44) {
      valPx -= 4;
      ctx.font = `800 ${valPx}px Arial, Helvetica, sans-serif`;
    }
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, sx + STAT_W / 2, y + STAT_H / 2 - 14);

    // Label
    ctx.font = "600 22px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fillText(label, sx + STAT_W / 2, y + STAT_H / 2 + valPx / 2 + 4);
  });

  y += STAT_H + 48;

  // ── Badges ────────────────────────────────────────────────────────────────
  if (opts.badges.length > 0) {
    const BADGE_H = 58;
    const BADGE_GAP = 16;
    ctx.font = "600 26px Arial, Helvetica, sans-serif";

    let bx = PAD;
    let by = y;

    opts.badges.slice(0, 6).forEach(({ label }) => {
      const tw = ctx.measureText(label).width;
      const bw = tw + 52;
      if (bx + bw > W - PAD && bx > PAD) {
        bx = PAD;
        by += BADGE_H + 14;
      }
      rr(ctx, bx, by, bw, BADGE_H, BADGE_H / 2);
      ctx.fillStyle = p.tagBg;
      ctx.fill();
      rr(ctx, bx, by, bw, BADGE_H, BADGE_H / 2);
      ctx.strokeStyle = p.tagBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = p.accentBright;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + 26, by + BADGE_H / 2);
      bx += bw + BADGE_GAP;
    });
  }

  // ── Bottom accent line (6px) ─────────────────────────────────────────────
  const botLineGrad = ctx.createLinearGradient(0, 0, W, 0);
  botLineGrad.addColorStop(0, "transparent");
  botLineGrad.addColorStop(0.2, p.accent);
  botLineGrad.addColorStop(0.8, p.accent);
  botLineGrad.addColorStop(1, "transparent");
  ctx.fillStyle = botLineGrad;
  ctx.fillRect(0, H - 6, W, 6);

  // ── Footer ───────────────────────────────────────────────────────────────
  const FOOT_Y = H - 110;

  ctx.beginPath();
  ctx.moveTo(PAD, FOOT_Y);
  ctx.lineTo(W - PAD, FOOT_Y);
  ctx.strokeStyle = p.divider;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Left: brand
  ctx.font = "700 34px Arial, Helvetica, sans-serif";
  ctx.fillStyle = p.accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Student Hub Nepal", PAD, FOOT_Y + 22);

  ctx.font = "400 24px Arial, Helvetica, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillText("studenthubnp.com", PAD, FOOT_Y + 64);

  // Right: tagline
  ctx.font = "600 24px Arial, Helvetica, sans-serif";
  const tag = "Study. Rank. Succeed.";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(tag, W - PAD, FOOT_Y + 43);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob null"))),
      "image/png",
      1.0
    );
  });
}
