import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, RotateCcw, Trophy, Clock, Target, Zap,
  ChevronRight, BookOpen, RefreshCw, Settings2, Keyboard,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type Language   = "nepali" | "hindi" | "english";
type Difficulty = "easy" | "medium" | "hard";
type Duration   = 30 | 60 | 120 | 180 | 300;
type Phase      = "setup" | "guide" | "countdown" | "practice" | "results";
type Finger     = "LP" | "LR" | "LM" | "LI" | "RI" | "RM" | "RR" | "RP" | "T";

// ── Finger theme ──────────────────────────────────────────────────────────────
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
  LP: "bg-purple-500 border-purple-700 text-white !shadow-none translate-y-[2px]",
  LR: "bg-blue-500   border-blue-700   text-white !shadow-none translate-y-[2px]",
  LM: "bg-cyan-500   border-cyan-700   text-white !shadow-none translate-y-[2px]",
  LI: "bg-teal-500   border-teal-700   text-white !shadow-none translate-y-[2px]",
  RI: "bg-green-500  border-green-700  text-white !shadow-none translate-y-[2px]",
  RM: "bg-yellow-500 border-yellow-700 text-white !shadow-none translate-y-[2px]",
  RR: "bg-orange-500 border-orange-700 text-white !shadow-none translate-y-[2px]",
  RP: "bg-red-500    border-red-700    text-white !shadow-none translate-y-[2px]",
  T:  "bg-slate-500  border-slate-700  text-white !shadow-none translate-y-[2px]",
};
const FINGER_LABEL: Record<Finger, string> = {
  LP: "Left Pinky", LR: "Left Ring", LM: "Left Middle", LI: "Left Index",
  RI: "Right Index", RM: "Right Middle", RR: "Right Ring", RP: "Right Pinky", T: "Thumb",
};

// ── Keyboard Layout ───────────────────────────────────────────────────────────
interface KeyDef {
  code: string;
  label: string;   // physical English key label (A, B, 1, etc.)
  np: string;      // Devanagari char (no shift)
  npS: string;     // Devanagari char (shift)
  finger: Finger;
}

const ROW0: KeyDef[] = [
  { code:"Backquote", label:"`",  np:"्",  npS:"ँ",  finger:"LP" },
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
const ROW1: KeyDef[] = [
  { code:"KeyQ",         label:"Q", np:"ट",  npS:"ठ",  finger:"LP" },
  { code:"KeyW",         label:"W", np:"ठ",  npS:"ऊ",  finger:"LR" },
  { code:"KeyE",         label:"E", np:"ु",  npS:"ए",  finger:"LM" },
  { code:"KeyR",         label:"R", np:"र",  npS:"ऋ",  finger:"LI" },
  { code:"KeyT",         label:"T", np:"त",  npS:"थ",  finger:"LI" },
  { code:"KeyY",         label:"Y", np:"य",  npS:"ञ",  finger:"RI" },
  { code:"KeyU",         label:"U", np:"ू",  npS:"उ",  finger:"RI" },
  { code:"KeyI",         label:"I", np:"ि",  npS:"ई",  finger:"RM" },
  { code:"KeyO",         label:"O", np:"ो",  npS:"औ",  finger:"RR" },
  { code:"KeyP",         label:"P", np:"प",  npS:"फ",  finger:"RP" },
  { code:"BracketLeft",  label:"[", np:"े",  npS:"ऐ",  finger:"RP" },
  { code:"BracketRight", label:"]", np:"ं",  npS:"अं", finger:"RP" },
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

// ── Character → Key mappings ───────────────────────────────────────────────────
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
CHAR_TO_KEY[" "] = { code: "Space", shift: false, finger: "T" };

// English character → key mapping
const EN_CHAR_TO_KEY: Record<string, { code: string; shift: boolean; finger: Finger }> = {};
for (const row of ALL_KEY_ROWS) {
  for (const k of row) {
    if (/^[A-Z]$/.test(k.label)) {
      EN_CHAR_TO_KEY[k.label.toLowerCase()] = { code: k.code, shift: false, finger: k.finger };
      EN_CHAR_TO_KEY[k.label.toUpperCase()] = { code: k.code, shift: true,  finger: k.finger };
    }
  }
}
EN_CHAR_TO_KEY[" "]  = { code: "Space",  shift: false, finger: "T"  };
EN_CHAR_TO_KEY["."]  = { code: "Period", shift: false, finger: "RR" };
EN_CHAR_TO_KEY[","]  = { code: "Comma",  shift: false, finger: "RM" };
EN_CHAR_TO_KEY[";"]  = { code: "Semicolon", shift: false, finger: "RP" };
EN_CHAR_TO_KEY["!"]  = { code: "Digit1", shift: true,  finger: "LP" };
EN_CHAR_TO_KEY["?"]  = { code: "Slash",  shift: true,  finger: "RP" };
EN_CHAR_TO_KEY["'"]  = { code: "Quote",  shift: false, finger: "RP" };

// ── Texts ─────────────────────────────────────────────────────────────────────
const TEXTS: Record<Language, Record<Difficulty, string[]>> = {
  nepali: {
    easy: [
      "राम घर जान्छ। सिता खाना बनाउँछिन्। हामी साथमा खेल्छौं।",
      "नेपाल सुन्दर देश हो। हिमाल ठूलो छ। नदी बग्छ।",
      "आज मौसम राम्रो छ। हावा शीतल छ। आकाश नीलो छ।",
      "बाबा कार्यालय जानुभयो। आमा खाना पकाउनुभयो। दिदी पढ्दै हुनुहुन्छ।",
      "विद्यालय टाढा छैन। साथीहरू मिलनसार छन्। पढाइ राम्रो छ।",
    ],
    medium: [
      "नेपाल एक सुन्दर देश हो जहाँ हिमाल, पहाड र तराई छन्। यहाँ धेरै जाति र धर्मका मानिसहरू मिलेर बस्छन्।",
      "विद्यार्थीले मन लगाएर पढे सबै कुरा सिक्न सकिन्छ। पढाइ नै जीवनको आधार हो। ज्ञान बढाउनु सबैभन्दा ठूलो लगानी हो।",
      "नेपालको राजधानी काठमाडौं हो। यो शहर धेरै पुरानो र ऐतिहासिक छ। यहाँ पशुपतिनाथ, स्वयम्भूनाथ लगायत धेरै मन्दिर छन्।",
      "लोकसेवा आयोगले सरकारी पदमा कर्मचारी भर्ना गर्दछ। परीक्षामा लिखित, अन्तर्वार्ता र टाइपिङ परीक्षण हुन्छ। तयारी अहिलेदेखि नै सुरु गर्नुपर्छ।",
      "सगरमाथा संसारको सबभन्दा अग्लो पर्वत हो। यसको उचाइ ८,८४८ मिटर छ। हरेक वर्ष धेरै पर्वतारोही नेपाल आउँछन्।",
    ],
    hard: [
      "नेपाली भाषा देवनागरी लिपिमा लेखिन्छ। यो भाषा संस्कृतबाट विकास भएको हो। नेपाली साहित्य अत्यन्त समृद्ध छ। भानुभक्त आचार्यलाई आदिकवि भनिन्छ।",
      "लोकसेवा आयोगको परीक्षामा सफल हुन टाइपिङ गतिको साथसाथै शुद्धता पनि आवश्यक छ। प्रत्येक दिन कम्तीमा पन्ध्र मिनेट अभ्यास गर्दा छिटो सुधार हुन्छ।",
      "हाम्रो देशको विकासका लागि शिक्षा, स्वास्थ्य र पूर्वाधार निर्माणमा जोड दिनु अत्यन्त जरुरी छ। राम्रो शिक्षाले देशलाई प्रगतिको बाटोमा लैजान्छ।",
      "नेपालको भूगोल विविध छ। उत्तरमा हिमाल, मध्यमा पहाड र दक्षिणमा तराई फैलिएको छ। यही विविधताले नेपाललाई अनूठो र आकर्षक बनाउँछ। पर्यटन प्रमुख उद्योग हो।",
      "सरकारी सेवामा प्रवेश गर्न लोकसेवा आयोगको परीक्षा दिनुपर्छ। यस परीक्षामा सामान्य ज्ञान, नेपाली, अङ्ग्रेजी र सम्बन्धित विषयको ज्ञान जाँचिन्छ। तयारी व्यवस्थित हुनुपर्छ।",
    ],
  },
  hindi: {
    easy: [
      "राम घर जाता है। सीता खाना बनाती है। हम साथ रहते हैं।",
      "भारत एक महान देश है। पहाड़ ऊँचे हैं। नदी बहती है।",
      "आज मौसम अच्छा है। हवा ठंडी है। आकाश नीला है।",
      "पिताजी दफ्तर गए। माँ खाना बना रही हैं। दीदी पढ़ रही है।",
      "विद्यालय पास ही है। मित्र मिलनसार हैं। पढ़ाई अच्छी है।",
    ],
    medium: [
      "भारत एक विशाल देश है जहाँ पहाड़, मैदान और समुद्र तट मिलकर बसे हैं। यहाँ अनेक जातियाँ और धर्म के लोग मिलकर रहते हैं।",
      "विद्यार्थी मन लगाकर पढ़ें तो सब कुछ सीखा जा सकता है। पढ़ाई ही जीवन की नींव है। ज्ञान बढ़ाना सबसे बड़ा निवेश है।",
      "दिल्ली भारत की राजधानी है। यह शहर बहुत पुराना और ऐतिहासिक है। यहाँ कई मंदिर और स्मारक हैं।",
      "सरकारी नौकरी पाने के लिए टाइपिंग परीक्षा पास करना जरूरी है। रोज पंद्रह मिनट अभ्यास करने से जल्दी सुधार होता है।",
      "एवरेस्ट दुनिया की सबसे ऊँची चोटी है। इसकी ऊँचाई ८,८४८ मीटर है। हर साल कई पर्वतारोही नेपाल आते हैं।",
    ],
    hard: [
      "हिंदी भाषा देवनागरी लिपि में लिखी जाती है। यह संस्कृत से विकसित हुई है। हिंदी साहित्य बहुत समृद्ध है। कबीर, तुलसीदास और मीराबाई इसके प्रमुख कवि हैं।",
      "सरकारी नौकरी की परीक्षा में टाइपिंग गति के साथ-साथ शुद्धता भी जरूरी है। हिंदी टाइपिंग में पारंगत होने के लिए नियमित अभ्यास अनिवार्य है।",
      "हमारे देश के विकास के लिए शिक्षा, स्वास्थ्य और बुनियादी ढाँचे के निर्माण पर जोर देना बहुत जरूरी है। अच्छी शिक्षा ही देश को प्रगति के पथ पर ले जाती है।",
      "भारत की भूगोल विविध है। उत्तर में हिमालय, मध्य में मैदान और दक्षिण में समुद्र तट फैला है। यही विविधता भारत को अनूठा बनाती है। पर्यटन यहाँ का प्रमुख उद्योग है।",
    ],
  },
  english: {
    easy: [
      "The cat sat on the mat. The dog ran fast. We play and learn each day.",
      "She sells sea shells by the sea shore. The sun is bright today.",
      "Good habits lead to good results. Study hard and stay focused every day.",
      "Nepal is a beautiful country. Mount Everest is the tallest peak in the world.",
      "Books are our best friends. Reading every day makes us smarter and wiser.",
    ],
    medium: [
      "The Lok Sewa Aayog is the Public Service Commission of Nepal. It recruits civil servants through written exams and interviews. Typing speed is tested for many government positions.",
      "To become a government employee in Nepal, candidates must pass the Lok Sewa exam. The test includes general knowledge, Nepali, English, and subject-specific questions.",
      "English typing practice is essential for students and professionals. A speed of thirty five words per minute is required for most government job typing tests in Nepal.",
      "Nepal Public Service Commission conducts examinations for various civil service positions. Good typing speed and accuracy can help you stand out in the selection process.",
      "Consistent daily practice is the key to improving your typing speed. Start with accuracy and the speed will follow naturally over time with regular sessions.",
    ],
    hard: [
      "The Nepal Public Service Commission, known as Lok Sewa Aayog, is responsible for recruiting government employees at federal and provincial levels. Candidates must demonstrate proficiency in both Nepali and English typing to qualify for administrative positions.",
      "Government job typing tests require candidates to type at least thirty to forty words per minute with an accuracy of ninety percent or above. Regular practice using structured passages helps build the muscle memory needed for consistent performance.",
      "Typing proficiency is a fundamental skill for modern office work. Whether you are preparing for Lok Sewa exams, banking sector recruitment, or corporate positions, strong keyboard skills significantly improve your productivity and career prospects.",
      "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet and is widely used for typing practice. Mastering this sentence ensures your fingers cover all keys on the keyboard.",
      "Students preparing for civil service exams should practice typing both in English and Nepali. The standard keyboard layout follows the QWERTY arrangement where home row keys are A, S, D, F for the left hand and J, K, L for the right hand.",
    ],
  },
};

// ── SEO Schemas ────────────────────────────────────────────────────────────────
const SCHEMA_APP = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Free Typing Practice Online — Nepali, Hindi & English Typing Tutor",
  alternateName: [
    "Nepali Typing Practice", "नेपाली टाइपिंग अभ्यास",
    "Hindi Typing Practice", "हिंदी टाइपिंग",
    "English Typing Test", "Lok Sewa Typing Practice",
    "लोकसेवा टाइपिंग", "Government Job Typing Test Nepal",
  ],
  url: "https://www.studenthubnp.com/tools/nepali-typing",
  description: "Best free typing practice online for Nepal. Practice Nepali, Hindi and English typing with virtual keyboard, finger guide, WPM speed test and accuracy tracking. Ideal for Lok Sewa Aayog exam preparation and government job typing tests.",
  applicationCategory: "EducationApplication",
  operatingSystem: "Any — Windows, Mac, Android, iOS",
  offers: { "@type": "Offer", price: "0", priceCurrency: "NPR" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "612" },
  inLanguage: ["ne", "hi", "en"],
  featureList: [
    "Nepali Unicode keyboard typing practice",
    "Hindi Devanagari typing practice",
    "English typing speed test",
    "Lok Sewa Aayog typing exam preparation",
    "Government job typing test practice",
    "Virtual on-screen keyboard with finger color-coding",
    "Real-time hand placement diagram",
    "Easy, Medium, Hard difficulty levels",
    "WPM (Words Per Minute) speed tracker",
    "Accuracy percentage tracking",
    "30 seconds to 5 minute timed sessions",
    "Fully mobile and tablet friendly",
  ],
};

const SCHEMA_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How to practice Nepali typing online for free?",
      acceptedAnswer: { "@type": "Answer", text: "Use Student Hub's free Nepali Typing Practice at studenthubnp.com/tools/nepali-typing. Select Nepali language, choose Easy, Medium, or Hard difficulty, and pick your session time. The virtual keyboard highlights the correct key and shows which finger to use. No sign-up required." },
    },
    {
      "@type": "Question",
      name: "What typing speed is required for Lok Sewa Aayog (लोकसेवा आयोग) exam?",
      acceptedAnswer: { "@type": "Answer", text: "Lok Sewa Aayog typically requires 30–40 words per minute (WPM) in Nepali typing with 90%+ accuracy for administrative positions. For English typing, the requirement is usually 35 WPM. Practice daily on Student Hub to reach and exceed this benchmark." },
    },
    {
      "@type": "Question",
      name: "Which is the best English typing test practice website for Nepal government jobs?",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub offers the best free English typing practice with government job-style passages. Visit studenthubnp.com/tools/english-typing to practice English typing. The tool tracks your WPM and accuracy in real time — exactly what Lok Sewa and other exams measure." },
    },
    {
      "@type": "Question",
      name: "How to learn Hindi typing online free?",
      acceptedAnswer: { "@type": "Answer", text: "Switch to Hindi mode on Student Hub's typing tool. The Devanagari keyboard layout is identical for both Hindi and Nepali. Start with Easy level, practice for 30–60 seconds daily, and progress to Hard level. WPM and accuracy are tracked automatically." },
    },
    {
      "@type": "Question",
      name: "लोकसेवा टाइपिंग परीक्षाको तयारी कसरी गर्ने? (How to prepare for Lok Sewa typing exam?)",
      acceptedAnswer: { "@type": "Answer", text: "Student Hub मा नेपाली टाइपिंग अभ्यास गर्नुहोस्। Medium र Hard level का paragraphs छान्नुहोस् जसमा सरकारी कार्यालयको भाषा समावेश छ। प्रत्येक दिन १५–२० मिनेट अभ्यास गर्दा एक महिनामै ३५+ WPM पुग्न सकिन्छ।" },
    },
    {
      "@type": "Question",
      name: "Which keyboard layout is used for Nepali typing?",
      acceptedAnswer: { "@type": "Answer", text: "This tool uses the standard Nepali Unicode keyboard layout. Key mappings: A=ा, S=स, D=द, F=् (halant/virama), G=ग, H=ह, J=ज, K=क, L=ल, N=न, M=म, R=र, T=त, Y=य, P=प. The virtual keyboard displays all characters so you can learn without any setup." },
    },
    {
      "@type": "Question",
      name: "Is this typing practice tool good for government job exam preparation?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Student Hub's typing practice tool is specifically designed with government exam use cases in mind. Medium and Hard level passages include civil service and administrative language. The WPM and accuracy metrics directly match what Lok Sewa Aayog, Nepal Rastra Bank, and other government bodies test." },
    },
    {
      "@type": "Question",
      name: "Can I practice English typing test for government jobs here?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Visit studenthubnp.com/tools/english-typing for dedicated English typing practice. The passages include government job scenarios, Lok Sewa exam style content, and general professional English. The tool tests your WPM and accuracy exactly like real government typing exams." },
    },
  ],
};

const SCHEMA_HOWTO = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Practice Nepali Typing Online",
  description: "Step by step guide to improve your Nepali typing speed for Lok Sewa exam and government job tests.",
  step: [
    { "@type": "HowToStep", name: "Choose Language", text: "Select Nepali, Hindi, or English from the language buttons on the typing practice page." },
    { "@type": "HowToStep", name: "Set Difficulty", text: "Start with Easy if you are a beginner. Medium suits intermediate typists. Hard is for Lok Sewa exam preparation." },
    { "@type": "HowToStep", name: "Set Time", text: "Choose 30 seconds for quick tests or 1–3 minutes for sustained practice sessions." },
    { "@type": "HowToStep", name: "Start Typing", text: "Click Start and type the displayed text. Use the virtual keyboard and hand guide to learn correct finger placement." },
    { "@type": "HowToStep", name: "Check Results", text: "After the session, review your WPM and accuracy. Aim for 35 WPM and 90% accuracy to pass government job typing tests." },
  ],
};

// ── SVG Hand Guide ────────────────────────────────────────────────────────────
function HandGuide({ activeFinger }: { activeFinger: Finger | null }) {
  function Hand({ side }: { side: "left" | "right" }) {
    const isLeft = side === "left";
    const fingers: Array<{ id: Finger; x: number; y: number; w: number; h: number; rx: number }> = isLeft
      ? [
          { id: "LP", x: 8,  y: 52,  w: 22, h: 78,  rx: 10 },
          { id: "LR", x: 34, y: 32,  w: 22, h: 88,  rx: 10 },
          { id: "LM", x: 60, y: 18,  w: 22, h: 102, rx: 10 },
          { id: "LI", x: 86, y: 34,  w: 22, h: 86,  rx: 10 },
        ]
      : [
          { id: "RI", x: 12, y: 34,  w: 22, h: 86,  rx: 10 },
          { id: "RM", x: 38, y: 18,  w: 22, h: 102, rx: 10 },
          { id: "RR", x: 64, y: 32,  w: 22, h: 88,  rx: 10 },
          { id: "RP", x: 90, y: 52,  w: 22, h: 78,  rx: 10 },
        ];
    const thumbL = { id: "T" as Finger, x: 94, y: 100, w: 30, h: 22, rx: 10, rotate: -35, cx: 94, cy: 120 };
    const thumbR = { id: "T" as Finger, x: -4, y: 100, w: 30, h: 22, rx: 10, rotate:  35, cx: 16, cy: 120 };
    const thumb  = isLeft ? thumbL : thumbR;

    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-semibold text-gray-400 tracking-wide uppercase">
          {isLeft ? "Left Hand" : "Right Hand"}
        </span>
        <svg viewBox="0 0 120 170" width="80" height="113" className="overflow-visible">
          <rect x="8" y="116" width="104" height="50" rx="16" fill="#f5d5bb" stroke="#d4a88a" strokeWidth="1.5" />
          {fingers.map(f => {
            const isActive = activeFinger === f.id;
            return (
              <g key={f.id}>
                <rect
                  x={f.x} y={f.y} width={f.w} height={f.h} rx={f.rx}
                  fill={isActive ? FINGER_BG[f.id] : "#f0f4f8"}
                  stroke={isActive ? FINGER_BG[f.id] : "#cbd5e1"}
                  strokeWidth="1.5"
                  style={{ transition: "fill 0.15s, stroke 0.15s" }}
                />
                <ellipse
                  cx={f.x + f.w / 2} cy={f.y + 10}
                  rx={f.w / 2 - 4} ry="7"
                  fill={isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.5)"}
                />
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
    <div className="flex items-end justify-center gap-3">
      <Hand side="left" />
      <div className="flex flex-col items-center justify-center pb-4 min-w-[72px]">
        {activeFinger ? (
          <div
            className="text-xs font-bold px-2.5 py-1.5 rounded-full text-white text-center leading-tight"
            style={{ background: FINGER_BG[activeFinger] }}
          >
            {FINGER_LABEL[activeFinger]}
          </div>
        ) : (
          <div className="text-[10px] text-gray-300 text-center leading-tight">A S D F<br/>· J K L ;</div>
        )}
      </div>
      <Hand side="right" />
    </div>
  );
}

// ── Keyboard Key ──────────────────────────────────────────────────────────────
function KbKey({
  keyDef, isActive, onClick, lang,
}: {
  keyDef: KeyDef; isActive: boolean; onClick: (ch: string) => void; lang: Language;
}) {
  const isDevanagari = lang !== "english";
  const mainChar  = isDevanagari ? keyDef.np  : keyDef.label.toLowerCase();
  const shiftChar = isDevanagari ? keyDef.npS : keyDef.label.toUpperCase();
  const normalCls = FINGER_KEY_NORMAL[keyDef.finger];
  const activeCls = FINGER_KEY_ACTIVE[keyDef.finger];
  const shadowStyle = isActive
    ? { boxShadow: "none" }
    : { boxShadow: `0 3px 0 #9ca3af, 0 4px 4px rgba(0,0,0,0.10)` };

  return (
    <button
      type="button"
      className={`relative flex flex-col items-center justify-center border-2 rounded-md cursor-pointer select-none transition-all duration-75 w-8 h-9 sm:w-9 sm:h-10 ${isActive ? activeCls : normalCls}`}
      style={shadowStyle}
      onClick={() => onClick(mainChar)}
      title={`${keyDef.label}: ${mainChar}`}
    >
      <span className={`absolute top-0.5 left-1 text-[7px] leading-none ${isActive ? "opacity-70" : "text-gray-400"}`}
        style={isDevanagari ? { fontFamily: "'Noto Sans Devanagari', sans-serif" } : {}}>
        {shiftChar}
      </span>
      <span
        className={`text-[11px] sm:text-xs font-bold leading-none ${isActive ? "text-white" : "text-gray-800"}`}
        style={isDevanagari ? { fontFamily: "'Noto Sans Devanagari', sans-serif" } : {}}
      >
        {mainChar}
      </span>
      <span className={`absolute bottom-0.5 right-1 text-[6px] leading-none font-mono ${isActive ? "opacity-50" : "text-gray-400"}`}>
        {keyDef.label}
      </span>
    </button>
  );
}

function WideKey({
  label, widthClass = "w-10", onClick, isActive = false,
}: { label: string; widthClass?: string; onClick?: () => void; isActive?: boolean }) {
  const shadowStyle = isActive ? { boxShadow: "none" } : { boxShadow: "0 3px 0 #9ca3af, 0 4px 4px rgba(0,0,0,0.10)" };
  return (
    <button
      type="button"
      className={`${widthClass} h-9 sm:h-10 flex items-center justify-center rounded-md border-2 cursor-pointer select-none transition-all duration-75 text-[9px] font-semibold ${
        isActive ? "bg-slate-500 border-slate-700 text-white !shadow-none translate-y-[2px]" : "text-gray-500 bg-slate-50 border-slate-200"
      }`}
      style={shadowStyle}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function VirtualKeyboard({ activeCode, onKeyClick, onBackspace, lang }: {
  activeCode: string | null; onKeyClick: (ch: string) => void; onBackspace: () => void; lang: Language;
}) {
  const isSpaceActive = activeCode === "Space";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5 sm:gap-1 items-end">
        {ROW0.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} lang={lang} />)}
        <WideKey label="⌫" widthClass="w-11 sm:w-12" onClick={onBackspace} />
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end" style={{ paddingLeft: "1rem" }}>
        <WideKey label="Tab" widthClass="w-10 sm:w-11" />
        {ROW1.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} lang={lang} />)}
        <WideKey label="Enter" widthClass="w-11 sm:w-12" />
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end" style={{ paddingLeft: "1.5rem" }}>
        <WideKey label="Caps" widthClass="w-12 sm:w-13" />
        {ROW2.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} lang={lang} />)}
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end" style={{ paddingLeft: "2rem" }}>
        <WideKey label="Shift" widthClass="w-14" />
        {ROW3.map(k => <KbKey key={k.code} keyDef={k} isActive={activeCode === k.code} onClick={onKeyClick} lang={lang} />)}
        <WideKey label="Shift" widthClass="w-12" />
      </div>
      <div className="flex gap-0.5 sm:gap-1 items-end">
        <WideKey label="Ctrl" widthClass="w-9" />
        <WideKey label="Alt"  widthClass="w-9" />
        <WideKey label={lang === "english" ? "Space Bar" : "Space Bar · खाली ठाउँ"} widthClass="w-40 sm:w-48" isActive={isSpaceActive} onClick={() => onKeyClick(" ")} />
        <WideKey label="Alt"  widthClass="w-9" />
        <WideKey label="Ctrl" widthClass="w-9" />
      </div>
    </div>
  );
}

// ── Text Display ──────────────────────────────────────────────────────────────
function TextDisplay({ text, typed, lang }: { text: string; typed: string; lang: Language }) {
  const chars    = useMemo(() => [...text], [text]);
  const typedArr = useMemo(() => [...typed], [typed]);
  const cursorIdx = typedArr.length;
  const isDevanagari = lang !== "english";

  return (
    <div
      className="bg-white border-2 border-gray-100 rounded-2xl px-4 py-4 shadow-sm min-h-[80px] leading-loose select-none"
      style={isDevanagari
        ? { fontFamily: "'Noto Sans Devanagari', 'Noto Serif Devanagari', sans-serif", fontSize: "1.2rem" }
        : { fontFamily: "'Inter', 'Segoe UI', sans-serif", fontSize: "1.15rem" }}
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
              isError   ? "bg-red-100 text-red-500 rounded" : "",
              !isTyped && !isCursor ? "text-gray-700" : "",
            ].join(" ")}
          >
            {ch === " " && isCursor ? "·" : ch}
          </span>
        );
      })}
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
    <div className="max-w-lg mx-auto space-y-5">
      {/* Language */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Language / भाषा / भाषा</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["english", "A B C", "English",  "English Typing"],
            ["nepali",  "नेपाली", "नेपाली",  "Nepali Typing"],
            ["hindi",   "हिन्दी", "हिन्दी",  "Hindi Typing"],
          ] as const).map(([id, script, nativeLabel, engLabel]) => (
            <button key={id} onClick={() => setLanguage(id)}
              className={`p-3 rounded-xl border-2 font-medium transition-all text-center ${
                language === id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:border-blue-200"
              }`}>
              <div
                className="text-xl leading-tight font-bold"
                style={id !== "english" ? { fontFamily: "'Noto Sans Devanagari', sans-serif" } : {}}
              >{script}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{engLabel}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Difficulty / कठिनाई</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["easy",   "Easy",   "green",  "Short simple sentences"],
            ["medium", "Medium", "yellow", "Moderate — good for Lok Sewa prep"],
            ["hard",   "Hard",   "red",    "Exam level — long paragraphs"],
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
              <div className="text-[9px] text-gray-400 leading-tight mt-0.5">{hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Time / समय</label>
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
          title="Finger guide">
          <BookOpen className="w-5 h-5" />
        </button>
      </div>

      {/* Keyboard preview */}
      <div className="pt-1 opacity-50 hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2 text-center flex items-center justify-center gap-1.5">
          <Keyboard className="w-3 h-3" /> Keyboard Layout Preview
        </p>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-max mx-auto">
            <VirtualKeyboard activeCode={null} onKeyClick={() => {}} onBackspace={() => {}} lang={language} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Guide Screen ──────────────────────────────────────────────────────────────
function GuideScreen({ onBack }: { onBack: () => void }) {
  const fingerData: Array<{ id: Finger; name: string; keys: string; nepali: string }> = [
    { id: "LP", name: "Left Pinky",   keys: "Q  A  Z  1  `",      nepali: "ट  ा  ँ  १" },
    { id: "LR", name: "Left Ring",    keys: "W  S  X  2",          nepali: "ठ  स  ं  २" },
    { id: "LM", name: "Left Middle",  keys: "E  D  C  3",          nepali: "ु  द  च  ३" },
    { id: "LI", name: "Left Index",   keys: "R  F  V  T  G  B  4 5", nepali: "र  ्  व  त  ग  ब" },
    { id: "RI", name: "Right Index",  keys: "Y  H  N  U  J  M  6 7", nepali: "य  ह  न  ू  ज  म" },
    { id: "RM", name: "Right Middle", keys: "I  K  ,  8",           nepali: "ि  क  ,  ८" },
    { id: "RR", name: "Right Ring",   keys: "O  L  .  9",           nepali: "ो  ल  ।  ९" },
    { id: "RP", name: "Right Pinky",  keys: "P  ;  /  [  ]  0",    nepali: "प  ः  ्  े  ं  ०" },
    { id: "T",  name: "Both Thumbs",  keys: "Space Bar",            nepali: "खाली ठाउँ" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Keyboard & Finger Guide</h2>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-blue-800 mb-1">🏠 Home Row — यहाँबाट सुरु गर्नुहोस्</h3>
        <p className="text-sm text-blue-700">
          Left hand rests on <strong>A S D F</strong> (ा  स  द  ् ) and right hand on <strong>J K L ;</strong> (ज  क  ल  ः).
          Always return here after pressing any key.
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
        <h3 className="font-bold text-amber-800 mb-2">💡 Pro Tips for Lok Sewa Exam</h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Look at the screen, not the keyboard — builds muscle memory faster</li>
          <li>Accuracy first, speed second — errors reduce your effective WPM score</li>
          <li>Practice 15–20 minutes daily; improvement is visible within 2 weeks</li>
          <li>Use Hard level passages for Lok Sewa and government job exam preparation</li>
          <li>Enable Nepali Unicode: Windows → Settings → Language → Add Nepali · Mac → System Settings → Input Sources</li>
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
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-gray-500 text-sm font-medium">Get ready — तयार हुनुहोस्…</p>
      <div className="text-8xl font-black text-blue-600" style={{ animation: "pulse 0.9s ease-in-out infinite" }}>
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
  const wpmLabel = wpm >= 45 ? "Expert" : wpm >= 35 ? "Proficient" : wpm >= 25 ? "Average" : wpm >= 15 ? "Beginner" : "Novice";
  const loksewaPassed = wpm >= 35 && accuracy >= 90;
  const feedback =
    accuracy >= 95 ? "Excellent! You are ready for Lok Sewa typing exam. 🎉"
    : accuracy >= 85 ? "Great job! A little more practice and you will pass Lok Sewa. 💪"
    : accuracy >= 70 ? "Good progress! Focus on accuracy before speed. 👍"
    : "Keep going! Start with Easy mode and build muscle memory. 📚";

  const langLabel = language === "nepali" ? "Nepali" : language === "hindi" ? "Hindi" : "English";

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center">
        <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
        <h2 className="text-2xl font-black text-gray-900">Your Results</h2>
        <p className="text-gray-500 text-sm">{langLabel} · {difficulty} · {duration < 60 ? `${duration}s` : `${duration / 60} min`}</p>
      </div>

      {/* Lok Sewa pass/fail indicator */}
      <div className={`rounded-xl p-3 text-center text-sm font-bold ${loksewaPassed ? "bg-green-50 border-2 border-green-200 text-green-700" : "bg-amber-50 border-2 border-amber-200 text-amber-700"}`}>
        {loksewaPassed ? "✅ Lok Sewa Typing Exam Level Passed! (35+ WPM, 90%+ Accuracy)" : `📋 Lok Sewa Target: 35 WPM & 90% accuracy — You're at ${wpm} WPM, ${accuracy}%`}
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
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-green-600 text-xs font-bold">✓</span>
          </div>
          <div><div className="text-lg font-black text-gray-800">{correct}</div><div className="text-[10px] text-gray-400">Correct</div></div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <span className="text-red-500 text-xs font-bold">✗</span>
          </div>
          <div><div className="text-lg font-black text-gray-800">{errors}</div><div className="text-[10px] text-gray-400">Errors</div></div>
        </div>
      </div>

      <div className="bg-white border-2 border-gray-100 rounded-xl p-4 text-sm text-gray-600 text-center">{feedback}</div>

      <div className="flex gap-3">
        <button onClick={onRetry} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <button onClick={onSetup} className="flex-1 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:border-blue-200 hover:text-blue-600 transition-all">
          <Settings2 className="w-4 h-4" /> Settings
        </button>
      </div>
    </div>
  );
}

// ── Practice Screen ───────────────────────────────────────────────────────────
function PracticeScreen({
  text, typed, timeLeft, duration, language, onKeyClick, onBackspace,
}: {
  text: string; typed: string; timeLeft: number; duration: Duration; language: Language;
  onKeyClick: (ch: string) => void; onBackspace: () => void;
}) {
  const chars    = useMemo(() => [...text], [text]);
  const typedArr = useMemo(() => [...typed], [typed]);
  const nextChar = chars[typedArr.length];

  const charToKeyMap = language === "english" ? EN_CHAR_TO_KEY : CHAR_TO_KEY;
  const activeKey   = nextChar ? (charToKeyMap[nextChar] ?? null) : null;
  const activeCode  = activeKey?.code ?? null;
  const activeFinger = activeKey?.finger ?? null;

  const elapsed  = Math.max((duration - timeLeft) / 60, 0.001);
  const wpm      = Math.round((typedArr.length / 5) / elapsed);
  const correct  = typedArr.filter((c, i) => c === chars[i]).length;
  const accuracy = typedArr.length > 0 ? Math.round((correct / typedArr.length) * 100) : 100;
  const progress = chars.length > 0 ? Math.round((typedArr.length / chars.length) * 100) : 0;
  const timerPct = (timeLeft / duration) * 100;
  const timerColor = timeLeft > duration * 0.5 ? "#22c55e" : timeLeft > duration * 0.2 ? "#eab308" : "#ef4444";

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {[
          { icon: <Clock className="w-3 h-3" />,  label: "Time",     val: `${timeLeft}s`,    color: "text-blue-600" },
          { icon: <Zap   className="w-3 h-3" />,  label: "WPM",      val: `${wpm}`,          color: "text-purple-600" },
          { icon: <Target className="w-3 h-3" />, label: "Accuracy", val: `${accuracy}%`,    color: "text-green-600" },
          { icon: <span className="text-[9px] font-bold">{progress}%</span>, label: "Done", val: `${typedArr.length}/${chars.length}`, color: "text-gray-600" },
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
            {activeKey.code.replace("Key", "").replace("Digit", "").replace("BracketLeft", "[").replace("BracketRight", "]").replace("Semicolon", ";").replace("Comma", ",").replace("Period", ".").replace("Slash", "/").replace("Backquote", "`").replace("Space", "Space")}
          </kbd>
          <span style={{ color: FINGER_BG[activeKey.finger] }} className="font-semibold">{FINGER_LABEL[activeKey.finger]}</span>
        </div>
      )}

      {/* Hand guide */}
      <div className="flex justify-center">
        <HandGuide activeFinger={activeFinger} />
      </div>

      {/* Keyboard — horizontal scroll on mobile */}
      <div className="overflow-x-auto pb-1 -mx-2 px-2">
        <div className="min-w-[520px] mx-auto">
          <VirtualKeyboard activeCode={activeCode} onKeyClick={onKeyClick} onBackspace={onBackspace} lang={language} />
        </div>
      </div>
      <p className="text-center text-[10px] text-gray-300 sm:hidden">← scroll keyboard →</p>
    </div>
  );
}

// ── SEO Content Section ───────────────────────────────────────────────────────
function SeoSection({ language }: { language: Language }) {
  return (
    <section className="mt-10 border-t border-gray-100 pt-8 space-y-8">
      {/* Main description */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          {language === "english"
            ? "Best Free English Typing Practice Online — Lok Sewa & Government Job Exam Ready"
            : language === "nepali"
            ? "Best Free Nepali Typing Practice — लोकसेवा र सरकारी जागिर परीक्षाको लागि"
            : "Best Free Hindi Typing Practice Online — सरकारी नौकरी टाइपिंग परीक्षा"}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          {language === "english"
            ? "Student Hub's free English typing practice is designed for students and professionals in Nepal preparing for government job exams. Our tool tracks your WPM (words per minute) and accuracy in real time — the exact metrics tested in Lok Sewa Aayog typing tests, banking recruitment, and civil service exams. Passages include government office language and professional English used in real administrative work."
            : language === "nepali"
            ? "Student Hub को नेपाली टाइपिंग अभ्यास उपकरण लोकसेवा आयोगको परीक्षा, सरकारी जागिरको टाइपिंग टेस्ट र विद्यार्थीहरूका लागि विशेष रूपमा तयार गरिएको हो। भर्चुअल किबोर्डले सही औंला राख्ने तरिका देखाउँछ र WPM तथा शुद्धता वास्तविक समयमा ट्र्याक हुन्छ। प्रत्येक दिन १५ मिनेट अभ्यास गर्दा एक महिनामै ३५+ WPM पुग्न सकिन्छ।"
            : "Student Hub का Hindi typing practice tool सरकारी नौकरी परीक्षाओं की तैयारी करने वाले विद्यार्थियों के लिए बनाया गया है। वास्तविक समय में WPM और accuracy track होती है। Lok Sewa, banking और civil service exams में यही metrics जाँची जाती हैं। Devanagari keyboard layout Hindi और Nepali दोनों के लिए same है।"}
        </p>
      </div>

      {/* Use case grid */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">Who Uses This Typing Practice Tool</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              title: "🏛️ Lok Sewa Aayog Aspirants",
              desc: "लोकसेवा आयोगको परीक्षाको लागि तयारी — Nepali and English typing both required. Medium and Hard level passages mirror exam difficulty.",
            },
            {
              title: "💼 Government Job Seekers",
              desc: "सरकारी जागिरको टाइपिंग परीक्षा — 35 WPM in Nepali or English with 90%+ accuracy is the standard benchmark for most positions.",
            },
            {
              title: "🎓 High School & College Students",
              desc: "Class 9–12 and Bachelor's students building foundational typing skills. Daily practice improves academic productivity significantly.",
            },
            {
              title: "🏦 Banking & Office Professionals",
              desc: "Nepal Rastra Bank, commercial banks, and corporate offices all require fast and accurate typing. Our WPM test matches industry standards.",
            },
          ].map(c => (
            <div key={c.title} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="font-bold text-sm text-gray-800 mb-1">{c.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How to improve */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">How to Improve Your Typing Speed Fast</h2>
        <ol className="space-y-2">
          {[
            { n: "1", title: "Start with Easy level", desc: "Build accuracy before speed. Typing accurately at 20 WPM is better than typing fast with errors." },
            { n: "2", title: "Use finger color guide", desc: "Each color on the keyboard shows which finger to use. Follow it — this builds correct muscle memory." },
            { n: "3", title: "Practice 15 min daily", desc: "Consistency beats long sessions. 15 minutes every day for 30 days will double your speed." },
            { n: "4", title: "Move to Medium, then Hard", desc: "Medium level has Lok Sewa-style sentences. Hard level prepares you for real exam conditions." },
            { n: "5", title: "Target 35 WPM, 90% accuracy", desc: "This is the Lok Sewa and government job typing exam standard. Use our results screen to track progress." },
          ].map(s => (
            <li key={s.n} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
              <div>
                <span className="font-semibold text-sm text-gray-800">{s.title} — </span>
                <span className="text-sm text-gray-500">{s.desc}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-3">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {SCHEMA_FAQ.mainEntity.map((qa, i) => (
            <details key={i} className="bg-gray-50 border border-gray-200 rounded-xl group">
              <summary className="px-4 py-3 font-semibold text-sm text-gray-800 cursor-pointer select-none list-none flex items-center justify-between">
                {qa.name}
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="px-4 pb-3 text-sm text-gray-600 leading-relaxed">{qa.acceptedAnswer.text}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          { title: "Free Forever", desc: "No sign-up needed" },
          { title: "3 Languages",  desc: "Nepali · Hindi · English" },
          { title: "Lok Sewa Ready", desc: "Exam-level passages" },
          { title: "Mobile Friendly", desc: "Works on all devices" },
        ].map(f => (
          <div key={f.title} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
            <div className="font-bold text-xs text-gray-800">{f.title}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Cross-links */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="font-bold text-sm text-blue-800 mb-2">Also Practice On Student Hub</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="/tools/nepali-typing">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">नेपाली टाइपिंग अभ्यास</span>
          </Link>
          <Link href="/tools/english-typing">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">English Typing Test</span>
          </Link>
          <Link href="/tools/gpa-calculator">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">GPA Calculator</span>
          </Link>
          <Link href="/tools">
            <span className="text-xs bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-pointer">All Tools →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Meta per language ─────────────────────────────────────────────────────────
function PageMeta({ language }: { language: Language }) {
  if (language === "english") {
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.studenthubnp.com" },
        { "@type": "ListItem", position: 2, name: "Tools", item: "https://www.studenthubnp.com/tools" },
        { "@type": "ListItem", position: 3, name: "English Typing Practice", item: "https://www.studenthubnp.com/tools/english-typing" },
      ],
    };
    return (
      <Helmet>
        <title>English Typing Practice Online Free — Typing Test for Nepal Government Jobs | Lok Sewa | Student Hub</title>
        <meta name="description" content="Best free English typing practice for Nepal. Perfect for Lok Sewa Aayog exam, government job typing test, banking exams. Real-time WPM speed test, accuracy tracking, finger guide. No sign-up. Used by students and job seekers across Nepal." />
        <meta name="keywords" content="english typing practice, english typing test, english typing speed test, typing practice online, lok sewa typing test, government job typing test nepal, english typing for government job, free typing test, wpm test, online typing practice nepal, typing test 30 wpm, typing test 35 wpm, typing tutor online, how to improve typing speed, english typing course free" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta property="og:title" content="Free English Typing Practice — Lok Sewa & Government Job Typing Test | Student Hub" />
        <meta property="og:description" content="Free English typing practice with WPM tracking. Ideal for Lok Sewa Aayog and Nepal government job typing exams. Easy, Medium, Hard levels. No sign-up." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/tools/english-typing" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Free English Typing Test — Nepal Government Job Exam | Student Hub" />
        <meta name="twitter:description" content="Practice English typing for Lok Sewa and government job exams. WPM test, accuracy tracking, virtual keyboard. Free, no sign-up." />
        <link rel="canonical" href="https://www.studenthubnp.com/tools/english-typing" />
        <link rel="alternate" href="https://www.studenthubnp.com/tools/nepali-typing" hrefLang="ne" />
        <link rel="alternate" href="https://www.studenthubnp.com/tools/english-typing" hrefLang="en" />
        <script type="application/ld+json">{JSON.stringify(SCHEMA_APP)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_FAQ)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_HOWTO)}</script>
      </Helmet>
    );
  }

  if (language === "hindi") {
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.studenthubnp.com" },
        { "@type": "ListItem", position: 2, name: "Tools", item: "https://www.studenthubnp.com/tools" },
        { "@type": "ListItem", position: 3, name: "Hindi Typing Practice", item: "https://www.studenthubnp.com/tools/nepali-typing" },
      ],
    };
    return (
      <Helmet>
        <title>Hindi Typing Practice Online Free — हिंदी टाइपिंग अभ्यास | WPM Test | Student Hub</title>
        <meta name="description" content="Free Hindi typing practice online. हिंदी टाइपिंग अभ्यास with Devanagari virtual keyboard, hand guide, real-time WPM and accuracy tracking. Easy Medium Hard levels. Government job and Lok Sewa exam preparation. No sign-up required." />
        <meta name="keywords" content="hindi typing practice, hindi typing online, hindi typing test, hindi typing speed test, हिंदी टाइपिंग, हिंदी टाइपिंग अभ्यास, devanagari typing practice, hindi typing tutor, online hindi keyboard, type in hindi online, hindi typing for government job, hindi typing wpm test, free hindi typing practice, learn hindi typing" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <meta property="og:title" content="Free Hindi Typing Practice Online — हिंदी टाइपिंग | WPM Test | Student Hub" />
        <meta property="og:description" content="Best free Hindi typing practice. Devanagari keyboard with hand guide, WPM tracker, Easy/Medium/Hard levels. No sign-up. Works on all devices." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/tools/nepali-typing" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <link rel="canonical" href="https://www.studenthubnp.com/tools/nepali-typing" />
        <script type="application/ld+json">{JSON.stringify(SCHEMA_APP)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
        <script type="application/ld+json">{JSON.stringify(SCHEMA_FAQ)}</script>
      </Helmet>
    );
  }

  // Nepali (default)
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",  item: "https://www.studenthubnp.com" },
      { "@type": "ListItem", position: 2, name: "Tools", item: "https://www.studenthubnp.com/tools" },
      { "@type": "ListItem", position: 3, name: "Nepali Typing Practice", item: "https://www.studenthubnp.com/tools/nepali-typing" },
    ],
  };
  return (
    <Helmet>
      <title>Nepali Typing Practice Online Free — नेपाली टाइपिंग अभ्यास | Lok Sewa Typing Test | Student Hub</title>
      <meta name="description" content="Best free Nepali typing practice online. नेपाली टाइपिंग अभ्यास with virtual Devanagari keyboard, finger placement guide, real-time WPM and accuracy tracking. Perfect for Lok Sewa Aayog exam, government job typing test. Easy, Medium, Hard levels. लोकसेवा टाइपिंग परीक्षा तयारी। No sign-up required." />
      <meta name="keywords" content="nepali typing practice, nepali typing online, nepali typing test, नेपाली टाइपिंग, नेपाली टाइपिंग अभ्यास, lok sewa typing test, lokshewa typing practice, लोकसेवा टाइपिंग, government job typing test nepal, sarkari jagir typing test, nepali typing tutor, nepali typing speed test, nepali wpm test, online nepali keyboard, type in nepali online, nepali unicode typing, devanagari typing practice, nepali typing for beginners, how to type in nepali, nepali keyboard layout, free nepali typing practice, learn nepali typing fast" />
      <meta name="robots" content="index, follow, max-image-preview:large" />
      <meta name="author" content="Student Hub Nepal" />
      <meta property="og:title" content="Nepali Typing Practice Online Free — नेपाली टाइपिंग | Lok Sewa Exam Prep | Student Hub" />
      <meta property="og:description" content="Best free Nepali typing practice. Virtual Devanagari keyboard, hand guide, WPM tracker, Easy/Medium/Hard. Perfect for Lok Sewa Aayog typing exam. No sign-up." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://www.studenthubnp.com/tools/nepali-typing" />
      <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
      <meta property="og:locale" content="ne_NP" />
      <meta property="og:locale:alternate" content="hi_IN" />
      <meta property="og:locale:alternate" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Free Nepali Typing Practice — Lok Sewa Exam | Student Hub" />
      <meta name="twitter:description" content="Best free Nepali typing tutor. Virtual keyboard, hand guide, WPM test. Perfect for Lok Sewa exam prep. No sign-up needed." />
      <link rel="canonical" href="https://www.studenthubnp.com/tools/nepali-typing" />
      <link rel="alternate" hrefLang="ne" href="https://www.studenthubnp.com/tools/nepali-typing" />
      <link rel="alternate" hrefLang="hi" href="https://www.studenthubnp.com/tools/nepali-typing" />
      <link rel="alternate" hrefLang="en" href="https://www.studenthubnp.com/tools/english-typing" />
      <link rel="alternate" hrefLang="x-default" href="https://www.studenthubnp.com/tools/nepali-typing" />
      <script type="application/ld+json">{JSON.stringify(SCHEMA_APP)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      <script type="application/ld+json">{JSON.stringify(SCHEMA_FAQ)}</script>
      <script type="application/ld+json">{JSON.stringify(SCHEMA_HOWTO)}</script>
    </Helmet>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NepaliTyping() {
  const [location] = useLocation();
  const isEnglishRoute = location.includes("english-typing");

  const [phase,      setPhase]      = useState<Phase>("setup");
  const [language,   setLanguage]   = useState<Language>(isEnglishRoute ? "english" : "nepali");
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
  phaseRef.current = phase;
  langRef.current  = language;
  textRef.current  = text;

  const pickText = useCallback((lang: Language, diff: Difficulty) => {
    const pool = TEXTS[lang][diff];
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const startPractice = useCallback(() => {
    const t = pickText(language, difficulty);
    setText(t);
    setTyped("");
    setTimeLeft(duration);
    setCountdown(3);
    setPhase("countdown");
  }, [language, difficulty, duration, pickText]);

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
    const chars    = [...text];
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

  // Physical keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (phaseRef.current !== "practice") return;

    if (e.code === "Backspace") {
      setTyped(p => [...p].slice(0, -1).join(""));
      return;
    }

    if (langRef.current === "english") {
      // English: use e.key directly
      if (e.code === "Space") {
        setTyped(p => {
          const chars = [...textRef.current];
          if ([...p].length >= chars.length) return p;
          return p + " ";
        });
        return;
      }
      if (e.key && e.key.length === 1) {
        setTyped(p => {
          const chars = [...textRef.current];
          if ([...p].length >= chars.length) return p;
          return p + e.key;
        });
      }
    } else {
      // Nepali / Hindi: Devanagari map
      if (e.code === "Space") {
        setTyped(p => {
          const chars = [...textRef.current];
          if ([...p].length >= chars.length) return p;
          return p + " ";
        });
        return;
      }
      const ch = e.shiftKey ? CODE_TO_NPS[e.code] : CODE_TO_NP[e.code];
      if (ch) {
        setTyped(p => {
          const chars = [...textRef.current];
          if ([...p].length >= chars.length) return p;
          return p + ch;
        });
      }
    }
  }, []);

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

  const handleAreaClick = useCallback(() => {
    if (phase === "practice") hiddenInputRef.current?.focus();
  }, [phase]);

  const pageTitle =
    language === "english" ? "English Typing Practice"
    : language === "hindi"  ? "Hindi Typing Practice — हिंदी टाइपिंग"
    : "Nepali Typing Practice — नेपाली टाइपिंग";

  const pageSubtitle =
    language === "english"
      ? "English · Lok Sewa & Government Job · WPM Test · Free"
      : language === "hindi"
      ? "हिन्दी · Devanagari · Virtual Keyboard · WPM Test · Free"
      : "नेपाली · लोकसेवा परीक्षा · Virtual Keyboard · WPM Test · Free";

  return (
    <>
      <PageMeta language={language} />

      {/* Hidden input for physical keyboard capture */}
      <input
        ref={hiddenInputRef}
        className="sr-only"
        onKeyDown={handleKeyDown}
        readOnly
        value=""
        tabIndex={phase === "practice" ? 0 : -1}
        aria-label="Typing input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 pb-16" onClick={handleAreaClick}>
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <Link href="/tools">
              <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors mb-2 font-semibold uppercase tracking-wide" type="button">
                <ArrowLeft className="w-3.5 h-3.5" /> All Tools
              </button>
            </Link>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 leading-tight">
              {pageTitle}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{pageSubtitle}</p>
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

        {/* SEO content — visible on setup screen only */}
        {phase === "setup" && <SeoSection language={language} />}
      </div>
    </>
  );
}
