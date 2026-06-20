import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  ArrowLeft, RotateCcw, Trophy, Clock, Target, Zap,
  BookOpen, Keyboard, ChevronRight, CheckCircle2, XCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Language   = "nepali" | "hindi";
type Difficulty = "easy" | "medium" | "hard";
type Duration   = 30 | 60 | 120 | 180 | 300;
type Phase      = "setup" | "guide" | "countdown" | "practice" | "results";
type Finger     = "LP" | "LR" | "LM" | "LI" | "RI" | "RM" | "RR" | "RP" | "T";

// ── Keyboard Layout Data ──────────────────────────────────────────────────────
interface KeyDef {
  code: string;
  label: string;
  np: string;       // no-shift Nepali/Devanagari character
  npS: string;      // shift Nepali/Devanagari character
  finger: Finger;
  wide?: boolean;
}

// finger → tailwind bg classes (normal / active)
const F_NORMAL: Record<Finger, string> = {
  LP: "bg-purple-50  border-purple-200 text-purple-800",
  LR: "bg-blue-50    border-blue-200   text-blue-800",
  LM: "bg-cyan-50    border-cyan-200   text-cyan-800",
  LI: "bg-teal-50    border-teal-200   text-teal-800",
  RI: "bg-green-50   border-green-200  text-green-800",
  RM: "bg-yellow-50  border-yellow-200 text-yellow-800",
  RR: "bg-orange-50  border-orange-200 text-orange-800",
  RP: "bg-red-50     border-red-200    text-red-800",
  T:  "bg-gray-50    border-gray-200   text-gray-800",
};
const F_ACTIVE: Record<Finger, string> = {
  LP: "bg-purple-400 border-purple-600 text-white scale-110 shadow-lg shadow-purple-200",
  LR: "bg-blue-400   border-blue-600   text-white scale-110 shadow-lg shadow-blue-200",
  LM: "bg-cyan-400   border-cyan-600   text-white scale-110 shadow-lg shadow-cyan-200",
  LI: "bg-teal-400   border-teal-600   text-white scale-110 shadow-lg shadow-teal-200",
  RI: "bg-green-400  border-green-600  text-white scale-110 shadow-lg shadow-green-200",
  RM: "bg-yellow-400 border-yellow-600 text-white scale-110 shadow-lg shadow-yellow-200",
  RR: "bg-orange-400 border-orange-600 text-white scale-110 shadow-lg shadow-orange-200",
  RP: "bg-red-400    border-red-600    text-white scale-110 shadow-lg shadow-red-200",
  T:  "bg-gray-400   border-gray-600   text-white scale-110 shadow-lg shadow-gray-200",
};
const F_LABEL: Record<Finger, string> = {
  LP: "कान्छी औंला (Pinky)",   LR: "अनामिका (Ring)",    LM: "माझी औंला (Middle)",
  LI: "चोर औंला (Index)",     RI: "चोर औंला (Index)",  RM: "माझी औंला (Middle)",
  RR: "अनामिका (Ring)",        RP: "कान्छी औंला (Pinky)", T: "बुढी औंला (Thumb)",
};
const F_COLOR_DOT: Record<Finger, string> = {
  LP: "bg-purple-400", LR: "bg-blue-400", LM: "bg-cyan-400", LI: "bg-teal-400",
  RI: "bg-green-400",  RM: "bg-yellow-400", RR: "bg-orange-400", RP: "bg-red-400", T: "bg-gray-400",
};

const ROW1: KeyDef[] = [
  { code: "Digit1", label: "1", np: "१", npS: "!", finger: "LP" },
  { code: "Digit2", label: "2", np: "२", npS: "@", finger: "LR" },
  { code: "Digit3", label: "3", np: "३", npS: "#", finger: "LM" },
  { code: "Digit4", label: "4", np: "४", npS: "$", finger: "LI" },
  { code: "Digit5", label: "5", np: "५", npS: "%", finger: "LI" },
  { code: "Digit6", label: "6", np: "६", npS: "^", finger: "RI" },
  { code: "Digit7", label: "7", np: "७", npS: "&", finger: "RI" },
  { code: "Digit8", label: "8", np: "८", npS: "*", finger: "RM" },
  { code: "Digit9", label: "9", np: "९", npS: "(", finger: "RR" },
  { code: "Digit0", label: "0", np: "०", npS: ")", finger: "RP" },
];
const ROW2: KeyDef[] = [
  { code: "KeyQ", label: "Q", np: "ट", npS: "ठ", finger: "LP" },
  { code: "KeyW", label: "W", np: "ठ", npS: "ऊ", finger: "LR" },
  { code: "KeyE", label: "E", np: "ु", npS: "ए", finger: "LM" },
  { code: "KeyR", label: "R", np: "र", npS: "ऋ", finger: "LI" },
  { code: "KeyT", label: "T", np: "त", npS: "थ", finger: "LI" },
  { code: "KeyY", label: "Y", np: "य", npS: "ञ", finger: "RI" },
  { code: "KeyU", label: "U", np: "ू", npS: "उ", finger: "RI" },
  { code: "KeyI", label: "I", np: "ि", npS: "ई", finger: "RM" },
  { code: "KeyO", label: "O", np: "ो", npS: "औ", finger: "RR" },
  { code: "KeyP", label: "P", np: "प", npS: "फ", finger: "RP" },
  { code: "BracketLeft",  label: "[", np: "े", npS: "ऐ", finger: "RP" },
  { code: "BracketRight", label: "]", np: "ं", npS: "अं", finger: "RP" },
];
const ROW3: KeyDef[] = [
  { code: "KeyA", label: "A", np: "ा", npS: "आ", finger: "LP" },
  { code: "KeyS", label: "S", np: "स", npS: "श", finger: "LR" },
  { code: "KeyD", label: "D", np: "द", npS: "ध", finger: "LM" },
  { code: "KeyF", label: "F", np: "्", npS: "फ", finger: "LI" },
  { code: "KeyG", label: "G", np: "ग", npS: "घ", finger: "LI" },
  { code: "KeyH", label: "H", np: "ह", npS: "ङ", finger: "RI" },
  { code: "KeyJ", label: "J", np: "ज", npS: "झ", finger: "RI" },
  { code: "KeyK", label: "K", np: "क", npS: "ख", finger: "RM" },
  { code: "KeyL", label: "L", np: "ल", npS: "ळ", finger: "RR" },
  { code: "Semicolon", label: ";", np: "ः", npS: "ः", finger: "RP" },
];
const ROW4: KeyDef[] = [
  { code: "KeyZ", label: "Z", np: "ँ", npS: "ङ", finger: "LP" },
  { code: "KeyX", label: "X", np: "ं", npS: "क्ष", finger: "LR" },
  { code: "KeyC", label: "C", np: "च", npS: "छ", finger: "LM" },
  { code: "KeyV", label: "V", np: "व", npS: "ण", finger: "LI" },
  { code: "KeyB", label: "B", np: "ब", npS: "भ", finger: "LI" },
  { code: "KeyN", label: "N", np: "न", npS: "ण", finger: "RI" },
  { code: "KeyM", label: "M", np: "म", npS: "म", finger: "RI" },
  { code: "Comma", label: ",", np: ",", npS: "<", finger: "RM" },
  { code: "Period", label: ".", np: "।", npS: ">", finger: "RR" },
];
const ALL_ROWS = [ROW1, ROW2, ROW3, ROW4];

// Build char → { code, shift, finger } lookup
const CHAR_TO_KEY: Record<string, { code: string; shift: boolean; finger: Finger }> = {};
for (const row of ALL_ROWS) {
  for (const k of row) {
    if (k.np  && !CHAR_TO_KEY[k.np])  CHAR_TO_KEY[k.np]  = { code: k.code, shift: false, finger: k.finger };
    if (k.npS && !CHAR_TO_KEY[k.npS]) CHAR_TO_KEY[k.npS] = { code: k.code, shift: true,  finger: k.finger };
  }
}
CHAR_TO_KEY[" "] = { code: "Space", shift: false, finger: "T" };

// Build code → char lookup for physical keyboard interception
const CODE_TO_NP: Record<string, string>  = {};
const CODE_TO_NPS: Record<string, string> = {};
for (const row of ALL_ROWS) {
  for (const k of row) {
    if (k.np)  CODE_TO_NP[k.code]  = k.np;
    if (k.npS) CODE_TO_NPS[k.code] = k.npS;
  }
}
CODE_TO_NP["Space"] = " ";

// ── Practice Texts ────────────────────────────────────────────────────────────
const TEXTS: Record<Language, Record<Difficulty, string[]>> = {
  nepali: {
    easy: [
      "राम घर जान्छ। सिता खाना बनाउँछे। हामी साथमा बस्छौं।",
      "नेपाल राम्रो देश हो। हिमाल ठूलो छ। नदी बग्छ।",
      "बाबा काम गर्नुहुन्छ। आमा घर हुनुहुन्छ। दिदी पढ्छे।",
      "तिमी कस्तो छौ? म ठिक छु। आज मौसम राम्रो छ।",
      "पानी पिउनु राम्रो हो। फलफूल खानु राम्रो हो।",
    ],
    medium: [
      "नेपाल एक सुन्दर देश हो जहाँ हिमाल, पहाड र तराई मिलेर बसेका छन्।",
      "विद्यार्थीले मन लगाएर पढे सबै कुरा सिक्न सकिन्छ। पढाइ नै जीवनको आधार हो।",
      "शिक्षाले मानिसलाई सभ्य र सुसंस्कृत बनाउँछ। राम्रो शिक्षाले देशको विकास हुन्छ।",
      "नेपालको राजधानी काठमाडौं हो। यो शहर धेरै पुरानो र ऐतिहासिक छ।",
      "सगरमाथा संसारको सबभन्दा अग्लो पर्वत हो। यसको उचाइ ८८४८ मिटर छ।",
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
      "पिताजी काम करते हैं। माँ घर पर हैं। दीदी पढ़ती है।",
      "तुम कैसे हो? मैं ठीक हूँ। आज मौसम अच्छा है।",
      "पानी पीना अच्छा है। फल खाना स्वास्थ्यकर है।",
    ],
    medium: [
      "भारत एक विशाल देश है जहाँ पहाड़, मैदान और समुद्र तट मिलकर बसे हैं।",
      "विद्यार्थी मन लगाकर पढ़ें तो सब कुछ सीखा जा सकता है। पढ़ाई ही जीवन की नींव है।",
      "शिक्षा मनुष्य को सभ्य और संस्कारी बनाती है। अच्छी शिक्षा से देश का विकास होता है।",
      "दिल्ली भारत की राजधानी है। यह शहर बहुत पुराना और ऐतिहासिक है।",
      "एवरेस्ट दुनिया की सबसे ऊँची चोटी है। इसकी ऊँचाई ८८४८ मीटर है।",
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
const SCHEMA_WEBAPP = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Nepali Typing Practice | नेपाली टाइपिंग अभ्यास",
  url: "https://www.studenthubnp.com/tools/nepali-typing",
  description: "Free Nepali and Hindi typing practice tool with virtual keyboard, hand position guide, difficulty levels, and real-time WPM tracking. नेपाली र हिन्दी टाइपिंग अभ्यास गर्नुहोस्।",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  inLanguage: ["ne", "hi", "en"],
  featureList: [
    "Nepali Typing Practice", "Hindi Typing Practice", "Virtual Keyboard with Hand Guide",
    "Easy Medium Hard Difficulty", "WPM Accuracy Tracking", "30s to 5 minute sessions",
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
      name: "How do I practice Nepali typing online?",
      acceptedAnswer: { "@type": "Answer", text: "Use Student Hub's free Nepali Typing Practice tool. Click any key on the on-screen keyboard to type Nepali characters, or enable Nepali Unicode keyboard on your device. Choose Easy, Medium, or Hard level and set your practice duration." },
    },
    {
      "@type": "Question",
      name: "नेपाली टाइपिंग कसरी सिक्ने? (How to learn Nepali typing?)",
      acceptedAnswer: { "@type": "Answer", text: "यस टुलमा Easy level बाट सुरु गर्नुहोस्। भर्चुअल किबोर्डमा कुन औंलाले कुन कुञ्जी थिच्ने भनेर देखाइन्छ। नियमित अभ्यासले टाइपिङ गति र सटीकता बढ्छ।" },
    },
    {
      "@type": "Question",
      name: "क्या इस टूल से हिंदी टाइपिंग सीख सकते हैं? (Can I learn Hindi typing here?)",
      acceptedAnswer: { "@type": "Answer", text: "हाँ, Student Hub पर नेपाली के साथ-साथ हिंदी टाइपिंग अभ्यास भी कर सकते हैं। देवनागरी लिपि दोनों भाषाओं के लिए एक जैसी है।" },
    },
  ],
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function VirtualKey({
  keyDef,
  isActive,
  onClick,
  showHindi,
}: {
  keyDef: KeyDef;
  isActive: boolean;
  onClick: (ch: string) => void;
  showHindi: boolean;
}) {
  const base = "relative flex flex-col items-center justify-center border-2 rounded-lg cursor-pointer select-none transition-all duration-150 font-medium";
  const cls  = isActive ? F_ACTIVE[keyDef.finger] : F_NORMAL[keyDef.finger];
  const char = keyDef.np;
  const shChar = keyDef.npS;
  const _ = showHindi; // same devanagari layout for both langs

  return (
    <button
      className={`${base} ${cls} w-9 h-10 sm:w-10 sm:h-11`}
      onClick={() => onClick(char)}
      title={`${keyDef.label} → ${char} | Shift → ${shChar}`}
      type="button"
    >
      <span className="text-[9px] opacity-60 leading-none">{shChar}</span>
      <span className="text-sm leading-none font-bold">{char}</span>
      <span className="absolute bottom-0.5 right-1 text-[7px] opacity-40">{keyDef.label}</span>
    </button>
  );
}

function SpaceKey({ isActive, onClick }: { isActive: boolean; onClick: (ch: string) => void }) {
  const base = "flex items-center justify-center border-2 rounded-lg cursor-pointer select-none transition-all duration-150 font-medium";
  const cls  = isActive ? F_ACTIVE["T"] : F_NORMAL["T"];
  return (
    <button
      className={`${base} ${cls} w-52 sm:w-64 h-10 sm:h-11 text-xs`}
      onClick={() => onClick(" ")}
      type="button"
    >
      Space / खाली ठाउँ / स्पेस
    </button>
  );
}

function VirtualKeyboard({
  activeCode,
  onKeyClick,
  onBackspace,
  language,
}: {
  activeCode: string | null;
  onKeyClick: (ch: string) => void;
  onBackspace: () => void;
  language: Language;
}) {
  const showHindi = language === "hindi";
  const isSpaceActive = activeCode === "Space";

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      {[ROW1, ROW2, ROW3, ROW4].map((row, ri) => (
        <div key={ri} className="flex gap-1 flex-wrap justify-center">
          {row.map(k => (
            <VirtualKey
              key={k.code}
              keyDef={k}
              isActive={activeCode === k.code}
              onClick={onKeyClick}
              showHindi={showHindi}
            />
          ))}
          {ri === 0 && (
            <button
              onClick={onBackspace}
              className="flex items-center justify-center border-2 rounded-lg cursor-pointer text-xs font-semibold bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-200 transition-all w-14 h-10 sm:h-11"
              type="button"
            >
              ← Del
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-2 mt-0.5">
        <SpaceKey isActive={isSpaceActive} onClick={onKeyClick} />
      </div>
    </div>
  );
}

function HandGuide({ activeKey }: { activeKey: { code: string; shift: boolean; finger: Finger } | null }) {
  const activeFinger = activeKey?.finger ?? null;

  const leftFingers: { id: Finger; label: string; pos: string }[] = [
    { id: "LP", label: "कान्छी\nPinky", pos: "bottom-0 left-0" },
    { id: "LR", label: "अनामिका\nRing",  pos: "bottom-0 left-8" },
    { id: "LM", label: "माझी\nMiddle",   pos: "bottom-0 left-16" },
    { id: "LI", label: "चोर\nIndex",     pos: "bottom-0 left-24" },
  ];
  const rightFingers: { id: Finger; label: string; pos: string }[] = [
    { id: "RI", label: "चोर\nIndex",     pos: "bottom-0 right-24" },
    { id: "RM", label: "माझी\nMiddle",   pos: "bottom-0 right-16" },
    { id: "RR", label: "अनामिका\nRing",  pos: "bottom-0 right-8" },
    { id: "RP", label: "कान्छी\nPinky", pos: "bottom-0 right-0" },
  ];

  function FingerBox({ id, label }: { id: Finger; label: string }) {
    const isActive = activeFinger === id;
    const [line1, line2] = label.split("\n");
    return (
      <div
        className={`flex flex-col items-center justify-end rounded-t-full border-2 w-8 h-16 sm:w-9 sm:h-20 transition-all duration-200 ${
          isActive ? `${F_ACTIVE[id]} ring-2 ring-offset-1` : F_NORMAL[id]
        }`}
      >
        <span className="text-[8px] font-bold leading-tight text-center pb-1 px-0.5">{line1}</span>
        <span className="text-[7px] opacity-70 pb-1">{line2}</span>
      </div>
    );
  }

  return (
    <div className="flex items-end justify-center gap-8">
      {/* Left hand */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-gray-400 mb-1">बायाँ हात / Left Hand</span>
        <div className="flex gap-1.5 items-end">
          {leftFingers.map(f => <FingerBox key={f.id} id={f.id} label={f.label} />)}
          {/* Thumb */}
          <div className={`flex items-center justify-center rounded-lg border-2 w-10 h-8 transition-all duration-200 text-[8px] font-bold ${
            activeFinger === "T" ? F_ACTIVE["T"] : F_NORMAL["T"]
          }`}>
            बुढी<br/>Thumb
          </div>
        </div>
      </div>
      {/* Right hand */}
      <div className="flex flex-col items-center">
        <span className="text-xs text-gray-400 mb-1">दायाँ हात / Right Hand</span>
        <div className="flex gap-1.5 items-end">
          <div className={`flex items-center justify-center rounded-lg border-2 w-10 h-8 transition-all duration-200 text-[8px] font-bold ${
            activeFinger === "T" ? F_ACTIVE["T"] : F_NORMAL["T"]
          }`}>
            बुढी<br/>Thumb
          </div>
          {rightFingers.map(f => <FingerBox key={f.id} id={f.id} label={f.label} />)}
        </div>
      </div>
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
  setLanguage: (l: Language) => void;
  setDifficulty: (d: Difficulty) => void;
  setDuration: (d: Duration) => void;
  onStart: () => void; onGuide: () => void;
}) {
  const langs: { id: Language; label: string; sub: string }[] = [
    { id: "nepali", label: "नेपाली", sub: "Nepali" },
    { id: "hindi",  label: "हिन्दी",  sub: "Hindi"  },
  ];
  const diffs: { id: Difficulty; label: string; sub: string; color: string }[] = [
    { id: "easy",   label: "सजिलो",  sub: "Easy",   color: "green" },
    { id: "medium", label: "मध्यम",   sub: "Medium", color: "yellow" },
    { id: "hard",   label: "गाह्रो",  sub: "Hard",   color: "red"   },
  ];
  const durs: { val: Duration; label: string }[] = [
    { val: 30,  label: "30 sec" },
    { val: 60,  label: "1 min"  },
    { val: 120, label: "2 min"  },
    { val: 180, label: "3 min"  },
    { val: 300, label: "5 min"  },
  ];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Language */}
      <div>
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">भाषा छान्नुहोस् / Choose Language</p>
        <div className="grid grid-cols-2 gap-3">
          {langs.map(l => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id)}
              className={`p-4 rounded-xl border-2 text-center transition-all font-medium ${
                language === l.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
              }`}
            >
              <div className="text-2xl">{l.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{l.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">स्तर / Difficulty</p>
        <div className="grid grid-cols-3 gap-3">
          {diffs.map(d => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={`p-3 rounded-xl border-2 text-center transition-all font-medium ${
                difficulty === d.id
                  ? `border-${d.color}-500 bg-${d.color}-50 text-${d.color}-700`
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              } ${difficulty === d.id && d.color === "green" ? "!border-green-500 !bg-green-50 !text-green-700" : ""}
                ${difficulty === d.id && d.color === "yellow" ? "!border-yellow-500 !bg-yellow-50 !text-yellow-700" : ""}
                ${difficulty === d.id && d.color === "red" ? "!border-red-500 !bg-red-50 !text-red-700" : ""}
              `}
            >
              <div className="text-base">{d.label}</div>
              <div className="text-xs text-gray-400">{d.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">समय / Time</p>
        <div className="flex gap-2 flex-wrap">
          {durs.map(d => (
            <button
              key={d.val}
              onClick={() => setDuration(d.val)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                duration === d.val
                  ? "border-blue-500 bg-blue-500 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onStart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-all flex items-center justify-center gap-2 shadow-md"
        >
          अभ्यास सुरु गर्नुहोस् <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onGuide}
          className="px-4 py-4 border-2 border-gray-200 rounded-xl text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-all"
          title="How to type guide"
        >
          <BookOpen className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ── Guide Screen ──────────────────────────────────────────────────────────────
function GuideScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <h2 className="text-xl font-bold text-gray-900">टाइपिंग कसरी सिक्ने / How to Type</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <h3 className="font-bold text-blue-800">औंला राख्ने ठाउँ / Home Row Position</h3>
        <p className="text-sm text-blue-700">
          दुवै हातको औंला <strong>A S D F</strong> र <strong>J K L ;</strong> कुञ्जीमा राख्नुहोस्। यो "Home Row" हो।
          Always rest your fingers on <strong>A S D F</strong> (left) and <strong>J K L ;</strong> (right).
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {([
          { finger: "LP" as Finger, keys: "Q A Z 1 2",    label: "बायाँ कान्छी / Left Pinky" },
          { finger: "LR" as Finger, keys: "W S X 3",      label: "बायाँ अनामिका / Left Ring" },
          { finger: "LM" as Finger, keys: "E D C 4",      label: "बायाँ माझी / Left Middle" },
          { finger: "LI" as Finger, keys: "R F V T G B 5 6", label: "बायाँ चोर / Left Index" },
          { finger: "RI" as Finger, keys: "Y H N U J M 7", label: "दायाँ चोर / Right Index" },
          { finger: "RM" as Finger, keys: "I K , 8",      label: "दायाँ माझी / Right Middle" },
          { finger: "RR" as Finger, keys: "O L . 9",      label: "दायाँ अनामिका / Right Ring" },
          { finger: "RP" as Finger, keys: "P ; [ ] 0",    label: "दायाँ कान्छी / Right Pinky" },
        ]).map(item => (
          <div key={item.finger} className={`rounded-lg border p-3 ${F_NORMAL[item.finger]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-3 h-3 rounded-full ${F_COLOR_DOT[item.finger]}`} />
              <span className="text-xs font-bold">{item.label}</span>
            </div>
            <div className="font-mono text-sm font-semibold">{item.keys}</div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h3 className="font-bold text-yellow-800 mb-1">💡 सुझाव / Tips</h3>
        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
          <li>स्क्रिनलाई हेर्नुहोस्, किबोर्डलाई होइन / Look at the screen, not the keyboard</li>
          <li>बिस्तारै सुरु गर्नुहोस् / Start slow, build speed gradually</li>
          <li>गल्ती भए पनि रोकिनुहोस् / Accuracy first, speed will follow</li>
          <li>Virtual keyboard मा थिच्नुहोस् वा आफ्नो किबोर्ड प्रयोग गर्नुहोस् / Click on-screen or use your keyboard</li>
        </ul>
      </div>

      <button
        onClick={onBack}
        className="w-full py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-semibold hover:border-blue-300 hover:text-blue-600 transition-all"
      >
        ← फर्कनुहोस् / Back to Setup
      </button>
    </div>
  );
}

// ── Countdown Screen ──────────────────────────────────────────────────────────
function CountdownScreen({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-gray-500 text-lg">तयार हुनुहोस् / Get ready...</p>
      <div className="text-9xl font-black text-blue-600 animate-pulse">{count}</div>
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
  const grade = accuracy >= 95 ? "A+" : accuracy >= 85 ? "A" : accuracy >= 75 ? "B" : accuracy >= 60 ? "C" : "D";
  const gradeColor = accuracy >= 95 ? "text-green-600" : accuracy >= 85 ? "text-blue-600" : accuracy >= 75 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="text-center">
        <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
        <h2 className="text-2xl font-black text-gray-900">नतिजा / Results</h2>
        <p className="text-gray-500 text-sm mt-1">
          {language === "nepali" ? "नेपाली" : "हिन्दी"} · {difficulty === "easy" ? "सजिलो" : difficulty === "medium" ? "मध्यम" : "गाह्रो"} · {duration}s
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <Zap className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <div className="text-3xl font-black text-blue-600">{wpm}</div>
          <div className="text-xs text-gray-500">WPM (Words/min)</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <Target className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <div className="text-3xl font-black text-green-600">{accuracy}%</div>
          <div className="text-xs text-gray-500">सटिकता / Accuracy</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-gray-500 mx-auto mb-1" />
          <div className="text-3xl font-black text-gray-700">{correct}</div>
          <div className="text-xs text-gray-500">सही वर्ण / Correct</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <div className="text-3xl font-black text-red-500">{errors}</div>
          <div className="text-xs text-gray-500">गल्ती / Errors</div>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-100 rounded-xl p-4 text-center">
        <p className="text-gray-500 text-sm">तपाईंको ग्रेड / Your Grade</p>
        <div className={`text-6xl font-black mt-1 ${gradeColor}`}>{grade}</div>
        <p className="text-sm text-gray-500 mt-2">
          {accuracy >= 95 ? "अत्युत्तम! तपाईं टाइपिंग विशेषज्ञ हुनुहुन्छ! 🎉"
            : accuracy >= 85 ? "उत्कृष्ट! अझ अभ्यास गर्नुहोस्। 💪"
            : accuracy >= 75 ? "राम्रो छ! निरन्तर अभ्यास गर्नुहोस्। 👍"
            : accuracy >= 60 ? "ठिक छ। थप अभ्यास चाहिन्छ। 📚"
            : "बिस्तारै अभ्यास गर्नुहोस्। Easy level बाट सुरु गर्नुहोस्।"}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
        >
          <RotateCcw className="w-4 h-4" /> फेरि गर्नुहोस् / Retry
        </button>
        <button
          onClick={onSetup}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:border-blue-300 hover:text-blue-600 transition-all"
        >
          <Keyboard className="w-4 h-4" /> परिवर्तन / Change
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
  const chars = [...text];
  const typedChars = [...typed];

  // Find active key for virtual keyboard highlight
  const nextChar = chars[typedChars.length];
  const activeKey = nextChar ? (CHAR_TO_KEY[nextChar] ?? null) : null;
  const activeCode = activeKey?.code ?? null;

  const wpm = Math.round((typedChars.length / 5) / Math.max((duration - timeLeft) / 60, 0.001));
  const correctSoFar = typedChars.filter((c, i) => c === chars[i]).length;
  const accuracy = typedChars.length > 0 ? Math.round((correctSoFar / typedChars.length) * 100) : 100;
  const progress = Math.round((typedChars.length / chars.length) * 100);

  const timePercent = Math.round((timeLeft / duration) * 100);
  const timeColor = timeLeft > duration * 0.5 ? "bg-green-500" : timeLeft > duration * 0.2 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 text-blue-600 mb-0.5">
            <Zap className="w-3.5 h-3.5" /><span className="text-xs font-semibold">WPM</span>
          </div>
          <div className="text-xl font-black text-gray-900">{wpm}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-0.5">
            <Clock className="w-3.5 h-3.5" /><span className="text-xs font-semibold">समय</span>
          </div>
          <div className="text-xl font-black text-gray-900">{timeLeft}s</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 text-purple-600 mb-0.5">
            <Target className="w-3.5 h-3.5" /><span className="text-xs font-semibold">सटिकता</span>
          </div>
          <div className="text-xl font-black text-gray-900">{accuracy}%</div>
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-1000 ${timeColor}`} style={{ width: `${timePercent}%` }} />
      </div>

      {/* Text display */}
      <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm min-h-[100px]">
        <div className="font-normal text-lg sm:text-xl leading-relaxed tracking-wide" style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
          {chars.map((ch, i) => {
            const isTyped = i < typedChars.length;
            const isCurrent = i === typedChars.length;
            const isCorrect = isTyped && typedChars[i] === ch;
            const isError = isTyped && typedChars[i] !== ch;
            return (
              <span
                key={i}
                className={`relative ${
                  isCurrent  ? "bg-blue-200 text-blue-900 rounded px-0.5 animate-pulse" :
                  isCorrect  ? "text-green-600" :
                  isError    ? "text-white bg-red-400 rounded px-0.5" :
                  "text-gray-800"
                }`}
              >
                {ch === " " && isCurrent ? "·" : ch}
              </span>
            );
          })}
        </div>
        {/* Progress */}
        <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5">
          <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">{progress}% पूरा / complete</p>
      </div>

      {/* Finger hint */}
      {activeKey && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className={`w-3 h-3 rounded-full ${F_COLOR_DOT[activeKey.finger]}`} />
          <span className="text-gray-600">
            {activeKey.shift ? "Shift + " : ""}<strong>{activeCode?.replace("Key", "").replace("Digit", "").replace("Bracket", "[/]")}</strong> key — {F_LABEL[activeKey.finger]}
          </span>
        </div>
      )}

      {/* Hand Guide */}
      <div className="overflow-x-auto pb-1">
        <HandGuide activeKey={activeKey} />
      </div>

      {/* Virtual Keyboard */}
      <div className="overflow-x-auto pb-1">
        <VirtualKeyboard
          activeCode={activeCode}
          onKeyClick={onKeyClick}
          onBackspace={onBackspace}
          language={language}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NepaliTyping() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [language,   setLanguage]   = useState<Language>("nepali");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [duration,   setDuration]   = useState<Duration>(60);
  const [countdown,  setCountdown]  = useState(3);
  const [timeLeft,   setTimeLeft]   = useState(60);
  const [text,       setText]       = useState("");
  const [typed,      setTyped]      = useState("");
  const [finalStats, setFinalStats] = useState({ wpm: 0, accuracy: 100, correct: 0, errors: 0 });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickText = useCallback((lang: Language, diff: Difficulty): string => {
    const pool = TEXTS[lang][diff];
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const startPractice = useCallback(() => {
    const t = pickText(language, difficulty);
    setText(t);
    setTyped("");
    setTimeLeft(duration);
    setPhase("countdown");
    setCountdown(3);
  }, [language, difficulty, duration, pickText]);

  // Countdown effect
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("practice");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Timer effect
  useEffect(() => {
    if (phase !== "practice") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // End practice when time runs out or text is complete
  useEffect(() => {
    if (phase !== "practice") return;
    const chars = [...text];
    const typedChars = [...typed];
    const done = timeLeft === 0 || typedChars.length >= chars.length;
    if (done) {
      const elapsed = Math.max((duration - timeLeft) / 60, 0.001);
      const correct = typedChars.filter((c, i) => c === chars[i]).length;
      const errors  = typedChars.filter((c, i) => c !== chars[i]).length;
      const wpm     = Math.round((typedChars.length / 5) / elapsed);
      const acc     = typedChars.length > 0 ? Math.round((correct / typedChars.length) * 100) : 100;
      setFinalStats({ wpm, accuracy: acc, correct, errors });
      setPhase("results");
    }
  }, [timeLeft, typed, text, phase, duration]);

  // Physical keyboard handler — intercepts keys and maps to Devanagari
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (phase !== "practice") return;

    if (e.code === "Backspace") {
      setTyped(p => [...p].slice(0, -1).join(""));
      return;
    }
    if (e.code === "Space") {
      setTyped(p => p + " ");
      return;
    }

    const ch = e.shiftKey
      ? CODE_TO_NPS[e.code]
      : CODE_TO_NP[e.code];

    if (ch) {
      setTyped(p => {
        if ([...p].length >= [...text].length) return p;
        return p + ch;
      });
    }
  }, [phase, text]);

  // On-screen keyboard click
  const handleKeyClick = useCallback((ch: string) => {
    if (phase !== "practice") return;
    setTyped(p => {
      if ([...p].length >= [...text].length) return p;
      return p + ch;
    });
    inputRef.current?.focus();
  }, [phase, text]);

  const handleBackspace = useCallback(() => {
    if (phase !== "practice") return;
    setTyped(p => [...p].slice(0, -1).join(""));
    inputRef.current?.focus();
  }, [phase]);

  return (
    <>
      <Helmet>
        <title>नेपाली टाइपिंग अभ्यास | Hindi Nepali Typing Practice - Free Online Tool | Student Hub</title>
        <meta name="description" content="Free Nepali and Hindi typing practice online. नेपाली र हिन्दी टाइपिंग सिक्नुहोस् — virtual keyboard with hand guide, Easy/Medium/Hard levels, WPM tracker. हिंदी नेपाली टाइपिंग अभ्यास करें। Best free Devanagari typing tutor for Nepal and India." />
        <meta name="keywords" content="nepali typing practice, nepali typing tutor, nepali type online, hindi nepali typing, devanagari typing practice, नेपाली टाइपिंग, हिंदी टाइपिंग, hindi typing practice, nepali keyboard typing, online typing test nepali, hindi typing online, nepali typing speed test, devanagari keyboard, nepali unicode typing, type in nepali, nepali keyboard layout, हिंदी टाइपिंग सीखें, नेपाली टाइपिंग सिक्नुहोस्" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="नेपाली टाइपिंग अभ्यास | Free Nepali Hindi Typing Practice - Student Hub" />
        <meta property="og:description" content="Free Nepali and Hindi typing practice with virtual keyboard, hand guide, speed tracking. Easy, Medium and Hard levels. 30 seconds to 5 minutes." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/tools/nepali-typing" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="नेपाली टाइपिंग | Free Nepali Hindi Typing Practice" />
        <meta name="twitter:description" content="Best free Nepali and Hindi typing tutor — virtual keyboard, WPM tracking, hand position guide." />
        <link rel="canonical" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="ne" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="hi" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="en" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <script type="application/ld+json">{JSON.stringify(SCHEMA_WEBAPP)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_BREADCRUMB)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_FAQ)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-10">
        {/* Header */}
        <div className="mb-6">
          <Link href="/tools">
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-3" type="button">
              <ArrowLeft className="w-4 h-4" /> सबै tools / All Tools
            </button>
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
                नेपाली टाइपिंग अभ्यास
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Nepali &amp; Hindi Typing Practice · Virtual Keyboard · Hand Guide · WPM Tracker
              </p>
            </div>
            {phase === "practice" && (
              <button
                onClick={() => setPhase("setup")}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5 transition-all"
                type="button"
              >
                <RotateCcw className="w-3.5 h-3.5" /> छोड्नुहोस्
              </button>
            )}
          </div>
        </div>

        {/* Hidden textarea for physical keyboard input */}
        <textarea
          ref={inputRef}
          className="sr-only"
          onKeyDown={handleKeyDown}
          readOnly
          value={typed}
          aria-label="Typing input area"
          tabIndex={phase === "practice" ? 0 : -1}
        />

        {/* Screens */}
        {phase === "setup"     && (
          <SetupScreen
            language={language} difficulty={difficulty} duration={duration}
            setLanguage={setLanguage} setDifficulty={setDifficulty} setDuration={setDuration}
            onStart={startPractice} onGuide={() => setPhase("guide")}
          />
        )}
        {phase === "guide"     && <GuideScreen onBack={() => setPhase("setup")} />}
        {phase === "countdown" && <CountdownScreen count={countdown} />}
        {phase === "practice"  && (
          <PracticeScreen
            text={text} typed={typed} timeLeft={timeLeft} duration={duration} language={language}
            onKeyClick={handleKeyClick} onBackspace={handleBackspace}
          />
        )}
        {phase === "results"   && (
          <ResultsScreen
            {...finalStats} duration={duration} language={language} difficulty={difficulty}
            onRetry={startPractice} onSetup={() => setPhase("setup")}
          />
        )}

        {/* SEO content block */}
        {phase === "setup" && (
          <div className="mt-10 border-t border-gray-100 pt-8 space-y-6">
            <div className="prose prose-sm max-w-none text-gray-600">
              <h2 className="text-base font-bold text-gray-800">नेपाली टाइपिंग कसरी सिक्ने? / How to Learn Nepali Typing</h2>
              <p>
                यो <strong>नेपाली टाइपिंग अभ्यास टुल</strong> देवनागरी लिपिमा टाइप गर्न सिकाउँछ। भर्चुअल किबोर्डमा कुन औंलाले कुन कुञ्जी थिच्ने भनेर रङ्गाउने हुँदा सिक्न सजिलो हुन्छ।
                This <strong>free Nepali and Hindi typing practice tool</strong> teaches you to type in Devanagari script using color-coded finger guides and a virtual keyboard.
              </p>
              <h2 className="text-base font-bold text-gray-800">हिंदी टाइपिंग अभ्यास / Hindi Typing Practice Online</h2>
              <p>
                नेपाली र हिन्दी दुवै देवनागरी लिपि प्रयोग गर्छन्। यस टुलले दुवै भाषाको अभ्यास गराउँछ।
                Hindi and Nepali both use the Devanagari script. Switch to Hindi mode for <strong>हिंदी टाइपिंग</strong> practice with passages from everyday Hindi text.
              </p>
              <h2 className="text-base font-bold text-gray-800">WPM र सटिकता / Speed and Accuracy</h2>
              <p>
                WPM (Words Per Minute) र सटिकता (Accuracy) ट्र्याक गरेर तपाईंको प्रगति थाहा पाउन सकिन्छ। नियमित अभ्यासले गति र सटिकता दुवै बढ्छन्।
              </p>
            </div>

            {/* FAQ Section */}
            <div className="space-y-3">
              <h2 className="text-base font-bold text-gray-800">सामान्य प्रश्नहरू / FAQ</h2>
              {[
                { q: "के यो टुल निःशुल्क छ? / Is this tool free?", a: "हो, पूर्णतया निःशुल्क। Yes, completely free — no sign-up required." },
                { q: "के मोबाइलमा काम गर्छ? / Does it work on mobile?", a: "हो। भर्चुअल किबोर्डमा थिचेर मोबाइलबाट पनि अभ्यास गर्न सकिन्छ। Yes — use the on-screen keyboard." },
                { q: "कुन level बाट सुरु गर्ने? / Which level to start?", a: "नयाँ सिक्नेले Easy level बाट सुरु गर्नुहोस्। Beginners should start with Easy." },
                { q: "नेपाली किबोर्ड कसरी enable गर्ने? / How to enable Nepali keyboard?", a: "Windows: Settings → Time & Language → Language → Add Nepali. Mac: System Preferences → Keyboard → Input Sources → Add Nepali. वा भर्चुअल किबोर्ड प्रयोग गर्नुहोस्।" },
              ].map(({ q, a }) => (
                <details key={q} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <summary className="font-semibold text-sm text-gray-800 cursor-pointer">{q}</summary>
                  <p className="mt-2 text-sm text-gray-600">{a}</p>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
