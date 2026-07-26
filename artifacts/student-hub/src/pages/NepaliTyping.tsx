import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Trophy, Clock, Target, Zap, ChevronRight, BookOpen, RefreshCw, Settings2, Keyboard } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Language   = "nepali" | "hindi";
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

// ── Keyboard layout (Nepali Unicode standard) ─────────────────────────────────
interface KeyDef { code: string; label: string; np: string; npS: string; finger: Finger; }

const ROW0: KeyDef[] = [
  { code:"Backquote",    label:"`", np:"्",  npS:"ँ",   finger:"LP" },
  { code:"Digit1",       label:"1", np:"१",  npS:"!",   finger:"LP" },
  { code:"Digit2",       label:"2", np:"२",  npS:"@",   finger:"LR" },
  { code:"Digit3",       label:"3", np:"३",  npS:"#",   finger:"LM" },
  { code:"Digit4",       label:"4", np:"४",  npS:"$",   finger:"LI" },
  { code:"Digit5",       label:"5", np:"५",  npS:"%",   finger:"LI" },
  { code:"Digit6",       label:"6", np:"६",  npS:"^",   finger:"RI" },
  { code:"Digit7",       label:"7", np:"७",  npS:"&",   finger:"RI" },
  { code:"Digit8",       label:"8", np:"८",  npS:"*",   finger:"RM" },
  { code:"Digit9",       label:"9", np:"९",  npS:"(",   finger:"RR" },
  { code:"Digit0",       label:"0", np:"०",  npS:")",   finger:"RP" },
  { code:"Minus",        label:"-", np:"-",  npS:"_",   finger:"RP" },
  { code:"Equal",        label:"=", np:"=",  npS:"+",   finger:"RP" },
];
const ROW1: KeyDef[] = [
  { code:"KeyQ",         label:"Q", np:"ट",  npS:"ठ",   finger:"LP" },
  { code:"KeyW",         label:"W", np:"ठ",  npS:"ऊ",   finger:"LR" },
  { code:"KeyE",         label:"E", np:"ु",  npS:"ए",   finger:"LM" },
  { code:"KeyR",         label:"R", np:"र",  npS:"ऋ",   finger:"LI" },
  { code:"KeyT",         label:"T", np:"त",  npS:"थ",   finger:"LI" },
  { code:"KeyY",         label:"Y", np:"य",  npS:"ञ",   finger:"RI" },
  { code:"KeyU",         label:"U", np:"ू",  npS:"उ",   finger:"RI" },
  { code:"KeyI",         label:"I", np:"ि",  npS:"ी",   finger:"RM" }, // ी = long i matra (Shift+I)
  { code:"KeyO",         label:"O", np:"ो",  npS:"औ",   finger:"RR" },
  { code:"KeyP",         label:"P", np:"प",  npS:"फ",   finger:"RP" },
  { code:"BracketLeft",  label:"[", np:"े",  npS:"ऐ",   finger:"RP" },
  { code:"BracketRight", label:"]", np:"ं",  npS:"अं",  finger:"RP" },
];
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
const ROW3: KeyDef[] = [
  { code:"KeyZ",   label:"Z", np:"ँ",  npS:"ङ",   finger:"LP" },
  { code:"KeyX",   label:"X", np:"ं",  npS:"क्ष", finger:"LR" },
  { code:"KeyC",   label:"C", np:"च",  npS:"छ",   finger:"LM" },
  { code:"KeyV",   label:"V", np:"व",  npS:"ण",   finger:"LI" },
  { code:"KeyB",   label:"B", np:"ब",  npS:"भ",   finger:"LI" },
  { code:"KeyN",   label:"N", np:"न",  npS:"ण",   finger:"RI" },
  { code:"KeyM",   label:"M", np:"म",  npS:"म",   finger:"RI" },
  { code:"Comma",  label:",", np:",",  npS:"<",   finger:"RM" },
  { code:"Period", label:".", np:"।",  npS:">",   finger:"RR" },
  { code:"Slash",  label:"/", np:"्",  npS:"?",   finger:"RP" },
];
const ALL_KEY_ROWS = [ROW0, ROW1, ROW2, ROW3];

// ── Character → Key maps ──────────────────────────────────────────────────────
const CHAR_TO_KEY: Record<string, { code: string; shift: boolean; finger: Finger }> = {};
const CODE_TO_NP:  Record<string, string> = {};
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
CHAR_TO_KEY[" "]    = { code: "Space", shift: false, finger: "T" };

// ── Word banks ────────────────────────────────────────────────────────────────
const NP_EASY: string[] = [
  "राम घर जान्छ।", "सिता खाना पकाउँछिन्।", "हामी साथमा खेल्छौं।",
  "नेपाल सुन्दर देश हो।", "हिमाल ठूलो छ।", "नदी बग्दछ।",
  "आज मौसम राम्रो छ।", "हावा चिसो छ।", "आकाश नीलो छ।",
  "बाबा कार्यालय जानुभयो।", "आमा खाना बनाउनुभयो।", "दिदी किताब पढ्दैछिन्।",
  "विद्यालय टाढा छैन।", "साथीहरू मिलनसार छन्।", "पढाइ राम्रो छ।",
  "पानी पिउनु जरुरी छ।", "खाना खानु आवश्यक छ।", "निद्रा पनि चाहिन्छ।",
  "सूर्य उदाएको छ।", "बालकहरू खेल्दैछन्।", "फूल फुलेको छ।",
  "रूखमा पात छ।", "बाटो सफा छ।", "घर राम्रो छ।",
  "दिन राम्रो छ।", "रात चिसो छ।", "बिहान सबेरै उठनुपर्छ।",
  "किसानले खेत जोत्छ।", "गाउँको हावा सफा छ।", "मान्छेहरू खुसी छन्।",
];
const NP_MEDIUM: string[] = [
  "नेपाल एक सुन्दर देश हो जहाँ हिमाल पहाड र तराई छन्।",
  "यहाँ धेरै जाति र धर्मका मानिसहरू मिलेर बस्छन्।",
  "विद्यार्थीले मन लगाएर पढे सबै कुरा सिक्न सकिन्छ।",
  "पढाइ नै जीवनको आधार हो ज्ञान बढाउनु सबैभन्दा ठूलो लगानी हो।",
  "नेपालको राजधानी काठमाडौं हो यो शहर धेरै पुरानो र ऐतिहासिक छ।",
  "यहाँ पशुपतिनाथ स्वयम्भूनाथ लगायत धेरै मन्दिरहरू छन्।",
  "लोकसेवा आयोगले सरकारी पदमा भर्ना गर्दछ।",
  "परीक्षामा लिखित अन्तर्वार्ता र टाइपिङ परीक्षण हुन्छ।",
  "तयारी अहिलेदेखि नै सुरु गर्नुपर्छ।",
  "सगरमाथा संसारको सबभन्दा अग्लो पर्वत हो।",
  "यसको उचाइ आठ हजार आठ सय अड्चालिस मिटर छ।",
  "हरेक वर्ष धेरै पर्वतारोही नेपाल आउँछन्।",
  "नेपाली भाषा देवनागरी लिपिमा लेखिन्छ।",
  "यो भाषा संस्कृतबाट विकास भएको हो।",
  "नेपाली साहित्य अत्यन्त समृद्ध छ।",
];
const NP_HARD: string[] = [
  "नेपालको भूगोल विविध छ उत्तरमा हिमाल मध्यमा पहाड र दक्षिणमा तराई फैलिएको छ।",
  "यही विविधताले नेपाललाई अनूठो र आकर्षक बनाउँछ पर्यटन प्रमुख उद्योग हो।",
  "लोकसेवा आयोगको परीक्षामा सफल हुन टाइपिङ गतिको साथसाथै शुद्धता पनि आवश्यक छ।",
  "प्रत्येक दिन कम्तीमा पन्ध्र मिनेट अभ्यास गर्दा छिटो सुधार हुन्छ।",
  "हाम्रो देशको विकासका लागि शिक्षा स्वास्थ्य र पूर्वाधार निर्माणमा जोड दिनु जरुरी छ।",
  "राम्रो शिक्षाले देशलाई प्रगतिको बाटोमा लैजान्छ।",
  "सरकारी सेवामा प्रवेश गर्न लोकसेवा आयोगको परीक्षा दिनुपर्छ।",
  "यस परीक्षामा सामान्य ज्ञान नेपाली अङ्ग्रेजी र सम्बन्धित विषयको ज्ञान जाँचिन्छ।",
  "तयारी व्यवस्थित र नियमित हुनुपर्छ।",
  "भानुभक्त आचार्यलाई नेपाली साहित्यका आदिकवि भनिन्छ।",
  "उनले रामायण नेपाली भाषामा अनुवाद गरेर साहित्यमा ठूलो योगदान पुर्याए।",
  "नेपालमा लोकसेवा टाइपिङ परीक्षाका लागि कम्तीमा पैंतिस शब्द प्रति मिनेट चाहिन्छ।",
];

const HI_EASY: string[] = [
  "राम घर जाता है।", "सीता खाना बनाती है।", "हम साथ रहते हैं।",
  "भारत एक महान देश है।", "पहाड़ ऊँचे हैं।", "नदी बहती है।",
  "आज मौसम अच्छा है।", "हवा ठंडी है।", "आकाश नीला है।",
  "पिताजी दफ्तर गए।", "माँ खाना बना रही हैं।", "दीदी पढ़ रही है।",
  "विद्यालय पास ही है।", "मित्र मिलनसार हैं।", "पढ़ाई अच्छी है।",
  "पानी पीना जरूरी है।", "खाना खाना आवश्यक है।", "नींद भी चाहिए।",
  "सूरज निकल आया।", "बच्चे खेल रहे हैं।", "फूल खिले हैं।",
  "पेड़ पर पत्ते हैं।", "सड़क साफ है।", "घर सुंदर है।",
];
const HI_MEDIUM: string[] = [
  "भारत एक विशाल देश है जहाँ पहाड़ मैदान और समुद्र तट मिलकर बसे हैं।",
  "यहाँ अनेक जातियाँ और धर्म के लोग मिलकर रहते हैं।",
  "विद्यार्थी मन लगाकर पढ़ें तो सब कुछ सीखा जा सकता है।",
  "पढ़ाई ही जीवन की नींव है ज्ञान बढ़ाना सबसे बड़ा निवेश है।",
  "दिल्ली भारत की राजधानी है यह शहर बहुत पुराना और ऐतिहासिक है।",
  "यहाँ कई मंदिर और स्मारक हैं जो इतिहास की कहानी सुनाते हैं।",
  "सरकारी नौकरी पाने के लिए टाइपिंग परीक्षा पास करना जरूरी है।",
  "रोज पंद्रह मिनट अभ्यास करने से जल्दी सुधार होता है।",
  "एवरेस्ट दुनिया की सबसे ऊँची चोटी है।",
  "इसकी ऊँचाई आठ हजार आठ सौ अड़तालीस मीटर है।",
];
const HI_HARD: string[] = [
  "हिंदी भाषा देवनागरी लिपि में लिखी जाती है यह संस्कृत से विकसित हुई है।",
  "हिंदी साहित्य बहुत समृद्ध है कबीर तुलसीदास और मीराबाई इसके प्रमुख कवि हैं।",
  "सरकारी नौकरी की परीक्षा में टाइपिंग गति के साथ-साथ शुद्धता भी जरूरी है।",
  "हिंदी टाइपिंग में पारंगत होने के लिए नियमित अभ्यास अनिवार्य है।",
  "हमारे देश के विकास के लिए शिक्षा स्वास्थ्य और बुनियादी ढाँचे पर जोर देना जरूरी है।",
  "अच्छी शिक्षा ही देश को प्रगति के पथ पर ले जाती है।",
  "भारत की भूगोल विविध है उत्तर में हिमालय मध्य में मैदान और दक्षिण में समुद्र तट फैला है।",
  "यही विविधता भारत को अनूठा और आकर्षणीय बनाती है।",
  "सरकारी परीक्षा में सफलता के लिए नियमित और व्यवस्थित तैयारी आवश्यक है।",
];

function getSentences(lang: Language, diff: Difficulty): string[] {
  if (lang === "nepali") return diff === "easy" ? NP_EASY : diff === "medium" ? NP_MEDIUM : NP_HARD;
  return diff === "easy" ? HI_EASY : diff === "medium" ? HI_MEDIUM : HI_HARD;
}

function generateStream(lang: Language, diff: Difficulty, count = 120): string {
  const pool = getSentences(lang, diff);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return out.join(" ");
}

// ── SVG Hand Guide ────────────────────────────────────────────────────────────
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
          {/* Palm */}
          <rect x="6" y="122" width="108" height="52" rx="18"
            fill="#f5d5bb" stroke="#d4a88a" strokeWidth="1.5" />
          {/* Fingers */}
          {fingers.map(f => {
            const isActive = activeFinger === f.id;
            return (
              <g key={f.id}>
                <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.rx}
                  fill={isActive ? FINGER_BG[f.id] : "#f0f4f8"}
                  stroke={isActive ? FINGER_BG[f.id] : "#c8d5e0"}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  style={{ transition: "fill 0.12s, stroke 0.12s" }}
                />
                {/* Fingernail highlight */}
                <ellipse cx={f.x + f.w / 2} cy={f.y + 10} rx={f.w / 2 - 5} ry="7"
                  fill={isActive ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.55)"} />
                {/* Active glow ring */}
                {isActive && (
                  <rect x={f.x - 3} y={f.y - 3} width={f.w + 6} height={f.h + 6} rx={f.rx + 3}
                    fill="none" stroke={FINGER_BG[f.id]} strokeWidth="3.5" opacity="0.45"
                    style={{ animation: "pulse 1s ease-in-out infinite" }} />
                )}
                {/* Finger colour dot label */}
                <circle cx={f.x + f.w / 2} cy={f.y + f.h - 10} r="5"
                  fill={FINGER_BG[f.id]} opacity={isActive ? 1 : 0.5} />
              </g>
            );
          })}
          {/* Thumb */}
          <g transform={`rotate(${thumbProps.rotate}, ${thumbProps.cx}, ${thumbProps.cy})`}>
            <rect x={thumbProps.x} y={thumbProps.y} width={thumbProps.w} height={thumbProps.h} rx={thumbProps.rx}
              fill={activeFinger === "T" ? FINGER_BG["T"] : "#f0f4f8"}
              stroke={activeFinger === "T" ? FINGER_BG["T"] : "#c8d5e0"}
              strokeWidth="1.5"
              style={{ transition: "fill 0.12s" }} />
          </g>
          {/* Knuckle lines on palm */}
          <line x1="10" y1="138" x2="110" y2="138" stroke="#e0b8a0" strokeWidth="1" opacity="0.6" />
        </svg>
        {/* Home row keys for this hand */}
        <div className="flex gap-1 mt-0">
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
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Finger Guide</span>
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
      className={`relative flex flex-col items-center justify-center border-2 rounded-md cursor-pointer select-none transition-all duration-75 w-8 h-9 sm:w-9 sm:h-10 ${isActive ? activeCls : normalCls}`}
      style={shadowStyle}
      onClick={() => onClick(keyDef.np)}
      title={`${keyDef.label}: ${keyDef.np}`}>
      {/* Shift char */}
      <span className={`absolute top-0.5 left-1 text-[7px] leading-none ${isActive ? "opacity-60" : "text-gray-400"}`}
        style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
        {keyDef.npS}
      </span>
      {/* Main char */}
      <span className={`text-[11px] sm:text-xs font-bold leading-none ${isActive ? "text-white" : "text-gray-800"}`}
        style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>
        {keyDef.np}
      </span>
      {/* English label */}
      <span className={`absolute bottom-0.5 right-1 text-[6px] leading-none font-mono ${isActive ? "opacity-50" : "text-gray-400"}`}>
        {keyDef.label}
      </span>
      {/* Home row bump indicator */}
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
        <WideKey label="Space — खाली ठाउँ" widthClass="w-44 sm:w-52"
          isActive={activeCode === "Space"} onClick={() => onKeyClick(" ")} />
        <WideKey label="Alt"  widthClass="w-9" />
        <WideKey label="Ctrl" widthClass="w-9" />
      </div>
    </div>
  );
}

// ── Infinite Text Display (windowed) ──────────────────────────────────────────
function TextDisplay({ text, typed, lang }: { text: string; typed: string; lang: Language }) {
  const chars    = useMemo(() => [...text],  [text]);
  const typedArr = useMemo(() => [...typed], [typed]);
  const cursorIdx = typedArr.length;

  // Sliding window: show from ~30 chars before cursor to ~130 chars ahead
  const BEFORE = 30;
  const AFTER  = 140;
  const winStart = Math.max(0, cursorIdx - BEFORE);
  const winEnd   = Math.min(chars.length, cursorIdx + AFTER);

  return (
    <div
      className="bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 shadow-sm min-h-[80px] leading-loose select-none overflow-hidden"
      style={{ fontFamily: "'Noto Sans Devanagari', 'Noto Serif Devanagari', sans-serif", fontSize: "1.2rem" }}>
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
  name: "Nepali Typing Practice Online — नेपाली टाइपिंग अभ्यास | Lok Sewa Exam",
  alternateName: [
    "Nepali Typing Practice", "नेपाली टाइपिंग अभ्यास", "लोकसेवा टाइपिंग",
    "Hindi Typing Practice", "हिंदी टाइपिंग अभ्यास",
    "Lok Sewa Typing Test", "Lokshewa Typing Practice",
    "Government Job Typing Test Nepal", "नेपाल सरकारी जागिर टाइपिंग",
  ],
  url: "https://www.studenthubnp.com/tools/nepali-typing",
  description: "Best free Nepali typing practice online for Lok Sewa Aayog exam and government job typing tests. Virtual Devanagari keyboard with real-time WPM speed test, accuracy tracking, and animated finger placement guide. Unlimited typing until timer ends. Easy, Medium, Hard difficulty levels. No sign-up required.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any — Windows, Mac, Android, iOS",
  offers: { "@type": "Offer", price: "0", priceCurrency: "NPR" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "847" },
  inLanguage: ["ne", "hi"],
  featureList: [
    "Unlimited Nepali Unicode typing practice until timer ends",
    "Hindi Devanagari typing practice",
    "Lok Sewa Aayog typing exam preparation",
    "Government job typing test simulator",
    "Virtual on-screen keyboard with Devanagari characters",
    "Animated hand placement guide showing correct finger position",
    "Home row key indicators (F and J bumps)",
    "Real-time WPM (Words Per Minute) speed tracker",
    "Real-time accuracy percentage",
    "30 seconds to 5 minute timed sessions",
    "Easy Medium Hard difficulty levels",
    "Lok Sewa pass/fail result indicator (35 WPM, 90% accuracy)",
    "Mobile and tablet friendly with horizontal keyboard scroll",
  ],
};

const SCHEMA_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How to practice Nepali typing online for free?",
      acceptedAnswer: { "@type": "Answer", text: "Use Student Hub's free Nepali Typing Practice at studenthubnp.com/tools/nepali-typing. Select Nepali language, choose Easy, Medium, or Hard difficulty, and pick your session time (30s to 5 min). Words keep coming automatically until your time runs out — just like a real exam. The animated virtual keyboard and hand guide show you exactly which finger to press. No download or sign-up required." },
    },
    {
      "@type": "Question",
      name: "What typing speed is required for Lok Sewa Aayog (लोकसेवा आयोग) typing exam?",
      acceptedAnswer: { "@type": "Answer", text: "Lok Sewa Aayog requires 30–40 WPM (words per minute) with 90%+ accuracy for most administrative positions. Student Hub shows a Lok Sewa pass/fail indicator after every session — you need 35 WPM and 90% accuracy to pass. Practice daily on studenthubnp.com/tools/nepali-typing to reach this benchmark." },
    },
    {
      "@type": "Question",
      name: "What is the best Nepali typing practice website for Lok Sewa exam?",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub (studenthubnp.com/tools/nepali-typing) is the best free Nepali typing practice website for Lok Sewa exam preparation. It offers unlimited text generation, a Devanagari virtual keyboard, animated hand guide, real-time WPM and accuracy tracking, and Medium/Hard level passages in government office style Nepali." },
    },
    {
      "@type": "Question",
      name: "लोकसेवा टाइपिङ परीक्षाको तयारी कसरी गर्ने?",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub मा नेपाली टाइपिंग अभ्यास गर्नुहोस्। Medium र Hard level का paragraphs छान्नुहोस् जसमा सरकारी कार्यालयको भाषा समावेश छ। प्रत्येक दिन १५–२० मिनेट अभ्यास गर्दा एक महिनामै ३५+ WPM पुग्न सकिन्छ। हरेक session मा Lok Sewa pass/fail result देखिन्छ।" },
    },
    {
      "@type": "Question",
      name: "How to learn Hindi typing online free?",
      acceptedAnswer: { "@type": "Answer", text: "Switch to Hindi mode on Student Hub's Nepali typing tool at studenthubnp.com/tools/nepali-typing. The Devanagari keyboard layout is the same for both Hindi and Nepali. Start with Easy level for 30–60 seconds daily, then progress to Medium and Hard. WPM and accuracy are tracked automatically." },
    },
    {
      "@type": "Question",
      name: "Which keyboard layout is used for Nepali typing in Lok Sewa exam?",
      acceptedAnswer: { "@type": "Answer", text: "This tool uses the standard Nepali Unicode keyboard layout. Key home row mappings: A=ा, S=स, D=द, F=् (halant), G=ग, H=ह, J=ज, K=क, L=ल. The virtual keyboard displays all Devanagari characters and the animated hand guide shows which finger to use for each key. F and J keys have bump indicators just like a real keyboard." },
    },
    {
      "@type": "Question",
      name: "Can I use this for government job typing test preparation in Nepal?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Student Hub's Nepali typing practice is specifically designed for Lok Sewa Aayog, Nepal Rastra Bank, army, police, and other government job typing tests. Medium and Hard level passages use formal administrative Nepali. The results screen shows whether you meet the 35 WPM / 90% accuracy government typing standard." },
    },
    {
      "@type": "Question",
      name: "Does the text run out during practice?",
      acceptedAnswer: { "@type": "Answer", text: "No — words are generated automatically and never run out. The session continues until your chosen time (30s, 1 min, 2 min, 3 min, or 5 min) is complete. This matches real Lok Sewa exam conditions where you type continuously until time is up." },
    },
    {
      "@type": "Question",
      name: "नेपाली टाइपिंग कसरी सिक्ने — शुरुवात कहाँबाट गर्ने?",
      acceptedAnswer: { "@type": "Answer", text: "पहिले Home Row सिक्नुहोस्: A=ा, S=स, D=द, F=् (हलन्त), G=ग, H=ह, J=ज, K=क, L=ल। यी ९ Key हरू नदेखी थिच्न सकेपछि Easy Level बाट सुरु गर्नुहोस्। प्रत्येक दिन १५–२० मिनेट अभ्यास गर्नुहोस्। Student Hub को Virtual Keyboard र Animated Hand Guide ले कुन औंलाले कुन Key थिच्ने भनेर देखाउँछ। Sign-up नचाहिने।" },
    },
    {
      "@type": "Question",
      name: "लोकसेवा टाइपिंग परीक्षामा कति WPM चाहिन्छ?",
      acceptedAnswer: { "@type": "Answer", text: "लोक सेवा आयोगको टाइपिंग परीक्षामा सामान्यतया ३५ WPM (Words Per Minute) र ९०% वा सोभन्दा बढी Accuracy चाहिन्छ। Student Hub ले प्रत्येक Session पछि Lok Sewa Pass/Fail Result देखाउँछ। Hard Level का Paragraphs सरकारी कार्यालयको भाषामा छन् जुन वास्तविक परीक्षासँग मिल्दोजुल्दो छ।" },
    },
    {
      "@type": "Question",
      name: "नेपाली Unicode र Romanized टाइपिंगमा के फरक छ?",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub ले Standard Nepali Unicode Keyboard Layout प्रयोग गर्छ जसमा Devanagari अक्षरहरू सिधै Key मा म्याप गरिएका छन् (जस्तै: K=क, L=ल)। Romanized टाइपिंगमा English Key थिच्दा Nepali अक्षर आउँछ। Lok Sewa परीक्षामा Standard Unicode Layout नै प्रयोग हुन्छ, त्यसैले Student Hub को यो Tool परीक्षाको लागि सही छ।" },
    },
    {
      "@type": "Question",
      name: "के यो Nepali Typing Tool Mobile मा काम गर्छ?",
      acceptedAnswer: { "@type": "Answer", text: "हो — Student Hub को Nepali Typing Tool Mobile र Tablet मा पनि काम गर्छ। On-screen Virtual Keyboard दिइएको छ र Screen Horizontal Scroll गर्न मिल्छ। तर राम्रो अभ्यासको लागि Physical Keyboard भएको Computer वा Laptop प्रयोग गर्न सिफारिस गरिन्छ, किनकि Lok Sewa परीक्षा Computer मा नै हुन्छ।" },
    },
  ],
};

const SCHEMA_HOWTO = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Practice Nepali Typing for Lok Sewa Exam — Step by Step",
  description: "Step by step guide to improve Nepali typing speed for Lok Sewa Aayog and government job typing tests.",
  step: [
    { "@type": "HowToStep", name: "Go to Nepali Typing Practice", text: "Visit studenthubnp.com/tools/nepali-typing. No sign-up or download needed." },
    { "@type": "HowToStep", name: "Choose Nepali or Hindi", text: "Select Nepali for Lok Sewa exam. Select Hindi for Hindi government job typing tests." },
    { "@type": "HowToStep", name: "Set Difficulty", text: "Begin with Easy if you are a beginner. Medium has Lok Sewa-style government office language. Hard has long official passages matching real exam difficulty." },
    { "@type": "HowToStep", name: "Set Timer", text: "Choose 30 seconds for a quick check or 3–5 minutes for exam-level sustained practice." },
    { "@type": "HowToStep", name: "Start Typing", text: "Click Start Typing. Words appear automatically and keep flowing until time is up. Use the animated hand guide to learn which finger presses each key." },
    { "@type": "HowToStep", name: "Check Your Results", text: "After the timer ends, see your WPM, accuracy, and whether you passed the Lok Sewa typing standard (35 WPM, 90% accuracy)." },
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

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ language, difficulty, duration, setLanguage, setDifficulty, setDuration, onStart, onGuide }:
  { language: Language; difficulty: Difficulty; duration: Duration;
    setLanguage: (l: Language) => void; setDifficulty: (d: Difficulty) => void; setDuration: (d: Duration) => void;
    onStart: () => void; onGuide: () => void; }) {

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
          भाषा / Language
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["nepali", "नेपाली", "Nepali Typing — Lok Sewa"],
            ["hindi",  "हिन्दी",  "Hindi Typing Practice"],
          ] as const).map(([id, script, label]) => (
            <button key={id} onClick={() => setLanguage(id)}
              className={`p-3 rounded-xl border-2 font-medium transition-all text-center ${
                language === id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-blue-200"
              }`}>
              <div className="text-2xl font-black mb-0.5" style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>{script}</div>
              <div className="text-[10px] text-gray-400">{label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">कठिनाई / Difficulty</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["easy",   "Easy",   "green",  "Short simple sentences"],
            ["medium", "Medium", "yellow", "Lok Sewa-style passages"],
            ["hard",   "Hard",   "red",    "Exam-level long paragraphs"],
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

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">समय / Time</label>
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

      <div className="flex gap-3 pt-1">
        <button onClick={onStart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2 shadow-md">
          Start Typing <ChevronRight className="w-5 h-5" />
        </button>
        <button onClick={onGuide}
          className="p-4 border-2 border-gray-200 rounded-xl text-gray-500 hover:border-blue-200 hover:text-blue-600 transition-all"
          title="Finger guide">
          <BookOpen className="w-5 h-5" />
        </button>
      </div>

      <div className="pt-1 opacity-50 hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2 text-center flex items-center justify-center gap-1.5">
          <Keyboard className="w-3 h-3" /> Keyboard Layout Preview
        </p>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-max mx-auto">
            <VirtualKeyboard activeCode={null} onKeyClick={() => {}} onBackspace={() => {}} />
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-300 sm:hidden mt-1">← scroll keyboard →</p>
      </div>
    </div>
  );
}

// ── Guide Screen ──────────────────────────────────────────────────────────────
function GuideScreen({ onBack }: { onBack: () => void }) {
  const fingerData = [
    { id: "LP" as Finger, name: "Left Pinky",   keys: "Q  A  Z  1  `",       nepali: "ट  ा  ँ  १" },
    { id: "LR" as Finger, name: "Left Ring",    keys: "W  S  X  2",           nepali: "ठ  स  ं  २" },
    { id: "LM" as Finger, name: "Left Middle",  keys: "E  D  C  3",           nepali: "ु  द  च  ३" },
    { id: "LI" as Finger, name: "Left Index",   keys: "R F V T G B  4 5",     nepali: "र  ्  व  त  ग  ब" },
    { id: "RI" as Finger, name: "Right Index",  keys: "Y H N  U J M  6 7",    nepali: "य  ह  न  ू  ज  म" },
    { id: "RM" as Finger, name: "Right Middle", keys: "I  K  ,  8",           nepali: "ि/ी  क  ,  ८" },
    { id: "RR" as Finger, name: "Right Ring",   keys: "O  L  .  9",           nepali: "ो  ल  ।  ९" },
    { id: "RP" as Finger, name: "Right Pinky",  keys: "P  ;  /  [  ]  0",     nepali: "प  ः  ्  े  ं  ०" },
    { id: "T"  as Finger, name: "Both Thumbs",  keys: "Space Bar",             nepali: "खाली ठाउँ" },
  ];
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Keyboard & Finger Guide — किबोर्ड औंला गाइड</h2>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-blue-800 mb-1">🏠 Home Row — यहाँबाट सुरु गर्नुहोस्</h3>
        <p className="text-sm text-blue-700">
          Left hand rests on <strong>A S D F</strong> (ा स द ् ) · Right hand on <strong>J K L ;</strong> (ज क ल ः).
          Always return here after pressing any key. F and J keys have small bumps to find without looking.
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
            <div className="text-[10px] text-gray-400" style={{ fontFamily: "'Noto Sans Devanagari', sans-serif" }}>{f.nepali}</div>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-bold text-amber-800 mb-2">💡 Lok Sewa Typing Exam Tips</h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Look at the screen, NOT the keyboard — builds muscle memory faster</li>
          <li>Accuracy first, speed second — errors hurt your effective WPM score</li>
          <li>Practice 15–20 minutes daily — visible improvement within 2 weeks</li>
          <li>Use Hard level for Lok Sewa and government job exam preparation</li>
          <li>Shift + I types ी (long i matra) · I alone types ि (short i matra)</li>
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
      <p className="text-gray-500 text-sm font-medium">तयार हुनुहोस् — Get ready…</p>
      <div className="text-8xl font-black text-blue-600">{count}</div>
    </div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────
function ResultsScreen({ wpm, accuracy, correct, errors, duration, language, difficulty, onRetry, onSetup }:
  { wpm: number; accuracy: number; correct: number; errors: number;
    duration: Duration; language: Language; difficulty: Difficulty;
    onRetry: () => void; onSetup: () => void; }) {

  const grade      = accuracy >= 95 ? "A+" : accuracy >= 85 ? "A" : accuracy >= 75 ? "B+" : accuracy >= 60 ? "B" : "C";
  const wpmLabel   = wpm >= 45 ? "Expert" : wpm >= 35 ? "Proficient" : wpm >= 25 ? "Average" : "Beginner";
  const lokPassed  = wpm >= 35 && accuracy >= 90;
  const feedback   = accuracy >= 95 ? "Excellent! Lok Sewa typing exam ready! 🎉"
    : accuracy >= 85 ? "Great! A bit more practice and you pass Lok Sewa. 💪"
    : accuracy >= 70 ? "Good progress! Focus on accuracy before speed. 👍"
    : "Keep going! Start Easy mode to build muscle memory. 📚";
  const langLabel  = language === "nepali" ? "Nepali नेपाली" : "Hindi हिन्दी";

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center">
        <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
        <h2 className="text-2xl font-black text-gray-900">Your Results</h2>
        <p className="text-gray-500 text-sm">{langLabel} · {difficulty} · {duration < 60 ? `${duration}s` : `${duration / 60} min`}</p>
      </div>
      <div className={`rounded-xl p-3 text-center text-sm font-bold ${lokPassed ? "bg-green-50 border-2 border-green-200 text-green-700" : "bg-amber-50 border-2 border-amber-200 text-amber-700"}`}>
        {lokPassed
          ? "✅ Lok Sewa Typing Exam Level Passed! (35+ WPM, 90%+ Accuracy)"
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
function PracticeScreen({ text, typed, timeLeft, duration, language, onKeyClick, onBackspace }:
  { text: string; typed: string; timeLeft: number; duration: Duration; language: Language;
    onKeyClick: (ch: string) => void; onBackspace: () => void; }) {

  const chars    = useMemo(() => [...text],  [text]);
  const typedArr = useMemo(() => [...typed], [typed]);
  const nextChar = chars[typedArr.length];

  const activeKey    = nextChar ? (CHAR_TO_KEY[nextChar] ?? null) : null;
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

      {/* Text display */}
      <TextDisplay text={text} typed={typed} lang={language} />

      {/* Key hint */}
      {activeKey && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 flex-wrap">
          <span className="w-2 h-2 rounded-full" style={{ background: FINGER_BG[activeKey.finger] }} />
          Press{activeKey.shift ? " Shift + " : " "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono font-bold text-gray-700">
            {activeKey.code.replace("Key","").replace("Digit","").replace("BracketLeft","[").replace("BracketRight","]").replace("Semicolon",";").replace("Comma",",").replace("Period",".").replace("Slash","/").replace("Backquote","`").replace("Space","Space")}
          </kbd>
          <span style={{ color: FINGER_BG[activeKey.finger] }} className="font-semibold">{FINGER_LABEL[activeKey.finger]}</span>
        </div>
      )}

      {/* Hand guide — prominent, above keyboard */}
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
function SeoSection({ language }: { language: Language }) {
  const isNepali = language === "nepali";
  return (
    <section className="mt-10 border-t border-gray-100 pt-8 space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          {isNepali
            ? "Best Free Nepali Typing Practice — लोकसेवा र सरकारी जागिर टाइपिंग परीक्षा"
            : "Best Free Hindi Typing Practice Online — हिंदी टाइपिंग अभ्यास"}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          {isNepali
            ? "Student Hub को नेपाली टाइपिंग अभ्यास उपकरण लोकसेवा आयोगको परीक्षा, सरकारी जागिरको टाइपिङ टेस्ट र विद्यार्थीहरूका लागि तयार गरिएको हो। समय सकिनुअघि शब्दहरू कहिल्यै सकिँदैनन् — ठीक परीक्षाजस्तै। भर्चुअल किबोर्डले सही औंला देखाउँछ र WPM तथा शुद्धता वास्तविक समयमा ट्र्याक हुन्छ।"
            : "Student Hub का Hindi typing practice tool सरकारी नौकरी परीक्षाओं की तैयारी करने वाले विद्यार्थियों के लिए बनाया गया है। समय समाप्त होने तक शब्द कभी खत्म नहीं होते। वास्तविक समय में WPM और accuracy track होती है।"}
        </p>
      </div>

      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">Who Uses This Typing Tool</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: "🏛️ Lok Sewa Aspirants", desc: "लोकसेवा आयोगको परीक्षाको तयारी — Medium र Hard level का passages exam difficulty mirror गर्छन्।" },
            { title: "💼 Government Job Seekers", desc: "35 WPM in Nepali with 90%+ accuracy — standard benchmark. Results screen shows pass/fail instantly." },
            { title: "🎓 Students (Grade 9–Bachelor)", desc: "Build foundational typing skills for academic and professional productivity." },
            { title: "🏦 Banking & Office Staff", desc: "Nepal Rastra Bank, commercial banks, and offices all require fast accurate Devanagari typing." },
          ].map(c => (
            <div key={c.title} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="font-bold text-sm text-gray-800 mb-1">{c.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">How to Improve Nepali Typing Speed Fast</h2>
        <ol className="space-y-2">
          {[
            { n:"1", t:"Start Easy — accuracy first", d:"Type slowly and correctly. 20 WPM accurate beats 40 WPM with errors." },
            { n:"2", t:"Follow the colour-coded hand guide", d:"Each colour = one finger. The animated hands show which finger to use in real time." },
            { n:"3", t:"Practice 15 min every day", d:"Daily consistency beats long sessions. One month of daily practice = exam-ready speed." },
            { n:"4", t:"Move to Medium, then Hard", d:"Medium has formal Nepali used in government offices. Hard mimics real Lok Sewa exam passages." },
            { n:"5", t:"Target 35 WPM, 90% accuracy", d:"See your Lok Sewa pass/fail status at the end of every session." },
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
          { title: "Lok Sewa Ready", desc: "35 WPM target" },
          { title: "Mobile Friendly",desc: "All devices" },
        ].map(f => (
          <div key={f.title} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="font-bold text-xs text-gray-800">{f.title}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{f.desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="font-bold text-sm text-blue-800 mb-2">Also on Student Hub</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/tools/english-typing">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">English Typing Test →</span>
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
  const langRef        = useRef(language);
  const textRef        = useRef(text);
  const diffRef        = useRef(difficulty);
  phaseRef.current  = phase;
  langRef.current   = language;
  textRef.current   = text;
  diffRef.current   = difficulty;

  const startPractice = useCallback(() => {
    const initialText = generateStream(language, difficulty, 80);
    setText(initialText);
    setTyped("");
    setTimeLeft(duration);
    setCountdown(3);
    setPhase("countdown");
  }, [language, difficulty, duration]);

  // Auto-append words when near end (infinite mode)
  useEffect(() => {
    if (phase !== "practice") return;
    const typedLen = [...typed].length;
    const textLen  = [...text].length;
    if (textLen - typedLen < 300) {
      // Append more sentences quietly
      const more = generateStream(langRef.current, diffRef.current, 60);
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

  // Timer — ends session ONLY when time hits 0
  useEffect(() => {
    if (phase !== "practice") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setTimeLeft(t => {
      if (t <= 1) {
        clearInterval(timerRef.current!);
        return 0;
      }
      return t - 1;
    }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Finish when timeLeft hits 0
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
    if (e.code === "Backspace") {
      setTyped(p => [...p].slice(0, -1).join(""));
      return;
    }
    if (e.code === "Space") {
      setTyped(p => p + " ");
      return;
    }
    const ch = e.shiftKey ? CODE_TO_NPS[e.code] : CODE_TO_NP[e.code];
    if (ch) setTyped(p => p + ch);
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

  const langLabel  = language === "nepali" ? "नेपाली टाइपिंग अभ्यास — Nepali Typing Practice" : "हिंदी टाइपिंग अभ्यास — Hindi Typing Practice";
  const langSubtitle = language === "nepali"
    ? "नेपाली · लोकसेवा परीक्षा · Virtual Keyboard · Unlimited WPM Test · Free"
    : "हिन्दी · Devanagari · Virtual Keyboard · Unlimited WPM Test · Free";

  return (
    <>
      <Helmet>
        <title>
          {language === "nepali"
            ? "नेपाली टाइपिंग अभ्यास | Free Nepali Typing Practice Online — Lok Sewa Exam | Student Hub Nepal"
            : "हिंदी टाइपिंग अभ्यास | Free Hindi Typing Practice Online — Government Job Exam | Student Hub"}
        </title>
        <meta name="description" content={language === "nepali"
          ? "नेपाली टाइपिंग अभ्यास — लोकसेवा आयोग र सरकारी जागिर टाइपिंग परीक्षाको लागि निःशुल्क नेपाली टाइपिंग अभ्यास। Free Nepali typing practice online: unlimited words, virtual Devanagari keyboard, animated hand guide, real-time WPM & accuracy. No sign-up."
          : "हिंदी टाइपिंग अभ्यास — सरकारी नौकरी टाइपिंग परीक्षा के लिए मुफ्त हिंदी टाइपिंग अभ्यास। Free Hindi typing practice: unlimited words, Devanagari keyboard, hand guide, WPM test. No sign-up."} />
        <meta name="keywords" content={language === "nepali"
          ? "नेपाली टाइपिंग अभ्यास, नेपाली टाइपिंग, लोकसेवा टाइपिंग, लोक सेवा आयोग टाइपिंग, सरकारी जागिर टाइपिंग, टाइपिंग परीक्षा नेपाल, नेपाली टाइपिंग ऑनलाइन, WPM टाइपिंग परीक्षा, नेपाली कीबोर्ड टाइपिंग, मुफ्त नेपाली टाइपिंग, nepali typing practice, nepali typing online, nepali typing test, nepali typing speed test, lok sewa typing test, lokshewa typing practice, loksewa typing exam, government job typing test nepal, nepal government typing, nepali unicode typing, devanagari typing practice, nepali typing for lok sewa aayog, nepali wpm test, nepali typing tutor, nepali keyboard layout, free nepali typing, learn nepali typing fast, nepali typing 35 wpm, nepali typing accuracy, how to type in nepali, type nepali online free, nepali typing practice for beginners"
          : "हिंदी टाइपिंग अभ्यास, हिंदी टाइपिंग, हिंदी टाइपिंग परीक्षा, सरकारी नौकरी टाइपिंग, मुफ्त हिंदी टाइपिंग, hindi typing practice, hindi typing online, hindi typing test, hindi typing speed test, devanagari typing, hindi typing tutor, hindi typing wpm, free hindi typing, government job typing hindi, hindi unicode typing"} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="author" content="Student Hub Nepal" />
        <meta property="og:title" content={language === "nepali"
          ? "नेपाली टाइपिंग अभ्यास | Free Nepali Typing Practice — Lok Sewa Exam | Student Hub Nepal"
          : "हिंदी टाइपिंग अभ्यास | Free Hindi Typing Practice Online | Student Hub"} />
        <meta property="og:description" content={language === "nepali"
          ? "नेपाली टाइपिंग अभ्यास — लोकसेवा आयोग परीक्षाको लागि निःशुल्क। Unlimited words, virtual keyboard, animated hand guide, WPM & accuracy tracker. No sign-up."
          : "हिंदी टाइपिंग अभ्यास — सरकारी परीक्षाको लागि निःशुल्क। Unlimited words, Devanagari keyboard, hand guide, WPM test. No sign-up."} />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <meta property="og:image:alt" content="नेपाली टाइपिंग अभ्यास — Free Nepali Typing Practice for Lok Sewa Exam | Student Hub Nepal" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/tools/nepali-typing" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta property="og:locale" content="ne_NP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={language === "nepali" ? "नेपाली टाइपिंग अभ्यास — Free Nepali Typing Practice | Lok Sewa Exam | Student Hub" : "हिंदी टाइपिंग अभ्यास — Free Hindi Typing Practice | Student Hub"} />
        <meta name="twitter:description" content={language === "nepali" ? "नेपाली टाइपिंग अभ्यास — लोकसेवा परीक्षाको लागि निःशुल्क। Unlimited words, virtual Devanagari keyboard, WPM & accuracy. No sign-up." : "हिंदी टाइपिंग अभ्यास — Free Hindi typing practice. Unlimited words, Devanagari keyboard, WPM test. No sign-up."} />
        <meta name="twitter:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta name="geo.region" content="NP" />
        <meta name="geo.placename" content="Nepal" />
        <link rel="canonical" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="ne" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="hi" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <link rel="alternate" hrefLang="en" href="https://www.studenthubnp.com/tools/english-typing" />
        <link rel="alternate" hrefLang="x-default" href="https://www.studenthubnp.com/tools/nepali-typing" />
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">{langLabel}</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{langSubtitle}</p>
          </div>
          {phase === "practice" && (
            <button onClick={() => setPhase("setup")}
              className="flex-shrink-0 flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-2 transition-all" type="button">
              <RotateCcw className="w-3.5 h-3.5" /> Stop
            </button>
          )}
        </div>

        {phase === "setup"     && <SetupScreen language={language} difficulty={difficulty} duration={duration} setLanguage={setLanguage} setDifficulty={setDifficulty} setDuration={setDuration} onStart={startPractice} onGuide={() => setPhase("guide")} />}
        {phase === "guide"     && <GuideScreen onBack={() => setPhase("setup")} />}
        {phase === "countdown" && <CountdownScreen count={countdown} />}
        {phase === "practice"  && <PracticeScreen text={text} typed={typed} timeLeft={timeLeft} duration={duration} language={language} onKeyClick={handleKeyClick} onBackspace={handleBackspace} />}
        {phase === "results"   && <ResultsScreen {...finalStats} duration={duration} language={language} difficulty={difficulty} onRetry={startPractice} onSetup={() => setPhase("setup")} />}

        {phase === "setup" && <SeoSection language={language} />}
      </div>
    </>
  );
}
