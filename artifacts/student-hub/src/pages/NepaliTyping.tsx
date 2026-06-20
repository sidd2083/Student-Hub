import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  ArrowLeft, RotateCcw, Trophy, Clock, Target, Zap,
  ChevronRight, BookOpen, RefreshCw, Settings2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Language   = "nepali" | "hindi";
type Difficulty = "easy" | "medium" | "hard";
type Duration   = 30 | 60 | 120 | 180 | 300;
type Phase      = "setup" | "guide" | "countdown" | "practice" | "results";
type Finger     = "LP" | "LR" | "LM" | "LI" | "RI" | "RM" | "RR" | "RP" | "T";

// ── Finger theme data ─────────────────────────────────────────────────────────
const FINGER_BG: Record<Finger, string> = {
  LP: "#9333ea", LR: "#3b82f6", LM: "#06b6d4", LI: "#14b8a6",
  RI: "#22c55e", RM: "#eab308", RR: "#f97316", RP: "#ef4444", T: "#94a3b8",
};
const FINGER_KEY_NORMAL: Record<Finger, string> = {
  LP: "bg-purple-50 border-purple-200",
  LR: "bg-blue-50   border-blue-200",
  LM: "bg-cyan-50   border-cyan-200",
  LI: "bg-teal-50   border-teal-200",
  RI: "bg-green-50  border-green-200",
  RM: "bg-yellow-50 border-yellow-200",
  RR: "bg-orange-50 border-orange-200",
  RP: "bg-red-50    border-red-200",
  T:  "bg-slate-50  border-slate-200",
};
const FINGER_KEY_ACTIVE: Record<Finger, string> = {
  LP: "bg-purple-500 border-purple-700 text-white !shadow-none translate-y-[3px]",
  LR: "bg-blue-500   border-blue-700   text-white !shadow-none translate-y-[3px]",
  LM: "bg-cyan-500   border-cyan-700   text-white !shadow-none translate-y-[3px]",
  LI: "bg-teal-500   border-teal-700   text-white !shadow-none translate-y-[3px]",
  RI: "bg-green-500  border-green-700  text-white !shadow-none translate-y-[3px]",
  RM: "bg-yellow-500 border-yellow-700 text-white !shadow-none translate-y-[3px]",
  RR: "bg-orange-500 border-orange-700 text-white !shadow-none translate-y-[3px]",
  RP: "bg-red-500    border-red-700    text-white !shadow-none translate-y-[3px]",
  T:  "bg-slate-500  border-slate-700  text-white !shadow-none translate-y-[3px]",
};
const FINGER_LABEL: Record<Finger, string> = {
  LP: "Left\nPinky", LR: "Left\nRing", LM: "Left\nMiddle", LI: "Left\nIndex",
  RI: "Right\nIndex", RM: "Right\nMiddle", RR: "Right\nRing", RP: "Right\nPinky", T: "Thumb",
};

// ── Keyboard Layout ───────────────────────────────────────────────────────────
interface KeyDef {
  code: string;
  label: string;   // physical key label
  np: string;      // Devanagari char (no shift)
  npS: string;     // Devanagari char (shift)
  finger: Finger;
  widthClass?: string; // Tailwind width override
}

// Row 0: Number row
const ROW0: KeyDef[] = [
  { code:"Backquote",  label:"`",  np:"्",  npS:"ँ",  finger:"LP" },
  { code:"Digit1",    label:"1",  np:"१",  npS:"!",  finger:"LP" },
  { code:"Digit2",    label:"2",  np:"२",  npS:"@",  finger:"LR" },
  { code:"Digit3",    label:"3",  np:"३",  npS:"#",  finger:"LM" },
  { code:"Digit4",    label:"4",  np:"४",  npS:"$",  finger:"LI" },
  { code:"Digit5",    label:"5",  np:"५",  npS:"%",  finger:"LI" },
  { code:"Digit6",    label:"6",  np:"६",  npS:"^",  finger:"RI" },
  { code:"Digit7",    label:"7",  np:"७",  npS:"&",  finger:"RI" },
  { code:"Digit8",    label:"8",  np:"८",  npS:"*",  finger:"RM" },
  { code:"Digit9",    label:"9",  np:"९",  npS:"(",  finger:"RR" },
  { code:"Digit0",    label:"0",  np:"०",  npS:")",  finger:"RP" },
  { code:"Minus",     label:"-",  np:"-",  npS:"_",  finger:"RP" },
  { code:"Equal",     label:"=",  np:"=",  npS:"+",  finger:"RP" },
];
// Row 1: QWERTY
const ROW1: KeyDef[] = [
  { code:"KeyQ",          label:"Q", np:"ट",  npS:"ठ",  finger:"LP" },
  { code:"KeyW",          label:"W", np:"ठ",  npS:"ऊ",  finger:"LR" },
  { code:"KeyE",          label:"E", np:"ु",  npS:"ए",  finger:"LM" },
  { code:"KeyR",          label:"R", np:"र",  npS:"ऋ",  finger:"LI" },
  { code:"KeyT",          label:"T", np:"त",  npS:"थ",  finger:"LI" },
  { code:"KeyY",          label:"Y", np:"य",  npS:"ञ",  finger:"RI" },
  { code:"KeyU",          label:"U", np:"ू",  npS:"उ",  finger:"RI" },
  { code:"KeyI",          label:"I", np:"ि",  npS:"ई",  finger:"RM" },
  { code:"KeyO",          label:"O", np:"ो",  npS:"औ",  finger:"RR" },
  { code:"KeyP",          label:"P", np:"प",  npS:"फ",  finger:"RP" },
  { code:"BracketLeft",   label:"[", np:"े",  npS:"ऐ",  finger:"RP" },
  { code:"BracketRight",  label:"]", np:"ं",  npS:"अं", finger:"RP" },
];
// Row 2: Home row
const ROW2: KeyDef[] = [
  { code:"KeyA",      label:"A", np:"ा",  npS:"आ",  finger:"LP" },
  { code:"KeyS",      label:"S", np:"स",  npS:"श",  finger:"LR" },
  { code:"KeyD",      label:"D", np:"द",  npS:"ध",  finger:"LM" },
  { code:"KeyF",      label:"F", np:"्",  npS:"फ",  finger:"LI" },
  { code:"KeyG",      label:"G", np:"ग",  npS:"घ",  finger:"LI" },
  { code:"KeyH",      label:"H", np:"ह",  npS:"ङ",  finger:"RI" },
  { code:"KeyJ",      label:"J", np:"ज",  npS:"झ",  finger:"RI" },
  { code:"KeyK",      label:"K", np:"क",  npS:"ख",  finger:"RM" },
  { code:"KeyL",      label:"L", np:"ल",  npS:"ळ",  finger:"RR" },
  { code:"Semicolon", label:";", np:"ः",  npS:"ः",  finger:"RP" },
];
// Row 3: Bottom row
const ROW3: KeyDef[] = [
  { code:"KeyZ",   label:"Z", np:"ँ",  npS:"ङ",  finger:"LP" },
  { code:"KeyX",   label:"X", np:"ं",  npS:"क्ष", finger:"LR" },
  { code:"KeyC",   label:"C", np:"च",  npS:"छ",  finger:"LM" },
  { code:"KeyV",   label:"V", np:"व",  npS:"ण",  finger:"LI" },
  { code:"KeyB",   label:"B", np:"ब",  npS:"भ",  finger:"LI" },
  { code:"KeyN",   label:"N", np:"न",  npS:"ण",  finger:"RI" },
  { code:"KeyM",   label:"M", np:"म",  npS:"म",  finger:"RI" },
  { code:"Comma",  label:",", np:",",  npS:"<",  finger:"RM" },
  { code:"Period", label:".", np:"।",  npS:">",  finger:"RR" },
  { code:"Slash",  label:"/", np:"्",  npS:"?",  finger:"RP" },
];
const ALL_KEY_ROWS = [ROW0, ROW1, ROW2, ROW3];

// Build lookup maps
const CHAR_TO_KEY: Record<string, { code: string; shift: boolean; finger: Finger }> = {};
const CODE_TO_NP: Record<string, string>  = {};
const CODE_TO_NPS: Record<string, string> = {};
for (const row of ALL_KEY_ROWS) {
  for (const k of row) {
    CODE_TO_NP[k.code]  = k.np;
    CODE_TO_NPS[k.code] = k.npS;
    if (k.np  && !CHAR_TO_KEY[k.np])  CHAR_TO_KEY[k.np]  = { code: k.code, shift: false, finger: k.finger };
    if (k.npS && !CHAR_TO_KEY[k.npS]) CHAR_TO_KEY[k.npS] = { code: k.code, shift: true,  finger: k.finger };
  }
}
CODE_TO_NP["Space"] = " ";
CHAR_TO_KEY[" "] = { code: "Space", shift: false, finger: "T" };

// ── Text Passages ─────────────────────────────────────────────────────────────
const TEXTS: Record<Language, Record<Difficulty, string[]>> = {
  nepali: {
    easy: [
      "राम घर जान्छ। सिता खाना बनाउँछे। हामी साथमा बस्छौं।",
      "नेपाल राम्रो देश हो। हिमाल ठूलो छ। नदी बग्छ।",
      "काम गर्नु राम्रो हो। पढ्नु अझ राम्रो हो। गर विकास।",
      "बाबा घर जानुभयो। आमा खाना पकाउनुभयो।",
      "तिमी कस्तो छौ? म ठिक छु। आज मौसम राम्रो छ।",
    ],
    medium: [
      "नेपाल एक सुन्दर देश हो जहाँ हिमाल, पहाड र तराई छन्। यहाँ धेरै जाति र धर्मका मानिसहरू छन्।",
      "विद्यार्थीले मन लगाएर पढे सबै कुरा सिक्न सकिन्छ। पढाइ नै जीवनको आधार हो। ज्ञान बढाउनु पर्छ।",
      "नेपालको राजधानी काठमाडौं हो। यो शहर धेरै पुरानो र ऐतिहासिक छ। यहाँ धेरै मन्दिर छन्।",
      "शिक्षाले मानिसलाई सभ्य र सुसंस्कृत बनाउँछ। राम्रो शिक्षाले देशको विकास हुन्छ।",
      "सगरमाथा संसारको सबभन्दा अग्लो पर्वत हो। यसको उचाइ ८८४८ मिटर छ। हरेक वर्ष धेरै पर्वतारोही आउँछन्।",
    ],
    hard: [
      "नेपाली भाषा देवनागरी लिपिमा लेखिन्छ। यो भाषा संस्कृतबाट विकास भएको हो। नेपाली साहित्य अत्यन्त समृद्ध छ।",
      "नेपालमा विभिन्न जाति, धर्म र संस्कृतिका मानिसहरू मिलेर बस्छन्। यहाँको विविधता नै यसको सुन्दरता हो।",
      "हाम्रो देशको विकासका लागि शिक्षा, स्वास्थ्य र पूर्वाधार निर्माणमा जोड दिनु अत्यन्त जरुरी छ।",
      "नेपालको भूगोल विविध छ। उत्तरमा हिमाल, मध्यमा पहाड र दक्षिणमा तराई फैलिएको छ। यही विविधताले नेपाललाई अनूठो बनाउँछ।",
    ],
  },
  hindi: {
    easy: [
      "राम घर जाता है। सीता खाना बनाती है। हम साथ रहते हैं।",
      "भारत एक महान देश है। पहाड़ ऊँचे हैं। नदी बहती है।",
      "काम करना अच्छा है। पढ़ना और भी अच्छा है।",
      "पिताजी घर गए। माँ खाना बना रही हैं।",
      "तुम कैसे हो? मैं ठीक हूँ। आज मौसम अच्छा है।",
    ],
    medium: [
      "भारत एक विशाल देश है जहाँ पहाड़, मैदान और समुद्र तट मिलकर बसे हैं। यहाँ अनेक जातियाँ हैं।",
      "विद्यार्थी मन लगाकर पढ़ें तो सब कुछ सीखा जा सकता है। पढ़ाई ही जीवन की नींव है।",
      "दिल्ली भारत की राजधानी है। यह शहर बहुत पुराना और ऐतिहासिक है। यहाँ कई मंदिर हैं।",
      "शिक्षा मनुष्य को सभ्य और संस्कारी बनाती है। अच्छी शिक्षा से देश का विकास होता है।",
      "एवरेस्ट दुनिया की सबसे ऊँची चोटी है। इसकी ऊँचाई ८८४८ मीटर है। हर साल कई पर्वतारोही आते हैं।",
    ],
    hard: [
      "हिंदी भाषा देवनागरी लिपि में लिखी जाती है। यह संस्कृत से विकसित हुई है। हिंदी साहित्य बहुत समृद्ध है।",
      "भारत में विभिन्न जाति, धर्म और संस्कृति के लोग मिलकर रहते हैं। यहाँ की विविधता ही इसकी सुंदरता है।",
      "हमारे देश के विकास के लिए शिक्षा, स्वास्थ्य और बुनियादी ढाँचे के निर्माण पर जोर देना बहुत जरूरी है।",
      "भारत की भूगोल विविध है। उत्तर में हिमालय, मध्य में मैदान और दक्षिण में समुद्र तट फैला है।",
    ],
  },
};

// ── SEO Schema ────────────────────────────────────────────────────────────────
const SCHEMA_APP = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Nepali Typing Practice Online — Free Typing Tutor",
  alternateName: ["नेपाली टाइपिंग अभ्यास", "Hindi Typing Practice", "हिंदी टाइपिंग"],
  url: "https://www.studenthubnp.com/tools/nepali-typing",
  description: "Free Nepali and Hindi typing practice tool. Virtual keyboard with real hand position guide, three difficulty levels, WPM tracking, and accuracy score. Best online Nepali typing tutor for Nepal and India.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any — works on Windows, Mac, Android, iOS",
  offers: { "@type": "Offer", price: "0", priceCurrency: "NPR" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "412" },
  inLanguage: ["ne", "hi", "en"],
  featureList: [
    "Nepali Unicode keyboard typing practice",
    "Hindi Devanagari typing practice",
    "Virtual on-screen keyboard",
    "Real-time finger placement guide with hand diagram",
    "Easy, Medium, Hard difficulty levels",
    "WPM (Words Per Minute) speed tracker",
    "Accuracy percentage tracking",
    "30 seconds to 5 minute sessions",
    "Mobile friendly — works on phone and tablet",
  ],
};
const SCHEMA_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.studenthubnp.com" },
    { "@type": "ListItem", position: 2, name: "Tools", item: "https://www.studenthubnp.com/tools" },
    { "@type": "ListItem", position: 3, name: "Nepali Typing Practice", item: "https://www.studenthubnp.com/tools/nepali-typing" },
  ],
};
const SCHEMA_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I practice Nepali typing online for free?",
      acceptedAnswer: { "@type": "Answer", text: "Use Student Hub's free Nepali Typing Practice. Select your language (Nepali or Hindi), difficulty level (Easy, Medium, Hard), and session time. The virtual keyboard shows which finger to use for each key. Click keys on-screen or enable Nepali keyboard input on your device." },
    },
    {
      "@type": "Question",
      name: "What is the best Nepali typing tutor online?",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub offers one of the best free Nepali typing tutors online. It features a virtual keyboard with color-coded finger guides, hand placement diagram, WPM tracking, and progressive difficulty levels — all completely free with no sign-up required." },
    },
    {
      "@type": "Question",
      name: "How to learn Hindi typing online free?",
      acceptedAnswer: { "@type": "Answer", text: "Switch to Hindi mode on Student Hub's typing tool. The Devanagari keyboard layout is the same for both Hindi and Nepali. Practice with Easy, Medium, or Hard level passages. Your WPM and accuracy are tracked in real time." },
    },
    {
      "@type": "Question",
      name: "Which keyboard layout is used for Nepali typing?",
      acceptedAnswer: { "@type": "Answer", text: "This tool uses the standard Nepali Unicode keyboard layout. Common letters: A=ा, S=स, D=द, F=् (virama), G=ग, H=ह, J=ज, K=क, L=ल, N=न, M=म, R=र, T=त, Y=य, P=प, E=ु, I=ि, O=ो. Shift+key gives additional characters." },
    },
    {
      "@type": "Question",
      name: "ऑनलाइन नेपाली टाइपिंग अभ्यास कहाँ गर्ने? (Where to practice Nepali typing online?)",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub नेपाली टाइपिंग अभ्यासको लागि उत्तम स्थान हो। यहाँ भर्चुअल किबोर्ड, औंला राख्ने गाइड, र WPM ट्र्याकर सहित निःशुल्क अभ्यास गर्न सकिन्छ।" },
    },
    {
      "@type": "Question",
      name: "हिंदी टाइपिंग ऑनलाइन कैसे सीखें? (How to learn Hindi typing online?)",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub पर Hindi mode चुनें। देवनागरी कीबोर्ड पर रंग-कोडेड उंगली गाइड के साथ अभ्यास करें। Easy level से शुरू करें और धीरे-धीरे Hard तक जाएं। WPM और Accuracy ट्रैक होती है।" },
    },
  ],
};

// ── SVG Hand Guide ────────────────────────────────────────────────────────────
function HandGuide({ activeFinger }: { activeFinger: Finger | null }) {
  function Hand({ side }: { side: "left" | "right" }) {
    const isLeft = side === "left";
    const fingers: Array<{ id: Finger; x: number; y: number; w: number; h: number; rx: number }> = isLeft
      ? [
          { id: "LP", x: 8,  y: 52, w: 22, h: 78, rx: 10 },
          { id: "LR", x: 34, y: 32, w: 22, h: 88, rx: 10 },
          { id: "LM", x: 60, y: 18, w: 22, h: 102, rx: 10 },
          { id: "LI", x: 86, y: 34, w: 22, h: 86, rx: 10 },
        ]
      : [
          { id: "RI", x: 12, y: 34, w: 22, h: 86, rx: 10 },
          { id: "RM", x: 38, y: 18, w: 22, h: 102, rx: 10 },
          { id: "RR", x: 64, y: 32, w: 22, h: 88, rx: 10 },
          { id: "RP", x: 90, y: 52, w: 22, h: 78, rx: 10 },
        ];
    const thumbL = { id: "T" as Finger, x: 94, y: 100, w: 30, h: 22, rx: 10, rotate: -35, cx: 94, cy: 120 };
    const thumbR = { id: "T" as Finger, x: -4, y: 100, w: 30, h: 22, rx: 10, rotate: 35, cx: 16, cy: 120 };
    const thumb  = isLeft ? thumbL : thumbR;

    const palmColor = "#f5d5bb";

    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase">
          {isLeft ? "Left Hand" : "Right Hand"}
        </span>
        <svg viewBox="0 0 120 170" width="90" height="127" className="overflow-visible">
          {/* Palm */}
          <rect x="8" y="116" width="104" height="50" rx="16" fill={palmColor} stroke="#d4a88a" strokeWidth="1.5" />
          {/* Fingers */}
          {fingers.map(f => {
            const isActive = activeFinger === f.id;
            const color = isActive ? FINGER_BG[f.id] : (FINGER_KEY_NORMAL[f.id] ? "#f0f0f0" : "#e0e0e0");
            return (
              <g key={f.id}>
                <rect
                  x={f.x} y={f.y} width={f.w} height={f.h} rx={f.rx}
                  fill={isActive ? FINGER_BG[f.id] : "#f0f4f8"}
                  stroke={isActive ? FINGER_BG[f.id] : "#cbd5e1"}
                  strokeWidth="1.5"
                  style={{ transition: "fill 0.15s, stroke 0.15s" }}
                />
                {/* Finger tip nail */}
                <ellipse
                  cx={f.x + f.w / 2} cy={f.y + 10}
                  rx={f.w / 2 - 4} ry="7"
                  fill={isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.5)"}
                />
                {/* Active ring */}
                {isActive && (
                  <rect
                    x={f.x - 2} y={f.y - 2} width={f.w + 4} height={f.h + 4} rx={f.rx + 2}
                    fill="none" stroke={FINGER_BG[f.id]} strokeWidth="3"
                    style={{ opacity: 0.6 }}
                  />
                )}
              </g>
            );
          })}
          {/* Thumb */}
          <g transform={`rotate(${thumb.rotate}, ${thumb.cx}, ${thumb.cy})`}>
            <rect
              x={thumb.x} y={thumb.y} width={thumb.w} height={thumb.h} rx={thumb.rx}
              fill={activeFinger === "T" ? FINGER_BG["T"] : "#f0f4f8"}
              stroke={activeFinger === "T" ? FINGER_BG["T"] : "#cbd5e1"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.15s" }}
            />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-center gap-4">
      <Hand side="left" />
      {/* Center label */}
      <div className="flex flex-col items-center justify-center pb-4">
        {activeFinger && (
          <div
            className="text-xs font-bold px-3 py-1.5 rounded-full text-white whitespace-pre text-center leading-tight"
            style={{ background: FINGER_BG[activeFinger] }}
          >
            {FINGER_LABEL[activeFinger].replace("\n", " ")}
          </div>
        )}
        {!activeFinger && (
          <div className="text-xs text-gray-300 text-center">Place fingers on<br/>A S D F · J K L ;</div>
        )}
      </div>
      <Hand side="right" />
    </div>
  );
}

// ── Real-looking keyboard key ─────────────────────────────────────────────────
function KbKey({
  keyDef,
  isActive,
  onClick,
  extraClass = "",
}: {
  keyDef: KeyDef;
  isActive: boolean;
  onClick: (ch: string) => void;
  extraClass?: string;
}) {
  const normalCls = FINGER_KEY_NORMAL[keyDef.finger];
  const activeCls = FINGER_KEY_ACTIVE[keyDef.finger];

  const base = [
    "relative flex flex-col items-center justify-center",
    "border-2 rounded-md cursor-pointer select-none",
    "transition-all duration-75",
    "w-9 h-10 sm:w-10 sm:h-11",
    extraClass,
  ].join(" ");

  const shadowStyle = isActive
    ? { boxShadow: "none" }
    : { boxShadow: `0 3px 0 ${isActive ? "transparent" : "#9ca3af"}, 0 4px 4px rgba(0,0,0,0.12)` };

  return (
    <button
      type="button"
      className={`${base} ${isActive ? activeCls : normalCls}`}
      style={shadowStyle}
      onClick={() => onClick(keyDef.np)}
      title={`${keyDef.label}: ${keyDef.np} | Shift: ${keyDef.npS}`}
    >
      {/* Shift character — top */}
      <span className={`absolute top-0.5 left-1.5 text-[8px] leading-none ${isActive ? "opacity-80" : "text-gray-400"}`}>
        {keyDef.npS}
      </span>
      {/* Main character */}
      <span className={`text-sm font-bold leading-none ${isActive ? "text-white" : "text-gray-800"}`}
        style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
        {keyDef.np}
      </span>
      {/* Physical label — bottom right */}
      <span className={`absolute bottom-0.5 right-1 text-[7px] leading-none font-mono ${isActive ? "opacity-60" : "text-gray-400"}`}>
        {keyDef.label}
      </span>
    </button>
  );
}

function WideKey({
  label, widthClass = "w-12", heightClass = "h-10 sm:h-11",
  onClick, isActive = false,
}: { label: string; widthClass?: string; heightClass?: string; onClick?: () => void; isActive?: boolean }) {
  const shadowStyle = isActive
    ? { boxShadow: "none" }
    : { boxShadow: "0 3px 0 #9ca3af, 0 4px 4px rgba(0,0,0,0.12)" };

  return (
    <button
      type="button"
      className={`${widthClass} ${heightClass} flex items-center justify-center rounded-md border-2 cursor-pointer select-none transition-all duration-75 text-[10px] font-semibold text-gray-500 ${
        isActive ? "bg-slate-500 border-slate-700 text-white !shadow-none translate-y-[3px]" : "bg-slate-50 border-slate-200"
      }`}
      style={shadowStyle}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function VirtualKeyboard({
  activeCode,
  onKeyClick,
  onBackspace,
}: {
  activeCode: string | null;
  onKeyClick: (ch: string) => void;
  onBackspace: () => void;
}) {
  const isSpaceActive = activeCode === "Space";

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Row 0 — Numbers */}
      <div className="flex gap-1 items-end">
        {ROW0.map(k => (
          <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />
        ))}
        <WideKey label="⌫ Back" widthClass="w-14 sm:w-16" onClick={onBackspace} />
      </div>
      {/* Row 1 — QWERTY (offset: ~0.25rem) */}
      <div className="flex gap-1 items-end" style={{ paddingLeft: "1.2rem" }}>
        <WideKey label="Tab" widthClass="w-12" />
        {ROW1.map(k => (
          <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />
        ))}
        <WideKey label="Enter" widthClass="w-14" />
      </div>
      {/* Row 2 — Home row (offset: ~0.5rem) */}
      <div className="flex gap-1 items-end" style={{ paddingLeft: "1.75rem" }}>
        <WideKey label="Caps" widthClass="w-14" />
        {ROW2.map(k => (
          <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />
        ))}
      </div>
      {/* Row 3 — Bottom (offset: ~0.75rem) */}
      <div className="flex gap-1 items-end" style={{ paddingLeft: "2.5rem" }}>
        <WideKey label="Shift" widthClass="w-16" />
        {ROW3.map(k => (
          <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} />
        ))}
        <WideKey label="Shift" widthClass="w-14" />
      </div>
      {/* Spacebar row */}
      <div className="flex gap-1 items-end">
        <WideKey label="Ctrl" widthClass="w-10" />
        <WideKey label="Alt" widthClass="w-10" />
        <WideKey
          label="Space Bar — खाली ठाउँ / स्पेस"
          widthClass="w-48 sm:w-56"
          isActive={isSpaceActive}
          onClick={() => onKeyClick(" ")}
        />
        <WideKey label="Alt" widthClass="w-10" />
        <WideKey label="Ctrl" widthClass="w-10" />
      </div>
    </div>
  );
}

// ── Text Display ──────────────────────────────────────────────────────────────
function TextDisplay({ text, typed }: { text: string; typed: string }) {
  const chars    = useMemo(() => [...text], [text]);
  const typedArr = useMemo(() => [...typed], [typed]);
  const cursorIdx = typedArr.length;

  return (
    <div
      className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 shadow-sm min-h-[90px] leading-loose select-none"
      style={{ fontFamily: "'Noto Sans Devanagari', 'Noto Serif Devanagari', sans-serif", fontSize: "1.25rem" }}
    >
      {chars.map((ch, i) => {
        const isTyped   = i < cursorIdx;
        const isCursor  = i === cursorIdx;
        const isCorrect = isTyped && typedArr[i] === ch;
        const isError   = isTyped && typedArr[i] !== ch;

        return (
          <span
            key={i}
            className={[
              isCursor  ? "relative bg-blue-500 text-white rounded px-0.5 animate-pulse" : "",
              isCorrect ? "text-green-600" : "",
              isError   ? "bg-red-100 text-red-500 rounded px-0.5" : "",
              !isTyped && !isCursor ? "text-gray-700" : "",
            ].join(" ")}
          >
            {ch === " " && isCursor ? "·" : ch}
          </span>
        );
      })}
      {/* End cursor */}
      {cursorIdx === chars.length && chars.length > 0 && (
        <span className="inline-block w-0.5 h-5 bg-green-500 animate-pulse ml-0.5 rounded" />
      )}
    </div>
  );
}

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({
  language, difficulty, duration,
  setLanguage, setDifficulty, setDuration,
  onStart, onGuide,
}: {
  language: Language; difficulty: Difficulty; duration: Duration;
  setLanguage: (l: Language) => void; setDifficulty: (d: Difficulty) => void; setDuration: (d: Duration) => void;
  onStart: () => void; onGuide: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Language */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Language / भाषा</label>
        <div className="grid grid-cols-2 gap-3">
          {([ ["nepali", "नेपाली", "Nepali"], ["hindi", "हिन्दी", "Hindi"] ] as const).map(([id, devLabel, enLabel]) => (
            <button key={id} onClick={() => setLanguage(id)}
              className={`p-4 rounded-xl border-2 font-medium transition-all text-center ${
                language === id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-blue-200"
              }`}>
              <div className="text-2xl leading-tight" style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>{devLabel}</div>
              <div className="text-xs text-gray-400 mt-0.5">{enLabel}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Difficulty Level</label>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["easy",   "Easy",   "green",  "Short words, simple sentences"],
            ["medium", "Medium", "yellow", "Full sentences, moderate complexity"],
            ["hard",   "Hard",   "red",    "Long paragraphs, compound words"],
          ] as const).map(([id, label, color, hint]) => (
            <button key={id} onClick={() => setDifficulty(id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                difficulty === id
                  ? color === "green"  ? "border-green-500  bg-green-50  text-green-700"
                  : color === "yellow" ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                  :                     "border-red-500    bg-red-50    text-red-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}>
              <div className="font-bold text-sm">{label}</div>
              <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Session Time</label>
        <div className="flex gap-2 flex-wrap">
          {([30, 60, 120, 180, 300] as Duration[]).map(d => (
            <button key={d} onClick={() => setDuration(d)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                duration === d ? "border-blue-500 bg-blue-500 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
              }`}>
              {d < 60 ? `${d}s` : `${d/60} min`}
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
          title="Keyboard guide">
          <BookOpen className="w-5 h-5" />
        </button>
      </div>

      {/* Keyboard preview */}
      <div className="pt-2 opacity-60 hover:opacity-100 transition-opacity overflow-x-auto pb-2">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2 text-center">Keyboard Layout Preview</p>
        <VirtualKeyboard activeCode={null} onKeyClick={() => {}} onBackspace={() => {}} />
      </div>
    </div>
  );
}

// ── Guide Screen ──────────────────────────────────────────────────────────────
function GuideScreen({ onBack }: { onBack: () => void }) {
  const fingerData: Array<{ id: Finger; name: string; keys: string; hint: string }> = [
    { id: "LP", name: "Left Pinky",   keys: "Q  A  Z  1  2",    hint: "Reach with your smallest finger" },
    { id: "LR", name: "Left Ring",    keys: "W  S  X  3",        hint: "Natural reach left" },
    { id: "LM", name: "Left Middle",  keys: "E  D  C  4",        hint: "Longest finger, key position" },
    { id: "LI", name: "Left Index",   keys: "R  F  V  T  G  B  5  6", hint: "Strongest finger, covers 2 cols" },
    { id: "RI", name: "Right Index",  keys: "Y  H  N  U  J  M  7", hint: "Covers 2 columns right" },
    { id: "RM", name: "Right Middle", keys: "I  K  ,  8",        hint: "Natural reach right" },
    { id: "RR", name: "Right Ring",   keys: "O  L  .  9",        hint: "Natural reach right" },
    { id: "RP", name: "Right Pinky",  keys: "P  ;  /  [  ]  0", hint: "Stretch right" },
    { id: "T",  name: "Both Thumbs",  keys: "Space Bar",         hint: "Always use thumbs for space" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Keyboard & Finger Guide</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-blue-800 mb-1">🏠 Home Row — Start Here</h3>
        <p className="text-sm text-blue-700">
          Rest your left fingers on <strong>A S D F</strong> and right fingers on <strong>J K L ;</strong>.
          This is the "home position" — always return here after typing any key.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {fingerData.map(f => (
          <div key={f.id} className="rounded-xl border-2 p-3 bg-white" style={{ borderColor: FINGER_BG[f.id] + "60" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: FINGER_BG[f.id] }} />
              <span className="text-xs font-bold text-gray-700">{f.name}</span>
            </div>
            <div className="font-mono text-sm font-bold text-gray-600 mb-1">{f.keys}</div>
            <div className="text-[10px] text-gray-400">{f.hint}</div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-bold text-amber-800 mb-1">💡 Pro Tips</h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Look at the screen, not the keyboard — this builds muscle memory</li>
          <li>Start slow and focus on accuracy — speed comes naturally</li>
          <li>Use the virtual keyboard or enable Nepali Unicode on your system</li>
          <li>Windows: Settings → Language → Add Nepali · Mac: System Settings → Keyboard → Input Sources</li>
        </ul>
      </div>

      <button onClick={onBack}
        className="w-full py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Setup
      </button>
    </div>
  );
}

// ── Countdown Screen ──────────────────────────────────────────────────────────
function CountdownScreen({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-gray-500">Get ready...</p>
      <div className="text-8xl font-black text-blue-600" style={{ animation: "pulse 0.8s ease-in-out infinite" }}>
        {count}
      </div>
    </div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────
function ResultsScreen({
  wpm, accuracy, correct, errors, duration, language, difficulty,
  onRetry, onSetup,
}: {
  wpm: number; accuracy: number; correct: number; errors: number;
  duration: Duration; language: Language; difficulty: Difficulty;
  onRetry: () => void; onSetup: () => void;
}) {
  const grade = accuracy >= 95 ? "A+" : accuracy >= 85 ? "A" : accuracy >= 75 ? "B+" : accuracy >= 60 ? "B" : accuracy >= 50 ? "C" : "D";
  const wpmLabel = wpm >= 40 ? "Fast" : wpm >= 25 ? "Average" : wpm >= 15 ? "Slow" : "Beginner";
  const feedback =
    accuracy >= 95 ? "Excellent! You are a Nepali typing expert. 🎉"
    : accuracy >= 85 ? "Great job! Keep practicing to reach expert level. 💪"
    : accuracy >= 70 ? "Good progress! Focus on accuracy before speed. 👍"
    : "Keep going! Start with Easy mode and build muscle memory. 📚";

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="text-center">
        <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
        <h2 className="text-2xl font-black text-gray-900">Your Results</h2>
        <p className="text-gray-500 text-sm">
          {language === "nepali" ? "Nepali" : "Hindi"} · {difficulty} · {duration < 60 ? `${duration}s` : `${duration/60} min`}
        </p>
      </div>

      {/* WPM + Accuracy big stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-5 text-center">
          <Zap className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <div className="text-4xl font-black text-blue-600">{wpm}</div>
          <div className="text-xs font-bold text-gray-500 mt-0.5">WPM</div>
          <div className="text-[10px] text-blue-400 mt-1 font-semibold">{wpmLabel}</div>
        </div>
        <div className="bg-green-50 border-2 border-green-100 rounded-2xl p-5 text-center">
          <Target className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <div className="text-4xl font-black text-green-600">{accuracy}%</div>
          <div className="text-xs font-bold text-gray-500 mt-0.5">Accuracy</div>
          <div className="text-[10px] text-green-400 mt-1 font-semibold">Grade: {grade}</div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-xs font-bold">✓</span>
          </div>
          <div>
            <div className="text-lg font-black text-gray-800">{correct}</div>
            <div className="text-[10px] text-gray-400">Correct chars</div>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-500 text-xs font-bold">✗</span>
          </div>
          <div>
            <div className="text-lg font-black text-gray-800">{errors}</div>
            <div className="text-[10px] text-gray-400">Errors</div>
          </div>
        </div>
      </div>

      {/* Feedback */}
      <div className="bg-white border-2 border-gray-100 rounded-xl p-4 text-sm text-gray-600 text-center">
        {feedback}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <button onClick={onSetup}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:border-blue-200 hover:text-blue-600 transition-all">
          <Settings2 className="w-4 h-4" /> Change Settings
        </button>
      </div>
    </div>
  );
}

// ── Practice Screen ───────────────────────────────────────────────────────────
function PracticeScreen({
  text, typed, timeLeft, duration, language,
  onKeyClick, onBackspace,
}: {
  text: string; typed: string; timeLeft: number; duration: Duration; language: Language;
  onKeyClick: (ch: string) => void; onBackspace: () => void;
}) {
  const chars = useMemo(() => [...text], [text]);
  const typedArr = useMemo(() => [...typed], [typed]);

  const nextChar = chars[typedArr.length];
  const activeKey = nextChar ? (CHAR_TO_KEY[nextChar] ?? null) : null;
  const activeCode = activeKey?.code ?? null;
  const activeFinger = activeKey?.finger ?? null;

  const elapsed = Math.max((duration - timeLeft) / 60, 0.001);
  const wpm = Math.round((typedArr.length / 5) / elapsed);
  const correct = typedArr.filter((c, i) => c === chars[i]).length;
  const accuracy = typedArr.length > 0 ? Math.round((correct / typedArr.length) * 100) : 100;
  const progress = chars.length > 0 ? Math.round((typedArr.length / chars.length) * 100) : 0;

  const timerPct = (timeLeft / duration) * 100;
  const timerColor = timeLeft > duration * 0.5 ? "#22c55e" : timeLeft > duration * 0.2 ? "#eab308" : "#ef4444";

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: <Clock className="w-3.5 h-3.5" />, label: "Time Left", val: `${timeLeft}s`, color: "text-blue-600" },
          { icon: <Zap   className="w-3.5 h-3.5" />, label: "WPM",       val: `${wpm}`,     color: "text-purple-600" },
          { icon: <Target className="w-3.5 h-3.5"/>, label: "Accuracy",  val: `${accuracy}%`,color: "text-green-600" },
          { icon: <span className="text-xs font-bold">{progress}%</span>, label: "Progress", val: `${typedArr.length}/${chars.length}`, color: "text-gray-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-2.5 text-center shadow-sm">
            <div className={`flex items-center justify-center gap-1 ${s.color} mb-0.5`}>{s.icon}</div>
            <div className={`text-base font-black ${s.color}`}>{s.val}</div>
            <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">{s.label}</div>
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
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: FINGER_BG[activeKey.finger] }} />
          Press{activeKey.shift ? " Shift + " : " "}
          <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono font-bold text-gray-700">
            {activeKey.code.replace("Key", "").replace("Digit", "").replace("BracketLeft", "[").replace("BracketRight", "]").replace("Semicolon", ";").replace("Comma", ",").replace("Period", ".").replace("Slash", "/").replace("Backquote", "`")}
          </kbd>
          &nbsp;·&nbsp;
          <span style={{ color: FINGER_BG[activeKey.finger] }} className="font-semibold text-xs">
            {FINGER_LABEL[activeKey.finger].replace("\n", " ")}
          </span>
        </div>
      )}

      {/* Hand guide */}
      <div className="flex justify-center">
        <HandGuide activeFinger={activeFinger} />
      </div>

      {/* Keyboard */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-max mx-auto">
          <VirtualKeyboard activeCode={activeCode} onKeyClick={onKeyClick} onBackspace={onBackspace} />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NepaliTyping() {
  const [phase,      setPhase]      = useState<Phase>("setup");
  const [language,   setLanguage]   = useState<Language>("nepali");
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
  phaseRef.current = phase;

  const pickText = (lang: Language, diff: Difficulty) => {
    const pool = TEXTS[lang][diff];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const startPractice = useCallback(() => {
    const t = pickText(language, difficulty);
    setText(t);
    setTyped("");
    setTimeLeft(duration);
    setCountdown(3);
    setPhase("countdown");
  }, [language, difficulty, duration]);

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
    timerRef.current = setInterval(() => setTimeLeft(t => Math.max(t - 1, 0)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Detect finish
  useEffect(() => {
    if (phase !== "practice") return;
    const chars = [...text];
    const typedArr = [...typed];
    if (timeLeft === 0 || typedArr.length >= chars.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      const elapsed = Math.max((duration - timeLeft) / 60, 0.001);
      const correct = typedArr.filter((c, i) => c === chars[i]).length;
      const errors  = typedArr.filter((c, i) => c !== chars[i]).length;
      const wpm     = Math.round((typedArr.length / 5) / elapsed);
      const acc     = typedArr.length > 0 ? Math.round((correct / typedArr.length) * 100) : 100;
      setFinalStats({ wpm, accuracy: acc, correct, errors });
      setPhase("results");
    }
  }, [timeLeft, typed, text, phase, duration]);

  // Physical keyboard — map key codes → Devanagari
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (phaseRef.current !== "practice") return;
    if (e.code === "Backspace") {
      setTyped(p => [...p].slice(0, -1).join(""));
      return;
    }
    if (e.code === "Space") {
      setTyped(p => {
        const chars = [...text];
        if ([...p].length >= chars.length) return p;
        return p + " ";
      });
      return;
    }
    const ch = e.shiftKey ? CODE_TO_NPS[e.code] : CODE_TO_NP[e.code];
    if (ch) {
      setTyped(p => {
        const chars = [...text];
        if ([...p].length >= chars.length) return p;
        return p + ch;
      });
    }
  }, [text]);

  const handleKeyClick = useCallback((ch: string) => {
    if (phase !== "practice") return;
    setTyped(p => {
      const chars = [...text];
      if ([...p].length >= chars.length) return p;
      return p + ch;
    });
    hiddenInputRef.current?.focus();
  }, [phase, text]);

  const handleBackspace = useCallback(() => {
    if (phase !== "practice") return;
    setTyped(p => [...p].slice(0, -1).join(""));
    hiddenInputRef.current?.focus();
  }, [phase]);

  // Click-to-focus on the practice area
  const handleAreaClick = useCallback(() => {
    if (phase === "practice") hiddenInputRef.current?.focus();
  }, [phase]);

  return (
    <>
      <Helmet>
        <title>Nepali Typing Practice Online Free — नेपाली टाइपिंग | Hindi Typing Tutor | Student Hub</title>
        <meta name="description" content="Best free Nepali typing practice online. Type in Nepali (नेपाली) and Hindi (हिंदी) with a real virtual keyboard, hand position guide, WPM speed test and accuracy tracker. Easy Medium Hard levels. No sign-up. Used by students in Nepal and India. नेपाली टाइपिंग अभ्यास — हिंदी टाइपिंग सीखें।" />
        <meta name="keywords" content="nepali typing practice, nepali typing online, learn nepali typing, nepali typing tutor, nepali typing test, hindi typing practice, hindi typing online, hindi typing tutor, hindi typing test, devanagari typing practice, online nepali keyboard, type in nepali online, nepali unicode typing, nepali typing speed test, hindi typing speed test, नेपाली टाइपिंग, हिंदी टाइपिंग, नेपाली टाइपिंग अभ्यास, हिंदी टाइपिंग अभ्यास, nepali keyboard layout, devanagari keyboard, free typing tutor, online typing practice nepal, typing practice hindi nepali, how to type in nepali, how to type in hindi" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta name="author" content="Student Hub Nepal" />
        <meta property="og:title" content="Nepali Typing Practice Online — Free | नेपाली & हिंदी टाइपिंग Tutor" />
        <meta property="og:description" content="Best free Nepali and Hindi typing practice. Virtual keyboard with hand guide, WPM tracker, Easy/Medium/Hard levels. No sign-up. Works on all devices." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/tools/nepali-typing" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta property="og:locale" content="ne_NP" />
        <meta property="og:locale:alternate" content="hi_IN" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Free Nepali & Hindi Typing Practice — Student Hub" />
        <meta name="twitter:description" content="Best free Nepali and Hindi typing tutor online. Virtual keyboard, hand guide, WPM test. No sign-up needed." />
        <link rel="canonical" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="ne" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="hi" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="en" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="x-default" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <script type="application/ld+json">{JSON.stringify(SCHEMA_APP)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_BREADCRUMB)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_FAQ)}</script>
      </Helmet>

      {/* Hidden input for physical keyboard capture */}
      <input
        ref={hiddenInputRef}
        className="sr-only"
        onKeyDown={handleKeyDown}
        readOnly
        value=""
        tabIndex={phase === "practice" ? 0 : -1}
        aria-label="Typing input"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-12" onClick={handleAreaClick}>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link href="/tools">
              <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors mb-2 font-semibold uppercase tracking-wide" type="button">
                <ArrowLeft className="w-3.5 h-3.5" /> All Tools
              </button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
              Nepali Typing Practice
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              नेपाली &amp; हिंदी · Virtual Keyboard · Hand Guide · WPM Test · Free
            </p>
          </div>
          {phase === "practice" && (
            <button onClick={() => setPhase("setup")}
              className="flex-shrink-0 flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-2 transition-all" type="button">
              <RotateCcw className="w-3.5 h-3.5" /> Stop
            </button>
          )}
        </div>

        {/* Phase screens */}
        {phase === "setup"     && <SetupScreen language={language} difficulty={difficulty} duration={duration} setLanguage={setLanguage} setDifficulty={setDifficulty} setDuration={setDuration} onStart={startPractice} onGuide={() => setPhase("guide")} />}
        {phase === "guide"     && <GuideScreen onBack={() => setPhase("setup")} />}
        {phase === "countdown" && <CountdownScreen count={countdown} />}
        {phase === "practice"  && <PracticeScreen text={text} typed={typed} timeLeft={timeLeft} duration={duration} language={language} onKeyClick={handleKeyClick} onBackspace={handleBackspace} />}
        {phase === "results"   && <ResultsScreen {...finalStats} duration={duration} language={language} difficulty={difficulty} onRetry={startPractice} onSetup={() => setPhase("setup")} />}

        {/* SEO content — visible only on setup */}
        {phase === "setup" && (
          <section className="mt-12 border-t border-gray-100 pt-8 space-y-8">
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">About This Nepali Typing Practice Tool</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                This is a <strong>free online Nepali typing practice</strong> tool designed for students and professionals in Nepal and India. Practice typing in <strong>Nepali (नेपाली)</strong> and <strong>Hindi (हिन्दी)</strong> using the standard Devanagari Unicode keyboard layout. The interactive virtual keyboard shows which finger to use for each key, with a real-time hand position diagram — just like professional typing tutors.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">How to Learn Nepali &amp; Hindi Typing Fast</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Start with <strong>Easy level</strong> and short sessions (30–60 seconds). Focus on <strong>accuracy over speed</strong> — your WPM will naturally improve. The color-coded finger guide shows you exactly which finger to use. Practice daily for 10–15 minutes to see significant improvement within a week.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {SCHEMA_FAQ.mainEntity.map((qa, i) => (
                  <details key={i} className="bg-gray-50 border border-gray-200 rounded-xl">
                    <summary className="px-4 py-3 font-semibold text-sm text-gray-800 cursor-pointer select-none list-none flex items-center justify-between">
                      {qa.name} <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </summary>
                    <p className="px-4 pb-3 text-sm text-gray-600">{qa.acceptedAnswer.text}</p>
                  </details>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-center">
              {[
                { title: "Free Forever", desc: "No subscription, no account needed" },
                { title: "Nepali + Hindi", desc: "Both Devanagari languages supported" },
                { title: "All Devices", desc: "Works on phone, tablet, and desktop" },
              ].map(f => (
                <div key={f.title} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="font-bold text-sm text-gray-800">{f.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{f.desc}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
