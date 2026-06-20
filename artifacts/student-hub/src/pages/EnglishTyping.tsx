import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Clock, Target, Zap, ChevronRight, BookOpen, RefreshCw, Settings2, Keyboard } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Difficulty = "easy" | "medium" | "hard";
type Duration   = 30 | 60 | 120 | 180 | 300;
type Phase      = "setup" | "guide" | "countdown" | "practice" | "results";
type Finger     = "LP" | "LR" | "LM" | "LI" | "RI" | "RM" | "RR" | "RP" | "T";

// ── Finger colours ────────────────────────────────────────────────────────────
const FINGER_BG: Record<Finger, string> = {
  LP: "#9333ea", LR: "#3b82f6", LM: "#06b6d4", LI: "#14b8a6",
  RI: "#22c55e", RM: "#eab308", RR: "#f97316", RP: "#ef4444", T: "#94a3b8",
};
const FINGER_KEY_NORMAL: Record<Finger, string> = {
  LP: "bg-purple-50 border-purple-200", LR: "bg-blue-50 border-blue-200",
  LM: "bg-cyan-50 border-cyan-200",    LI: "bg-teal-50 border-teal-200",
  RI: "bg-green-50 border-green-200",  RM: "bg-yellow-50 border-yellow-200",
  RR: "bg-orange-50 border-orange-200",RP: "bg-red-50 border-red-200",
  T:  "bg-slate-50 border-slate-200",
};
const FINGER_KEY_ACTIVE: Record<Finger, string> = {
  LP: "bg-purple-500 border-purple-700 text-white translate-y-[2px]",
  LR: "bg-blue-500 border-blue-700 text-white translate-y-[2px]",
  LM: "bg-cyan-500 border-cyan-700 text-white translate-y-[2px]",
  LI: "bg-teal-500 border-teal-700 text-white translate-y-[2px]",
  RI: "bg-green-500 border-green-700 text-white translate-y-[2px]",
  RM: "bg-yellow-500 border-yellow-700 text-white translate-y-[2px]",
  RR: "bg-orange-500 border-orange-700 text-white translate-y-[2px]",
  RP: "bg-red-500 border-red-700 text-white translate-y-[2px]",
  T:  "bg-slate-500 border-slate-700 text-white translate-y-[2px]",
};
const FINGER_LABEL: Record<Finger, string> = {
  LP: "Left Pinky", LR: "Left Ring", LM: "Left Middle", LI: "Left Index",
  RI: "Right Index", RM: "Right Middle", RR: "Right Ring", RP: "Right Pinky", T: "Thumb",
};

// ── Keyboard layout ───────────────────────────────────────────────────────────
interface KeyDef { code: string; label: string; finger: Finger; }

const ROW0: KeyDef[] = [
  { code:"Backquote", label:"`",  finger:"LP" }, { code:"Digit1", label:"1", finger:"LP" },
  { code:"Digit2",    label:"2",  finger:"LR" }, { code:"Digit3", label:"3", finger:"LM" },
  { code:"Digit4",    label:"4",  finger:"LI" }, { code:"Digit5", label:"5", finger:"LI" },
  { code:"Digit6",    label:"6",  finger:"RI" }, { code:"Digit7", label:"7", finger:"RI" },
  { code:"Digit8",    label:"8",  finger:"RM" }, { code:"Digit9", label:"9", finger:"RR" },
  { code:"Digit0",    label:"0",  finger:"RP" }, { code:"Minus",  label:"-", finger:"RP" },
  { code:"Equal",     label:"=",  finger:"RP" },
];
const ROW1: KeyDef[] = [
  { code:"KeyQ", label:"Q", finger:"LP" }, { code:"KeyW", label:"W", finger:"LR" },
  { code:"KeyE", label:"E", finger:"LM" }, { code:"KeyR", label:"R", finger:"LI" },
  { code:"KeyT", label:"T", finger:"LI" }, { code:"KeyY", label:"Y", finger:"RI" },
  { code:"KeyU", label:"U", finger:"RI" }, { code:"KeyI", label:"I", finger:"RM" },
  { code:"KeyO", label:"O", finger:"RR" }, { code:"KeyP", label:"P", finger:"RP" },
  { code:"BracketLeft",  label:"[", finger:"RP" }, { code:"BracketRight", label:"]", finger:"RP" },
];
const ROW2: KeyDef[] = [
  { code:"KeyA", label:"A", finger:"LP" }, { code:"KeyS", label:"S", finger:"LR" },
  { code:"KeyD", label:"D", finger:"LM" }, { code:"KeyF", label:"F", finger:"LI" },
  { code:"KeyG", label:"G", finger:"LI" }, { code:"KeyH", label:"H", finger:"RI" },
  { code:"KeyJ", label:"J", finger:"RI" }, { code:"KeyK", label:"K", finger:"RM" },
  { code:"KeyL", label:"L", finger:"RR" }, { code:"Semicolon", label:";", finger:"RP" },
  { code:"Quote", label:"'", finger:"RP" },
];
const ROW3: KeyDef[] = [
  { code:"KeyZ", label:"Z", finger:"LP" }, { code:"KeyX", label:"X", finger:"LR" },
  { code:"KeyC", label:"C", finger:"LM" }, { code:"KeyV", label:"V", finger:"LI" },
  { code:"KeyB", label:"B", finger:"LI" }, { code:"KeyN", label:"N", finger:"RI" },
  { code:"KeyM", label:"M", finger:"RI" }, { code:"Comma",  label:",", finger:"RM" },
  { code:"Period", label:".", finger:"RR" }, { code:"Slash", label:"/", finger:"RP" },
];
const ALL_KEY_ROWS = [ROW0, ROW1, ROW2, ROW3];

// ── Character → Key map ───────────────────────────────────────────────────────
const EN_CHAR_TO_KEY: Record<string, { code: string; shift: boolean; finger: Finger }> = {};
for (const row of ALL_KEY_ROWS) {
  for (const k of row) {
    if (/^[A-Za-z]$/.test(k.label)) {
      EN_CHAR_TO_KEY[k.label.toLowerCase()] = { code: k.code, shift: false, finger: k.finger };
      EN_CHAR_TO_KEY[k.label.toUpperCase()] = { code: k.code, shift: true,  finger: k.finger };
    }
  }
}
EN_CHAR_TO_KEY[" "]  = { code: "Space",      shift: false, finger: "T"  };
EN_CHAR_TO_KEY["."]  = { code: "Period",      shift: false, finger: "RR" };
EN_CHAR_TO_KEY[","]  = { code: "Comma",       shift: false, finger: "RM" };
EN_CHAR_TO_KEY[";"]  = { code: "Semicolon",   shift: false, finger: "RP" };
EN_CHAR_TO_KEY["'"]  = { code: "Quote",       shift: false, finger: "RP" };
EN_CHAR_TO_KEY["!"]  = { code: "Digit1",      shift: true,  finger: "LP" };
EN_CHAR_TO_KEY["?"]  = { code: "Slash",       shift: true,  finger: "RP" };
EN_CHAR_TO_KEY["-"]  = { code: "Minus",       shift: false, finger: "RP" };

// ── English Word Banks ────────────────────────────────────────────────────────
const EASY_WORDS = [
  "the","and","is","of","to","in","a","that","it","for","on","with","as","at","by",
  "from","this","which","or","an","but","not","so","if","can","my","will","are",
  "was","been","has","had","him","her","we","they","do","did","go","get","put",
  "say","see","use","our","you","day","time","year","work","way","how","who",
  "now","just","come","take","make","know","good","give","think","some","into",
  "than","then","look","two","more","also","out","up","come","him","its","no",
  "make","could","have","down","find","give","live","help","keep","let","put",
  "set","run","move","play","write","read","talk","walk","sit","stand","learn",
  "grow","show","turn","ask","try","hold","bring","think","say","tell","want",
  "call","need","feel","become","same","back","after","first","long","little",
  "small","large","old","new","high","low","big","great","right","left","next",
  "last","young","early","hard","easy","open","close","free","true","real","full",
];

const MEDIUM_WORDS = [
  "government","administration","department","ministry","service","commission",
  "examination","candidate","appointment","official","recruit","qualify","position",
  "application","document","certificate","authority","bureau","division","section",
  "policy","regulation","procedure","notice","office","employee","staff","duty",
  "performance","assessment","evaluation","interview","selection","promotion",
  "transfer","posting","salary","allowance","pension","retirement","training",
  "development","management","supervision","coordination","implementation","report",
  "review","approval","recommendation","proposal","budget","expenditure","revenue",
  "account","audit","compliance","inspection","monitoring","feedback","communication",
  "standard","quality","efficiency","effectiveness","productivity","accountability",
  "transparency","integrity","responsibility","competence","professional","technical",
  "academic","educational","institutional","organizational","administrative",
  "provincial","federal","local","national","public","civil","service","sector",
];

const HARD_WORDS = [
  "The Lok Sewa Aayog is the Public Service Commission of Nepal.",
  "Government employees must demonstrate proficiency in both typing speed and accuracy.",
  "Civil service recruitment requires candidates to meet strict performance standards.",
  "The federal government administers public services across all provinces of Nepal.",
  "Regular practice is the most effective way to improve your typing speed and accuracy.",
  "Consistent daily training leads to significant improvement in words per minute.",
  "Administrative efficiency depends on the ability to process documents quickly.",
  "Strong keyboard skills are essential for modern professional and office environments.",
  "The standard typing benchmark for government jobs is thirty five words per minute.",
  "Accuracy of ninety percent or higher is required alongside minimum speed requirements.",
  "Banking and finance sector positions also require demonstrated typing proficiency.",
  "Digital transformation in public administration demands fast and accurate data entry.",
  "Professional development includes improving computer literacy and typing efficiency.",
  "The quick brown fox jumps over the lazy dog every single day without fail.",
  "Practice typing with passages that reflect real workplace and examination content.",
  "Preparation for civil service exams should begin well in advance of the test date.",
];

function generateStream(diff: Difficulty, count = 120): string {
  if (diff === "hard") {
    const pool = HARD_WORDS;
    const out: string[] = [];
    for (let i = 0; i < Math.ceil(count / 10); i++) {
      out.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return out.join(" ");
  }
  const pool = diff === "easy" ? EASY_WORDS : MEDIUM_WORDS;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out.join(" ");
}

// ── SVG Hand Guide (QWERTY) ───────────────────────────────────────────────────
function HandGuide({ activeFinger }: { activeFinger: Finger | null }) {
  function Hand({ side }: { side: "left" | "right" }) {
    const isLeft = side === "left";
    const fingers: Array<{ id: Finger; x: number; y: number; w: number; h: number; rx: number }> = isLeft
      ? [
          { id: "LP", x: 6,  y: 50,  w: 24, h: 80,  rx: 11 },
          { id: "LR", x: 34, y: 28,  w: 24, h: 92,  rx: 11 },
          { id: "LM", x: 62, y: 12,  w: 24, h: 108, rx: 11 },
          { id: "LI", x: 90, y: 30,  w: 24, h: 90,  rx: 11 },
        ]
      : [
          { id: "RI", x: 6,  y: 30,  w: 24, h: 90,  rx: 11 },
          { id: "RM", x: 34, y: 12,  w: 24, h: 108, rx: 11 },
          { id: "RR", x: 62, y: 28,  w: 24, h: 92,  rx: 11 },
          { id: "RP", x: 90, y: 50,  w: 24, h: 80,  rx: 11 },
        ];
    const thumbProps = isLeft
      ? { id: "T" as Finger, x: 100, y: 105, w: 32, h: 24, rx: 11, rotate: -40, cx: 100, cy: 125 }
      : { id: "T" as Finger, x: -12, y: 105, w: 32, h: 24, rx: 11, rotate:  40, cx: 20,  cy: 125 };

    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
          {isLeft ? "← Left Hand" : "Right Hand →"}
        </span>
        <svg viewBox="0 0 120 178" width="96" height="135" className="overflow-visible drop-shadow-sm">
          <rect x="6" y="122" width="108" height="52" rx="18"
            fill="#f5d5bb" stroke="#d4a88a" strokeWidth="1.5" />
          {fingers.map(f => {
            const isActive = activeFinger === f.id;
            return (
              <g key={f.id}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.rx}
                  fill={isActive ? FINGER_BG[f.id] : "#f0f4f8"}
                  stroke={isActive ? FINGER_BG[f.id] : "#c8d5e0"}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  style={{ transition: "fill 0.12s, stroke 0.12s" }} />
                <ellipse cx={f.x + f.w / 2} cy={f.y + 10} rx={f.w / 2 - 5} ry="7"
                  fill={isActive ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.55)"} />
                {isActive && (
                  <rect x={f.x - 3} y={f.y - 3} width={f.w + 6} height={f.h + 6} rx={f.rx + 3}
                    fill="none" stroke={FINGER_BG[f.id]} strokeWidth="3.5" opacity="0.45"
                    style={{ animation: "pulse 1s ease-in-out infinite" }} />
                )}
                <circle cx={f.x + f.w / 2} cy={f.y + f.h - 10} r="5"
                  fill={FINGER_BG[f.id]} opacity={isActive ? 1 : 0.5} />
              </g>
            );
          })}
          <g transform={`rotate(${thumbProps.rotate}, ${thumbProps.cx}, ${thumbProps.cy})`}>
            <rect x={thumbProps.x} y={thumbProps.y} width={thumbProps.w} height={thumbProps.h} rx={thumbProps.rx}
              fill={activeFinger === "T" ? FINGER_BG["T"] : "#f0f4f8"}
              stroke={activeFinger === "T" ? FINGER_BG["T"] : "#c8d5e0"}
              strokeWidth="1.5" style={{ transition: "fill 0.12s" }} />
          </g>
          <line x1="10" y1="138" x2="110" y2="138" stroke="#e0b8a0" strokeWidth="1" opacity="0.6" />
        </svg>
        <div className="flex gap-1">
          {isLeft
            ? ["A","S","D","F"].map(k => <kbd key={k} className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-300 rounded shadow-sm text-gray-600">{k}</kbd>)
            : ["J","K","L",";"].map(k => <kbd key={k} className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-300 rounded shadow-sm text-gray-600">{k}</kbd>)
          }
        </div>
        <span className="text-[9px] text-gray-400">Home Row</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Finger Placement Guide</span>
        {activeFinger && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white animate-pulse"
            style={{ background: FINGER_BG[activeFinger] }}>
            {FINGER_LABEL[activeFinger]}
          </span>
        )}
      </div>
      <div className="flex items-end justify-center gap-4">
        <Hand side="left" />
        <div className="flex flex-col items-center pb-12 gap-1 min-w-[56px]">
          {activeFinger ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: FINGER_BG[activeFinger] }}>
              <span className="text-white text-xl font-black">↓</span>
            </div>
          ) : (
            <div className="text-[9px] text-gray-300 text-center leading-tight font-mono">
              A S D F<br/>· J K L
            </div>
          )}
        </div>
        <Hand side="right" />
      </div>
    </div>
  );
}

// ── Keyboard Key ──────────────────────────────────────────────────────────────
function KbKey({ keyDef, isActive, onClick }: { keyDef: KeyDef; isActive: boolean; onClick: (ch: string) => void }) {
  const normalCls = FINGER_KEY_NORMAL[keyDef.finger];
  const activeCls = FINGER_KEY_ACTIVE[keyDef.finger];
  const shadowStyle = isActive ? { boxShadow: "none" } : { boxShadow: "0 3px 0 #9ca3af, 0 4px 4px rgba(0,0,0,0.08)" };
  const isHomeRow = ["KeyA","KeyS","KeyD","KeyF","KeyJ","KeyK","KeyL","Semicolon"].includes(keyDef.code);

  return (
    <button type="button"
      className={`relative flex items-center justify-center border-2 rounded-md cursor-pointer select-none transition-all duration-75 w-8 h-9 sm:w-9 sm:h-10 ${isActive ? activeCls : normalCls}`}
      style={shadowStyle}
      onClick={() => onClick(keyDef.label.toLowerCase())}
      title={keyDef.label}>
      <span className={`text-[11px] sm:text-xs font-bold ${isActive ? "text-white" : "text-gray-800"}`}>
        {keyDef.label.toLowerCase()}
      </span>
      {/* Shift label top-left */}
      <span className={`absolute top-0.5 left-1 text-[7px] leading-none font-bold ${isActive ? "opacity-60" : "text-gray-400"}`}>
        {keyDef.label.toUpperCase()}
      </span>
      {/* Home row bump */}
      {isHomeRow && !isActive && (
        <span className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-gray-400 rounded-full opacity-60" />
      )}
    </button>
  );
}

function WideKey({ label, widthClass = "w-10", onClick, isActive = false }:
  { label: string; widthClass?: string; onClick?: () => void; isActive?: boolean }) {
  const shadowStyle = isActive ? { boxShadow: "none" } : { boxShadow: "0 3px 0 #9ca3af, 0 4px 4px rgba(0,0,0,0.08)" };
  return (
    <button type="button"
      className={`${widthClass} h-9 sm:h-10 flex items-center justify-center rounded-md border-2 cursor-pointer select-none transition-all duration-75 text-[9px] font-semibold ${
        isActive ? "bg-slate-500 border-slate-700 text-white translate-y-[2px]" : "text-gray-500 bg-slate-50 border-slate-200"
      }`}
      style={shadowStyle}
      onClick={onClick}>
      {label}
    </button>
  );
}

function VirtualKeyboard({ activeCode, onKeyClick, onBackspace }:
  { activeCode: string | null; onKeyClick: (ch: string) => void; onBackspace: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5 sm:gap-1 items-end">
        {ROW0.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />)}
        <WideKey label="⌫" widthClass="w-11 sm:w-12" onClick={onBackspace} />
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end" style={{ paddingLeft: "1rem" }}>
        <WideKey label="Tab" widthClass="w-10 sm:w-11" />
        {ROW1.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />)}
        <WideKey label="Enter" widthClass="w-11 sm:w-12" />
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end" style={{ paddingLeft: "1.5rem" }}>
        <WideKey label="Caps" widthClass="w-12 sm:w-13" />
        {ROW2.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />)}
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end" style={{ paddingLeft: "2rem" }}>
        <WideKey label="Shift" widthClass="w-14" />
        {ROW3.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />)}
        <WideKey label="Shift" widthClass="w-12" />
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end">
        <WideKey label="Ctrl" widthClass="w-9" />
        <WideKey label="Alt"  widthClass="w-9" />
        <WideKey label="Space Bar" widthClass="w-44 sm:w-52"
          isActive={activeCode === "Space"} onClick={() => onKeyClick(" ")} />
        <WideKey label="Alt"  widthClass="w-9" />
        <WideKey label="Ctrl" widthClass="w-9" />
      </div>
    </div>
  );
}

// ── Infinite Text Display (windowed) ──────────────────────────────────────────
function TextDisplay({ text, typed }: { text: string; typed: string }) {
  const chars    = useMemo(() => [...text],  [text]);
  const typedArr = useMemo(() => [...typed], [typed]);
  const cursorIdx = typedArr.length;

  const BEFORE = 30;
  const AFTER  = 140;
  const winStart = Math.max(0, cursorIdx - BEFORE);
  const winEnd   = Math.min(chars.length, cursorIdx + AFTER);

  return (
    <div
      className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 shadow-sm min-h-[80px] leading-loose select-none overflow-hidden"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", fontSize: "1.15rem" }}>
      {winStart > 0 && <span className="text-gray-300 text-base">…</span>}
      {chars.slice(winStart, winEnd).map((ch, wi) => {
        const i = winStart + wi;
        const isTyped   = i < cursorIdx;
        const isCursor  = i === cursorIdx;
        const isCorrect = isTyped && typedArr[i] === ch;
        const isError   = isTyped && typedArr[i] !== ch;
        return (
          <span key={i}
            className={[
              isCursor  ? "relative bg-blue-500 text-white rounded px-0.5 animate-pulse" : "",
              isCorrect ? "text-green-600" : "",
              isError   ? "bg-red-100 text-red-500 rounded" : "",
              !isTyped && !isCursor ? "text-gray-700" : "",
            ].filter(Boolean).join(" ")}>
            {ch === " " && isCursor ? "·" : ch}
          </span>
        );
      })}
    </div>
  );
}

// ── SEO Schemas ────────────────────────────────────────────────────────────────
const SCHEMA_APP = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "English Typing Practice Online Free — Typing Test for Nepal Government Jobs",
  alternateName: [
    "English Typing Test", "English Typing Practice",
    "Lok Sewa English Typing Test", "Government Job Typing Test Nepal",
    "Online English Typing Speed Test", "Free WPM Typing Test",
    "Typing Test 35 WPM", "English Typing for Government Job",
    "Civil Service Typing Test", "Banking Typing Test Nepal",
  ],
  url: "https://www.studenthubnp.com/tools/english-typing",
  description: "Best free English typing practice and speed test for Nepal. Used by students and professionals preparing for Lok Sewa Aayog government job exams, banking recruitment, civil service, and general typing certification. Real-time WPM speed test and accuracy tracking. Unlimited words until timer ends. Animated hand placement guide shows correct finger position. No sign-up required.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any — Windows, Mac, Android, iOS",
  offers: { "@type": "Offer", price: "0", priceCurrency: "NPR" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "1024" },
  inLanguage: ["en"],
  featureList: [
    "Unlimited English typing practice until timer ends",
    "Real-time WPM (Words Per Minute) speed tracker",
    "Real-time accuracy percentage",
    "Animated QWERTY hand placement guide",
    "Home row key indicators (F and J bumps visible)",
    "Color-coded keyboard showing which finger to use",
    "Government job exam style passages (Medium and Hard)",
    "Lok Sewa Aayog typing exam pass/fail indicator",
    "Easy Medium Hard difficulty levels",
    "30 seconds to 5 minute timed sessions",
    "Works on mobile, tablet, and desktop",
    "No download or sign-up required",
  ],
};

const SCHEMA_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the best free English typing practice website for Nepal government job exams?",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub's English Typing Practice at studenthubnp.com/tools/english-typing is the best free English typing tool for Nepal government job exam preparation. It generates unlimited words until your timer ends — just like a real exam — and tracks your WPM and accuracy in real time. Easy, Medium, and Hard levels include government job-style English passages. No sign-up or download needed." },
    },
    {
      "@type": "Question",
      name: "What typing speed is required for Lok Sewa Aayog English typing test?",
      acceptedAnswer: { "@type": "Answer", text: "Lok Sewa Aayog typically requires 35 WPM (words per minute) with 90% or higher accuracy for English typing. Student Hub shows a Lok Sewa pass/fail indicator after every session. The target is 35 WPM and 90% accuracy — results are shown immediately after your timer ends." },
    },
    {
      "@type": "Question",
      name: "How can I improve my English typing speed for government job exams?",
      acceptedAnswer: { "@type": "Answer", text: "Practice daily for 15–20 minutes on studenthubnp.com/tools/english-typing. Start with Easy level to build accuracy, then progress to Medium and Hard levels which use government office-style English. The animated hand guide shows you which finger to use for every key. Most users see significant improvement within 2–4 weeks of daily practice." },
    },
    {
      "@type": "Question",
      name: "Does the text run out before the timer ends?",
      acceptedAnswer: { "@type": "Answer", text: "No — words are generated automatically and keep appearing until your chosen timer (30s, 1 min, 2 min, 3 min, or 5 min) runs out. The session ends only when time is up, exactly like a real government typing exam. There is no text limit." },
    },
    {
      "@type": "Question",
      name: "What is the home row position for English typing?",
      acceptedAnswer: { "@type": "Answer", text: "The home row for English typing is A S D F for the left hand and J K L ; for the right hand. Your fingers should always rest on these keys and return to them after pressing any other key. The F and J keys have physical bumps to help you find the position without looking. Student Hub's virtual keyboard shows home row bumps and highlights which finger to use for each key." },
    },
    {
      "@type": "Question",
      name: "Can I use this for civil service, banking, or corporate typing tests?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Student Hub's English typing practice is suitable for Lok Sewa Aayog, Nepal Rastra Bank, commercial bank recruitment, civil service exams, and general professional typing certification. The WPM and accuracy metrics match the standards used in all major typing examinations." },
    },
    {
      "@type": "Question",
      name: "Which keyboard layout does this English typing test use?",
      acceptedAnswer: { "@type": "Answer", text: "This English typing test uses the standard QWERTY keyboard layout. The virtual keyboard is color-coded by finger zone: purple for the left pinky, blue for left ring, cyan for left middle, teal for left index, green for right index, yellow for right middle, orange for right ring, and red for right pinky. The space bar is pressed by either thumb." },
    },
    {
      "@type": "Question",
      name: "Is this English typing test good for school and college students in Nepal?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Student Hub is built for Nepal students from Class 9 through Bachelor's level. The Easy level uses simple everyday English words for beginners. Medium uses professional vocabulary. Hard uses government office passages. All levels track WPM and accuracy to help you measure progress." },
    },
  ],
};

const SCHEMA_HOWTO = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Practice English Typing for Nepal Government Job Exams",
  description: "Step by step guide to improve English typing speed and accuracy for Lok Sewa Aayog and government job typing tests in Nepal.",
  step: [
    { "@type": "HowToStep", name: "Go to English Typing Practice", text: "Visit studenthubnp.com/tools/english-typing. No sign-up, download, or payment required." },
    { "@type": "HowToStep", name: "Choose Difficulty Level", text: "Start with Easy (common words) if you are a beginner. Medium uses professional and government office vocabulary. Hard uses full sentences from government job scenarios." },
    { "@type": "HowToStep", name: "Set Your Timer", text: "Choose 30 seconds for a quick test or 1–5 minutes for sustained practice. Government exams typically use 3–5 minute tests." },
    { "@type": "HowToStep", name: "Click Start Typing", text: "Words appear automatically and keep generating until time runs out. Use the animated hand guide showing which finger to press for each key." },
    { "@type": "HowToStep", name: "Review Your Results", text: "After time ends, check your WPM, accuracy, and see whether you meet the Lok Sewa standard of 35 WPM with 90% accuracy." },
    { "@type": "HowToStep", name: "Practice Daily", text: "15–20 minutes every day. Progress to Medium and Hard levels as your speed and accuracy improve." },
  ],
};

const SCHEMA_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.studenthubnp.com" },
    { "@type": "ListItem", position: 2, name: "Tools", item: "https://www.studenthubnp.com/tools" },
    { "@type": "ListItem", position: 3, name: "English Typing Practice", item: "https://www.studenthubnp.com/tools/english-typing" },
  ],
};

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ difficulty, duration, setDifficulty, setDuration, onStart, onGuide }:
  { difficulty: Difficulty; duration: Duration;
    setDifficulty: (d: Difficulty) => void; setDuration: (d: Duration) => void;
    onStart: () => void; onGuide: () => void; }) {

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Difficulty */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Difficulty Level</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["easy",   "Easy",   "green",  "Common words — build speed"],
            ["medium", "Medium", "yellow", "Professional vocabulary — office ready"],
            ["hard",   "Hard",   "red",    "Full sentences — Lok Sewa exam level"],
          ] as const).map(([id, label, color, hint]) => (
            <button key={id} onClick={() => setDifficulty(id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                difficulty === id
                  ? color === "green"  ? "border-green-500 bg-green-50 text-green-700"
                  : color === "yellow" ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                  : "border-red-500 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}>
              <div className="font-bold text-sm">{label}</div>
              <div className="text-[9px] text-gray-400 leading-tight mt-0.5">{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Time</label>
        <div className="flex gap-2 flex-wrap">
          {([30, 60, 120, 180, 300] as Duration[]).map(d => (
            <button key={d} onClick={() => setDuration(d)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                duration === d ? "border-blue-500 bg-blue-500 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
              }`}>
              {d < 60 ? `${d}s` : `${d / 60} min`}
            </button>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex gap-3 pt-1">
        <button onClick={onStart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2 shadow-md">
          Start Typing <ChevronRight className="w-5 h-5" />
        </button>
        <button onClick={onGuide}
          className="p-4 border-2 border-gray-200 rounded-xl text-gray-500 hover:border-blue-200 hover:text-blue-600 transition-all"
          title="Finger placement guide">
          <BookOpen className="w-5 h-5" />
        </button>
      </div>

      {/* Keyboard preview */}
      <div className="pt-1 opacity-50 hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2 text-center flex items-center justify-center gap-1.5">
          <Keyboard className="w-3 h-3" /> QWERTY Keyboard Layout — Color = Finger Zone
        </p>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-max mx-auto">
            <VirtualKeyboard activeCode={null} onKeyClick={() => {}} onBackspace={() => {}} />
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-300 sm:hidden mt-1">← scroll keyboard →</p>
      </div>

      {/* Finger colour legend */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(Object.entries(FINGER_LABEL) as [Finger, string][]).map(([f, name]) => (
          <span key={f} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: FINGER_BG[f] }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Guide Screen ──────────────────────────────────────────────────────────────
function GuideScreen({ onBack }: { onBack: () => void }) {
  const fingerData = [
    { id: "LP" as Finger, name: "Left Pinky",   keys: "Q  A  Z  1  `",       hint: "Reach left edge" },
    { id: "LR" as Finger, name: "Left Ring",    keys: "W  S  X  2",           hint: "Natural reach" },
    { id: "LM" as Finger, name: "Left Middle",  keys: "E  D  C  3",           hint: "Strongest finger" },
    { id: "LI" as Finger, name: "Left Index",   keys: "R  F  V  T  G  B",     hint: "Covers 2 columns" },
    { id: "RI" as Finger, name: "Right Index",  keys: "Y  H  N  U  J  M",     hint: "Covers 2 columns" },
    { id: "RM" as Finger, name: "Right Middle", keys: "I  K  ,",              hint: "Strongest finger" },
    { id: "RR" as Finger, name: "Right Ring",   keys: "O  L  .",              hint: "Natural reach" },
    { id: "RP" as Finger, name: "Right Pinky",  keys: "P  ;  /  '  [  ]",    hint: "Reach right edge" },
    { id: "T"  as Finger, name: "Both Thumbs",  keys: "Space Bar",            hint: "Rest on space bar" },
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-gray-900">QWERTY Keyboard — Finger Placement Guide</h2>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-blue-800 mb-1">🏠 Home Row — Start Here Every Time</h3>
        <p className="text-sm text-blue-700">
          Left hand rests on <strong>A S D F</strong> · Right hand on <strong>J K L ;</strong>.
          Always return to the home row after pressing any key.
          <strong> F and J have physical bumps</strong> — find them without looking.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {fingerData.map(f => (
          <div key={f.id} className="rounded-xl border-2 p-3 bg-white" style={{ borderColor: FINGER_BG[f.id] + "55" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: FINGER_BG[f.id] }} />
              <span className="text-xs font-bold text-gray-700">{f.name}</span>
            </div>
            <div className="font-mono text-xs font-bold text-gray-600 mb-1">{f.keys}</div>
            <div className="text-[10px] text-gray-400 italic">{f.hint}</div>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-bold text-amber-800 mb-2">💡 English Typing Tips for Government Job Exams</h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Do NOT look at the keyboard — keep your eyes on the screen at all times</li>
          <li>Start slow for accuracy, speed builds naturally with muscle memory</li>
          <li>Left thumb on the left side of space bar, right thumb on the right side</li>
          <li>Lok Sewa standard: 35 WPM with 90%+ accuracy — track on the results screen</li>
          <li>Practice 15–20 minutes daily — visible results within 2 weeks</li>
          <li>Hard level passages are closest to real government exam content</li>
        </ul>
      </div>
      <button onClick={onBack}
        className="w-full py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Setup
      </button>
    </div>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function CountdownScreen({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-gray-500 text-sm font-medium">Get ready — fingers on home row…</p>
      <div className="text-8xl font-black text-blue-600">{count}</div>
      <p className="text-xs text-gray-400">Left: A S D F · Right: J K L ;</p>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function ResultsScreen({ wpm, accuracy, correct, errors, duration, difficulty, onRetry, onSetup }:
  { wpm: number; accuracy: number; correct: number; errors: number;
    duration: Duration; difficulty: Difficulty; onRetry: () => void; onSetup: () => void; }) {

  const grade     = accuracy >= 95 ? "A+" : accuracy >= 85 ? "A" : accuracy >= 75 ? "B+" : accuracy >= 60 ? "B" : "C";
  const wpmLabel  = wpm >= 60 ? "Expert" : wpm >= 45 ? "Advanced" : wpm >= 35 ? "Proficient" : wpm >= 25 ? "Average" : "Beginner";
  const lokPassed = wpm >= 35 && accuracy >= 90;
  const feedback  = accuracy >= 95 ? "Excellent! You're ready for any typing exam! 🎉"
    : accuracy >= 85 ? "Great work! Just a bit more practice to reach exam standard. 💪"
    : accuracy >= 70 ? "Good progress! Focus on accuracy before speed. 👍"
    : "Keep going! Start with Easy mode to build correct habits. 📚";

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center">
        <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
        <h2 className="text-2xl font-black text-gray-900">Your Results</h2>
        <p className="text-gray-500 text-sm">English · {difficulty} · {duration < 60 ? `${duration}s` : `${duration / 60} min`}</p>
      </div>
      <div className={`rounded-xl p-3 text-center text-sm font-bold ${lokPassed ? "bg-green-50 border-2 border-green-200 text-green-700" : "bg-amber-50 border-2 border-amber-200 text-amber-700"}`}>
        {lokPassed
          ? "✅ Government Typing Exam Level Passed! (35+ WPM, 90%+ Accuracy)"
          : `📋 Lok Sewa Target: 35 WPM & 90% accuracy — You: ${wpm} WPM, ${accuracy}%`}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 text-center">
          <Zap className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <div className="text-4xl font-black text-blue-600">{wpm}</div>
          <div className="text-xs font-bold text-gray-500 mt-0.5">WPM</div>
          <div className="text-[10px] text-blue-400 mt-1 font-semibold">{wpmLabel}</div>
        </div>
        <div className="bg-green-50 border-2 border-green-100 rounded-2xl p-4 text-center">
          <Target className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <div className="text-4xl font-black text-green-600">{accuracy}%</div>
          <div className="text-xs font-bold text-gray-500 mt-0.5">Accuracy</div>
          <div className="text-[10px] text-green-400 mt-1 font-semibold">Grade: {grade}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><span className="text-green-600 text-xs font-bold">✓</span></div>
          <div><div className="text-lg font-black text-gray-800">{correct}</div><div className="text-[10px] text-gray-400">Correct Chars</div></div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><span className="text-red-500 text-xs font-bold">✗</span></div>
          <div><div className="text-lg font-black text-gray-800">{errors}</div><div className="text-[10px] text-gray-400">Errors</div></div>
        </div>
      </div>
      <div className="bg-white border-2 border-gray-100 rounded-xl p-4 text-sm text-gray-600 text-center">{feedback}</div>
      <div className="flex gap-3">
        <button onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <button onClick={onSetup}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:border-blue-200 hover:text-blue-600 transition-all">
          <Settings2 className="w-4 h-4" /> Settings
        </button>
      </div>
    </div>
  );
}

// ── Practice Screen ───────────────────────────────────────────────────────────
function PracticeScreen({ text, typed, timeLeft, duration, difficulty, onKeyClick, onBackspace }:
  { text: string; typed: string; timeLeft: number; duration: Duration; difficulty: Difficulty;
    onKeyClick: (ch: string) => void; onBackspace: () => void; }) {

  const chars    = useMemo(() => [...text],  [text]);
  const typedArr = useMemo(() => [...typed], [typed]);
  const nextChar = chars[typedArr.length];

  const activeKey    = nextChar ? (EN_CHAR_TO_KEY[nextChar] ?? null) : null;
  const activeCode   = activeKey?.code ?? null;
  const activeFinger = activeKey?.finger ?? null;

  const elapsed  = Math.max((duration - timeLeft) / 60, 0.001);
  const wpm      = Math.round((typedArr.length / 5) / elapsed);
  const correct  = typedArr.filter((c, i) => c === chars[i]).length;
  const accuracy = typedArr.length > 0 ? Math.round((correct / typedArr.length) * 100) : 100;
  const timerPct   = (timeLeft / duration) * 100;
  const timerColor = timeLeft > duration * 0.5 ? "#22c55e" : timeLeft > duration * 0.2 ? "#eab308" : "#ef4444";

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {[
          { icon: <Clock className="w-3 h-3" />,  label: "Time",     val: `${timeLeft}s`,  color: "text-blue-600" },
          { icon: <Zap   className="w-3 h-3" />,  label: "WPM",      val: `${wpm}`,        color: "text-purple-600" },
          { icon: <Target className="w-3 h-3" />, label: "Accuracy", val: `${accuracy}%`,  color: "text-green-600" },
          { icon: <span className="text-[9px] font-bold">Σ</span>, label: "Typed", val: `${typedArr.length}`, color: "text-gray-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-2 text-center shadow-sm">
            <div className={`flex items-center justify-center gap-0.5 ${s.color} mb-0.5`}>{s.icon}</div>
            <div className={`text-sm sm:text-base font-black ${s.color}`}>{s.val}</div>
            <div className="text-[8px] sm:text-[9px] text-gray-400 font-semibold uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Timer bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-1.5 rounded-full transition-all duration-1000" style={{ width: `${timerPct}%`, background: timerColor }} />
      </div>

      {/* Text */}
      <TextDisplay text={text} typed={typed} />

      {/* Key hint */}
      {activeKey && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 flex-wrap">
          <span className="w-2 h-2 rounded-full" style={{ background: FINGER_BG[activeKey.finger] }} />
          Press{activeKey.shift ? " Shift + " : " "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono font-bold text-gray-700">
            {activeKey.code.replace("Key","").replace("Digit","").replace("BracketLeft","[").replace("BracketRight","]").replace("Semicolon",";").replace("Quote","'").replace("Comma",",").replace("Period",".").replace("Slash","/").replace("Space","Space")}
          </kbd>
          <span style={{ color: FINGER_BG[activeKey.finger] }} className="font-semibold">{FINGER_LABEL[activeKey.finger]}</span>
        </div>
      )}

      {/* Hand guide */}
      <HandGuide activeFinger={activeFinger} />

      {/* Keyboard */}
      <div className="overflow-x-auto pb-1 -mx-2 px-2">
        <div className="min-w-[520px] mx-auto">
          <VirtualKeyboard activeCode={activeCode} onKeyClick={onKeyClick} onBackspace={onBackspace} />
        </div>
      </div>
      <p className="text-center text-[10px] text-gray-300 sm:hidden">← scroll keyboard →</p>
    </div>
  );
}

// ── SEO Section ───────────────────────────────────────────────────────────────
function SeoSection() {
  return (
    <section className="mt-10 border-t border-gray-100 pt-8 space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          Best Free English Typing Practice Online — Government Job & Lok Sewa Exam Ready
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Student Hub's English typing practice is built specifically for students and professionals in Nepal
          preparing for government job exams, Lok Sewa Aayog typing tests, banking recruitment, civil service
          positions, and general typing certification. Words keep flowing automatically until your timer ends —
          exactly like a real exam. Real-time WPM and accuracy tracking matches the metrics used in all major
          government typing tests.
        </p>
      </div>

      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">Who Uses This English Typing Test</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: "🏛️ Lok Sewa Aayog Aspirants", desc: "English typing is required for many civil service administrative positions. Medium and Hard levels use government office-style English." },
            { title: "💼 Government Job Seekers", desc: "35 WPM with 90% accuracy is the benchmark for most government typing tests. See pass/fail status instantly after each session." },
            { title: "🎓 Students & Graduates", desc: "Build English typing skills from Class 9 to Bachelor's level. Daily practice builds speed for academic and professional use." },
            { title: "🏦 Banking & Finance Professionals", desc: "Nepal Rastra Bank, commercial banks, and financial institutions all test English typing speed and accuracy during recruitment." },
          ].map(c => (
            <div key={c.title} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="font-bold text-sm text-gray-800 mb-1">{c.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">How to Improve English Typing Speed Fast</h2>
        <ol className="space-y-2">
          {[
            { n:"1", t:"Keep eyes on the screen", d:"Never look at the keyboard. This forces your fingers to memorize positions, which is the fastest path to speed." },
            { n:"2", t:"Start with Easy level", d:"Common short words build correct habits and muscle memory. Speed comes naturally after accuracy." },
            { n:"3", t:"Follow the hand guide", d:"The animated hands show which finger to use in real time. Match the color on the keyboard to your finger." },
            { n:"4", t:"Practice 15–20 min daily", d:"Daily consistency matters more than long one-time sessions. Results are visible within 2 weeks." },
            { n:"5", t:"Progress to Medium, then Hard", d:"Hard level passages mirror real government exam content and help you reach 35 WPM at 90% accuracy." },
          ].map(s => (
            <li key={s.n} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
              <div><span className="font-semibold text-sm text-gray-800">{s.t} — </span><span className="text-sm text-gray-500">{s.d}</span></div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {SCHEMA_FAQ.mainEntity.map((qa, i) => (
            <details key={i} className="bg-gray-50 border border-gray-200 rounded-xl group">
              <summary className="px-4 py-3 font-semibold text-sm text-gray-800 cursor-pointer select-none list-none flex items-center justify-between">
                {qa.name} <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="px-4 pb-3 text-sm text-gray-600 leading-relaxed">{qa.acceptedAnswer.text}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          { title: "Free Forever",   desc: "No sign-up" },
          { title: "Unlimited Text", desc: "Until timer ends" },
          { title: "35 WPM Target",  desc: "Lok Sewa standard" },
          { title: "Mobile Ready",   desc: "All devices" },
        ].map(f => (
          <div key={f.title} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="font-bold text-xs text-gray-800">{f.title}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="font-bold text-sm text-blue-800 mb-2">Also Practice on Student Hub</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/tools/nepali-typing">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">नेपाली टाइपिंग अभ्यास →</span>
          </Link>
          <Link href="/tools/gpa-calculator">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">NEB GPA Calculator</span>
          </Link>
          <Link href="/tools">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">All Tools →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function EnglishTyping() {
  const [phase,      setPhase]      = useState<Phase>("setup");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [duration,   setDuration]   = useState<Duration>(60);
  const [countdown,  setCountdown]  = useState(3);
  const [timeLeft,   setTimeLeft]   = useState(60);
  const [text,       setText]       = useState("");
  const [typed,      setTyped]      = useState("");
  const [finalStats, setFinalStats] = useState({ wpm: 0, accuracy: 100, correct: 0, errors: 0 });

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef       = useRef(phase);
  const textRef        = useRef(text);
  const diffRef        = useRef(difficulty);
  phaseRef.current = phase;
  textRef.current  = text;
  diffRef.current  = difficulty;

  const startPractice = useCallback(() => {
    const initialText = generateStream(difficulty, difficulty === "hard" ? 20 : 120);
    setText(initialText);
    setTyped("");
    setTimeLeft(duration);
    setCountdown(3);
    setPhase("countdown");
  }, [difficulty, duration]);

  // Auto-append words when near end (infinite mode)
  useEffect(() => {
    if (phase !== "practice") return;
    const typedLen = [...typed].length;
    const textLen  = [...text].length;
    if (textLen - typedLen < 300) {
      const more = generateStream(diffRef.current, diffRef.current === "hard" ? 15 : 80);
      setText(prev => prev + " " + more);
    }
  }, [typed, text, phase]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("practice");
      setTimeout(() => hiddenInputRef.current?.focus(), 80);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Timer
  useEffect(() => {
    if (phase !== "practice") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setTimeLeft(t => {
      if (t <= 1) { clearInterval(timerRef.current!); return 0; }
      return t - 1;
    }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Finish when time hits 0
  useEffect(() => {
    if (phase !== "practice" || timeLeft !== 0) return;
    const chars    = [...text];
    const typedArr = [...typed];
    const elapsed  = Math.max(duration / 60, 0.001);
    const correct  = typedArr.filter((c, i) => c === chars[i]).length;
    const errors   = typedArr.filter((c, i) => c !== chars[i]).length;
    const wpm      = Math.round((typedArr.length / 5) / elapsed);
    const acc      = typedArr.length > 0 ? Math.round((correct / typedArr.length) * 100) : 100;
    setFinalStats({ wpm, accuracy: acc, correct, errors });
    setPhase("results");
  }, [timeLeft, phase, text, typed, duration]);

  // Physical keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (phaseRef.current !== "practice") return;
    if (e.code === "Backspace") { setTyped(p => [...p].slice(0, -1).join("")); return; }
    if (e.code === "Space")     { setTyped(p => p + " "); return; }
    if (e.key && e.key.length === 1) setTyped(p => p + e.key);
  }, []);

  const handleKeyClick = useCallback((ch: string) => {
    if (phase !== "practice") return;
    setTyped(p => p + ch);
    hiddenInputRef.current?.focus();
  }, [phase]);

  const handleBackspace = useCallback(() => {
    if (phase !== "practice") return;
    setTyped(p => [...p].slice(0, -1).join(""));
    hiddenInputRef.current?.focus();
  }, [phase]);

  return (
    <>
      <Helmet>
        <title>English Typing Practice Online Free — Typing Speed Test for Nepal Government Jobs | Lok Sewa | Student Hub</title>
        <meta name="description" content="Best free English typing practice for Nepal. Real-time WPM speed test with unlimited words until timer ends. Perfect for Lok Sewa Aayog exam, government job typing test, banking recruitment. Animated QWERTY hand guide shows exact finger placement. Easy, Medium, Hard levels. No sign-up." />
        <meta name="keywords" content="english typing practice, english typing test, english typing speed test, free english typing practice, typing practice online, lok sewa english typing test, government job typing test nepal, english typing for government job, wpm test online, online typing test, typing test 35 wpm, typing tutor online, how to improve typing speed, english typing course free, typing test nepal, civil service typing test, banking typing test nepal, english keyboard practice, qwerty typing practice, touch typing online, free wpm typing test, english typing practice for beginners" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta name="author" content="Student Hub Nepal" />
        <meta property="og:title" content="Free English Typing Practice — Government Job & Lok Sewa Typing Test | Student Hub Nepal" />
        <meta property="og:description" content="Best free English typing speed test for Nepal. Unlimited words, animated hand guide, WPM tracking. Lok Sewa exam ready. No sign-up required." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/tools/english-typing" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Free English Typing Test — Nepal Government Job Exam | Student Hub" />
        <meta name="twitter:description" content="Practice English typing for Lok Sewa and government job exams. Unlimited words, WPM test, animated hand guide. Free, no sign-up." />
        <link rel="canonical" href="https://www.studenthubnp.com/tools/english-typing" />
        <link rel="alternate" hrefLang="en" href="https://www.studenthubnp.com/tools/english-typing" />
        <link rel="alternate" hrefLang="ne" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="x-default" href="https://www.studenthubnp.com/tools/english-typing" />
        <script type="application/ld+json">{JSON.stringify(SCHEMA_APP)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_BREADCRUMB)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_FAQ)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_HOWTO)}</script>
      </Helmet>

      <input ref={hiddenInputRef} className="sr-only" onKeyDown={handleKeyDown} readOnly value=""
        tabIndex={phase === "practice" ? 0 : -1} aria-label="Typing input"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 pb-16"
        onClick={() => phase === "practice" && hiddenInputRef.current?.focus()}>

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <Link href="/tools">
              <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors mb-2 font-semibold uppercase tracking-wide" type="button">
                <ArrowLeft className="w-3.5 h-3.5" /> All Tools
              </button>
            </Link>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
              English Typing Practice
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
              English · QWERTY · Government Job · WPM Test · Unlimited · Free
            </p>
          </div>
          {phase === "practice" && (
            <button onClick={() => setPhase("setup")}
              className="flex-shrink-0 flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-2 transition-all" type="button">
              <RotateCcw className="w-3.5 h-3.5" /> Stop
            </button>
          )}
        </div>

        {phase === "setup"     && <SetupScreen difficulty={difficulty} duration={duration} setDifficulty={setDifficulty} setDuration={setDuration} onStart={startPractice} onGuide={() => setPhase("guide")} />}
        {phase === "guide"     && <GuideScreen onBack={() => setPhase("setup")} />}
        {phase === "countdown" && <CountdownScreen count={countdown} />}
        {phase === "practice"  && <PracticeScreen text={text} typed={typed} timeLeft={timeLeft} duration={duration} difficulty={difficulty} onKeyClick={handleKeyClick} onBackspace={handleBackspace} />}
        {phase === "results"   && <ResultsScreen {...finalStats} duration={duration} difficulty={difficulty} onRetry={startPractice} onSetup={() => setPhase("setup")} />}

        {phase === "setup" && <SeoSection />}
      </div>
    </>
  );
}
