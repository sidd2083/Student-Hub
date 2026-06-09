import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Minus, X, CheckCircle, XCircle } from "lucide-react";

export type PukuEmotion = "happy" | "relaxed" | "focused" | "concerned" | "frustrated" | "proud" | "excited";

interface Props {
  firstName: string;
  grade?: number;
  isStudying: boolean;
  isBreak: boolean;
  studyMins: number;
  onLeave?: () => void;
  visible: boolean;
  onSpeechUpdate: (speech: string, isSpeaking: boolean) => void;
  onMinimizeChange?: (minimized: boolean) => void;
  onEmotionChange?: (emotion: PukuEmotion) => void;
  onFocusPause?: () => void;
  onFocusResume?: () => void;
}

function stripForSpeech(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uFE00-\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  for (const name of [
    "Microsoft Aria Online (Natural)", "Microsoft Jenny Online (Natural)",
    "Google US English", "Samantha", "Karen", "Moira", "Tessa",
  ]) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  return voices.find(v => v.lang === "en-US") ?? voices.find(v => v.lang.startsWith("en")) ?? voices[0] ?? null;
}

function timePart() {
  const h = new Date().getHours();
  if (h < 5)  return "late night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Grade label helper ───────────────────────────────────────────────────────
function gradeContext(grade?: number): string {
  if (!grade) return "";
  if (grade === 9)  return "grade9";
  if (grade === 10) return "grade10";
  if (grade === 11) return "grade11";
  if (grade === 12) return "grade12";
  if (grade === 13) return "cee";
  if (grade === 14) return "ioe";
  if (grade === 15) return "bachelors";
  return "";
}

// ── Massive grade-personalized message bank ──────────────────────────────────
const MSG = {

  greet: (fn: string, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Hey ${fn}! Puku here, your study buddy. Just us today — let's make it count.`,
      `${fn}! You showed up. That already puts you ahead. Ready?`,
      `${fn}, ${timePart()} session — let's go. I'll be right here with you.`,
      `Hey ${fn}! Been waiting for you. Let's make this one of those good sessions.`,
    ];
    const specific: Record<string, string[]> = {
      grade9:   [`${fn}! Grade 9 is where good habits start. Let's build one right now.`, `Welcome ${fn} — early practice makes everything easier later. Let's focus.`],
      grade10:  [`${fn}! SEE is closer than you think. Let's use this time well.`, `${fn}, this is your SEE prep time. Let's not waste a minute of it.`],
      grade11:  [`${fn}! +2 is a fresh start — let's make your first sessions count.`, `Hey ${fn}, welcome to the big leagues. Let's focus and get ahead.`],
      grade12:  [`${fn}! Board exam season. Every session this year matters. Let's go.`, `${fn}, you're in the final stretch. Let's make this session a good one.`],
      cee:      [`${fn}! Medical entrance prep is intense. I'm here with you — let's focus.`, `${fn}, every session brings you closer to that CEE seat. Let's lock in.`],
      ioe:      [`${fn}! IOE prep session — engineering entrance rewards the consistent. Let's start.`, `${fn}, here to crush some IOE prep? Let's do this properly.`],
      bachelors:[`${fn}! Small progress every day beats last-minute panic. Ready?`, `${fn}, consistent daily study is the bachelor's student's superpower. Let's go.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  studyStart: (fn: string, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Let's lock in, ${fn}. Timer's running — this is your time.`,
      `Focus mode on. Just you and the material. I'm right here.`,
      `Okay ${fn}, phone down, books open. Let's go.`,
      `Clock's ticking. Give it everything you've got.`,
      `This session counts. Make it mean something.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`SEE prep starts now. One session at a time.`, `Let's get some SEE-level material done, ${fn}.`],
      grade12:  [`Board exam prep in session. Focus.`, `${fn}, imagine how good you'll feel at the end of this. Let's start.`],
      cee:      [`CEE entrance is waiting. This session is your investment.`, `Medical entrance needs this kind of focus, ${fn}. Let's go.`],
      ioe:      [`IOE prep mode on. Engineering doesn't wait.`, `Every minute of focused IOE prep pays off. Let's start.`],
      bachelors:[`Consistent progress. That's what today's about.`, `Bachelor's life: study now, enjoy later. Let's go.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  breakStart: (fn: string) => pick([
    `Break time! Step away, stretch a little. You earned it.`,
    `${fn}, real break — don't peek at study material. Let your brain reset.`,
    `Rest mode. Walk around, drink water, look outside. Back soon!`,
    `You worked hard — rest properly. No doom-scrolling though. Just breathe.`,
    `Good time to grab some water and relax your eyes.`,
  ]),

  milestone5: (fn: string) => pick([
    `Five minutes down, ${fn}! The hardest part is always starting — you already crushed it.`,
    `${fn}, five minutes in. You showed up and stayed. Keep going!`,
    `Nice start. Five minutes is still five minutes. Build on it.`,
  ]),

  milestone15: (fn: string) => pick([
    `Fifteen minutes, ${fn}. You're locked in now — don't break this flow.`,
    `${fn}, 15 minutes of real work done. You're in the zone. Stay there.`,
    `Quarter hour. Nice.`,
  ]),

  milestone30: (fn: string, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${fn}, thirty minutes. Genuinely impressive — I mean that.`,
      `Half an hour! Your future self is already grateful.`,
      `Thirty minutes of solid focus. That's what it looks like.`,
    ];
    const specific: Record<string, string[]> = {
      cee:   [`${fn}, 30 focused minutes of CEE prep. That's real progress.`],
      ioe:   [`Half an hour of IOE prep, ${fn}. Respect.`],
      grade12:[`30 minutes down. Board exam prep is happening.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone60: (fn: string, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `One full hour, ${fn}. That is exceptional.`,
      `${fn}! One hour! You're built for this. Keep going.`,
      `Sixty minutes of focus. Most students never get here. You did.`,
    ];
    const specific: Record<string, string[]> = {
      cee:   [`One hour of CEE prep, ${fn}. You're serious about this. It shows.`],
      ioe:   [`An hour of IOE grind, ${fn}. This is what it takes.`],
      grade12:[`An hour in. Board toppers study like this. That's you right now.`],
      bachelors:[`An hour already. You're one of the consistent ones, ${fn}.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone90: (fn: string) => pick([
    `${fn}, ninety minutes. You are genuinely built differently.`,
    `90 minutes of focus. That's elite. Don't stop now.`,
    `Ninety minutes, ${fn}. I'm honestly proud of you.`,
  ]),

  milestone120: (fn: string) => pick([
    `Two hours, ${fn}. Two full hours. Your future self will remember this session.`,
    `${fn}! Two hours! I've been here with you the whole time. Truly impressive.`,
    `Two hours of real study. You're doing something most people only talk about.`,
  ]),

  midSession: (fn: string, m: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${m} minutes in and still going, ${fn}. That's what I like to see.`,
      `Nice pace, ${fn}. Keep it exactly like this.`,
      `${fn}, you're past the hard part now. It gets easier from here.`,
      `Still focused. Good. Don't break it.`,
      `${fn}, you're doing the work other students skip. Remember that.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`${m} minutes of SEE prep. You're ahead of most right now, ${fn}.`],
      grade12:  [`${m} minutes of board prep. This is exactly what the top scorers do.`],
      cee:      [`${m} minutes of focused CEE prep, ${fn}. This is the difference-maker.`],
      ioe:      [`${m} minutes in. IOE entrance is about this kind of consistency.`],
      bachelors:[`${m} minutes down, ${fn}. Small daily progress adds up fast.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  longSession: (fn: string, m: number) => pick([
    `${fn}, ${m} minutes. That is serious dedication.`,
    `${m} minutes in, ${fn}. The people who top their class do exactly this.`,
    `${fn}! ${m} minutes. I won't lie — most people can't sit this long. You're different.`,
    `${m} minutes of real work. Be proud of that, ${fn}.`,
  ]),

  water: (fn: string) => pick([
    `Quick water break, ${fn}? Your brain is 75% water.`,
    `Hey — when did you last drink water? Go grab some. I'll wait.`,
    `Hydration check! A glass of water will actually help you focus better.`,
    `${fn}, water. Non-negotiable. Go drink something now.`,
    `Small reminder: water. Two minutes. Worth it.`,
  ]),

  health: () => pick([
    `Quick tip — relax your shoulders right now. You've been hunched.`,
    `Look away from the screen for 20 seconds. Your eyes need the rest.`,
    `Sit up straight for a second. Good posture actually helps you think.`,
    `Take three deep breaths. Seriously — it resets your focus.`,
    `Stand up and stretch for just 30 seconds. Your back will thank you.`,
    `Blink a few times. Staring at screens reduces blinking — rest your eyes.`,
  ]),

  encouragement: (fn: string, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${fn}, you're doing better than you think.`,
      `One page at a time. Don't look at everything at once.`,
      `${fn}, the fact that you're here studying right now matters. Don't forget that.`,
      `Every minute here is compounding. Future you is grateful.`,
      `${fn}, I've been watching — you're more focused than you give yourself credit for.`,
      `Write it down if you're stuck. Pen on paper does something to your brain.`,
      `${fn}, try explaining what you just read out loud. Sounds silly. It works.`,
      `NEB toppers didn't have superpowers. They just showed up — like you're doing now.`,
      `Boring topics are part of it, ${fn}. Push through. It gets easier.`,
    ];
    const specific: Record<string, string[]> = {
      grade9:   [`Grade 9 is early, ${fn}. The habits you build now will carry you through Grade 12 and beyond.`],
      grade10:  [`${fn}, SEE preparation becomes easier when you're consistent. This is how you build that.`, `Every SEE practice session is practice for the real thing, ${fn}.`],
      grade11:  [`${fn}, +2 is tough but manageable. Just don't fall behind. You're not behind.`],
      grade12:  [`${fn}, the students who don't panic on exam day are the ones who did exactly this.`, `Board exams reward the consistent, ${fn}. This is your consistency.`],
      cee:      [`${fn}, every focused session gets you closer to that medical entrance seat.`, `CEE is competitive, ${fn}. But so are you. Keep going.`],
      ioe:      [`${fn}, engineering entrance rewards consistency over cramming. You're doing it right.`, `IOE toppers study like this, ${fn}. Consistent. Patient. Focused.`],
      bachelors:[`${fn}, small progress every day beats last-minute panic. You're living proof.`, `Bachelor's is a marathon, ${fn}. Pace matters more than sprints.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  humor: (fn: string) => pick([
    `${fn}, your phone is probably boring. I promise.`,
    `Fun fact: you've been more productive in this session than most people manage all day.`,
    `${fn}, the ${timePart()} study session is lowkey the most underrated.`,
    `Your future self just sent a message. It says "thank you."`,
    `${fn}, you're doing the thing people say they'll do "later." Respect.`,
  ]),

  comeBack: (fn: string, mins: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${fn}, still studying?`,
      `You've been away for ${mins} minutes, ${fn}. Still with me?`,
      `Hey — ${mins} minutes outside. Everything okay, ${fn}?`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`${fn}, ${mins} minutes away from your SEE prep. Still studying?`],
      grade12:  [`${fn}, ${mins} minutes away. Board prep doesn't stop — come back when you're ready.`],
      cee:      [`${fn}, ${mins} minutes away from your CEE prep. Your seat won't wait. Still studying?`],
      ioe:      [`${fn}, ${mins} minutes away. IOE prep in progress — coming back?`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  frustrated: (fn: string) => pick([
    `${fn}, this keeps happening. Let's break the pattern right now.`,
    `Hey — I know it's tough to stay focused. But you came here to study. Let's try again.`,
    `${fn}, every time you come back, it still counts. Let's lock back in.`,
    `Distraction is normal. Coming back is what matters. Come back, ${fn}.`,
  ]),

  sessionComplete: (fn: string, mins: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${fn}, great work today. ${mins} minutes of real study. Be proud of that.`,
      `Session done! ${mins} minutes, ${fn}. That's genuinely impressive.`,
      `Good work today, ${fn}. ${mins} minutes. Rest well — you earned it.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`${fn}, ${mins} minutes of SEE prep done. That's what top scorers do.`],
      grade12:  [`${fn}, ${mins} minutes of board prep. Your exam day self will thank you.`],
      cee:      [`${fn}, ${mins} minutes of CEE prep. Every session like this gets you closer.`],
      ioe:      [`IOE grind: ${mins} minutes, ${fn}. Consistent. Excellent.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  bye: (fn: string) => pick([
    `${fn}, looks like someone joined. I'll give you your space. You've been great today.`,
    `Another student's here — my work is done. Good luck, ${fn}!`,
    `Company's arrived! I'll step back. You did well today, ${fn}.`,
  ]),

  inactivityCheck: (fn: string, count: number) => {
    if (count === 1) return pick([
      `Still with me, ${fn}?`,
      `Hey ${fn} — still studying?`,
      `Just checking in. You still here?`,
      `${fn}, still going?`,
      `Everything okay over there, ${fn}?`,
    ]);
    if (count === 2) return pick([
      `${fn}, you've been quiet for a while.`,
      `Haven't heard from you in a bit, ${fn}.`,
      `${fn}... still there?`,
      `You've gone quiet, ${fn}. Still focused?`,
      `It's been a while, ${fn}. You with me?`,
    ]);
    return pick([
      `${fn}, should I pause the timer?`,
      `Want me to pause while you sort things out, ${fn}?`,
      `${fn}, I'm going to pause soon if you don't respond.`,
      `Still there, ${fn}? One more check before I pause.`,
      `${fn}, last call before I pause the timer.`,
    ]);
  },

  inactivityAutoPause: (fn: string) => pick([
    `No response, ${fn}. I'm pausing your study time.`,
    `You haven't responded. Pausing the timer — come back when you're ready.`,
    `I think you've left, ${fn}. Pausing. Come back and we'll pick this up.`,
    `No response for a while. I'm pausing. You can resume when you're back.`,
  ]),

  lockedIn: (fn: string, mins: number) => {
    if (mins <= 25) return pick([
      `${fn}, you're locked in today. Keep going.`,
      `Twenty minutes of solid focus, ${fn}. Don't break it now.`,
      `You're in the zone right now. This is exactly what progress looks like.`,
      `${fn}, this kind of session is what moves the needle. Stay in it.`,
      `Nice. You're finding your rhythm, ${fn}. Keep moving forward.`,
    ]);
    return pick([
      `${fn}, this is some serious focus. Forty-five minutes in.`,
      `${fn}, you've been locked in for a while. The effort is showing.`,
      `This is what real preparation looks like, ${fn}. Genuinely proud of this.`,
      `${fn}, most students never get this deep into a session. You did.`,
      `Forty-five minutes. That's not easy. You're building something real here, ${fn}.`,
    ]);
  },

  comeback: (fn: string) => pick([
    `Welcome back, ${fn}. Let's finish this properly.`,
    `Good to have you back. Let's pick up where we left off.`,
    `${fn}, you're back. Ready to lock in again?`,
    `Back at it, ${fn}. Let's make the rest of this count.`,
    `There you are. Let's not waste the momentum you already built.`,
  ]),
};

// ── OS notification helper ───────────────────────────────────────────────────
function sendOsNotif(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "puku-companion",
      silent: true,
    });
    setTimeout(() => n.close(), 10_000);
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
}

// ── Main component ────────────────────────────────────────────────────────────
export function PukuPartner({
  firstName, grade, isStudying, isBreak, studyMins, onLeave, visible,
  onSpeechUpdate, onMinimizeChange, onEmotionChange, onFocusPause, onFocusResume,
}: Props) {
  const [minimized,     setMinimized]     = useState(false);
  const [muted,         setMuted]         = useState(false);
  const [emotion,       setEmotion]       = useState<PukuEmotion>("happy");
  const [distractPopup, setDistractPopup] = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [idleCheckMsg,  setIdleCheckMsg]  = useState("Still with me?");

  const fn = firstName.split(" ")[0];

  const muteRef         = useRef(muted);
  const speechCbRef     = useRef(onSpeechUpdate);
  const emotionCbRef    = useRef(onEmotionChange);
  const pauseCbRef      = useRef(onFocusPause);
  const resumeCbRef     = useRef(onFocusResume);
  const bubbleClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midSessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osNotifTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupAutoTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedVoiceRef  = useRef<SpeechSynthesisVoice | null>(null);
  const voicesReadyRef  = useRef(false);

  useEffect(() => { muteRef.current = muted; }, [muted]);
  useEffect(() => { speechCbRef.current = onSpeechUpdate; }, [onSpeechUpdate]);
  useEffect(() => { emotionCbRef.current = onEmotionChange; }, [onEmotionChange]);
  useEffect(() => { pauseCbRef.current = onFocusPause; }, [onFocusPause]);
  useEffect(() => { resumeCbRef.current = onFocusResume; }, [onFocusResume]);
  useEffect(() => { distractPopupRef.current = distractPopup; }, [distractPopup]);

  const hasGreeted    = useRef(false);
  const prevStudying  = useRef(false);
  const prevBreak     = useRef(false);
  const milestones    = useRef<Set<number>>(new Set());
  const tabHiddenAt   = useRef<number | null>(null);
  const distractCount = useRef(0);
  const lastWarnedAt  = useRef(0);
  const wasBye        = useRef(false);
  const lastHealthAt  = useRef(0);

  // ── Activity confidence tracking ──────────────────────────────────────────
  const lastActivityRef          = useRef<number>(Date.now());
  const idleCheckCountRef        = useRef<number>(0);   // consecutive ignored checks
  const lastConfirmedStudyingAt  = useRef<number>(0);   // when user last clicked "Yes, studying"
  const distractPopupRef         = useRef<boolean>(false); // mirror of distractPopup for timers

  const setEmotionBoth = useCallback((e: PukuEmotion) => {
    setEmotion(e);
    emotionCbRef.current?.(e);
  }, []);

  // ── Pre-warm TTS voices ────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        cachedVoiceRef.current = pickVoice(voices);
        voicesReadyRef.current = true;
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // ── speak — stable ────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
    const hasTTS = !muteRef.current && !!window.speechSynthesis;
    speechCbRef.current(text, hasTTS);

    if (!hasTTS) {
      bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 7_000);
      return;
    }

    window.speechSynthesis.cancel();
    const clean = stripForSpeech(text);
    if (!clean) {
      bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 7_000);
      return;
    }

    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate   = 0.88 + Math.random() * 0.08;
    utt.pitch  = 1.0  + Math.random() * 0.10;
    utt.volume = 0.92;

    const doSpeak = () => {
      const v = cachedVoiceRef.current ?? pickVoice(window.speechSynthesis.getVoices());
      if (v) utt.voice = v;
      utt.onend = () => {
        if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
        speechCbRef.current("", false);
      };
      utt.onerror = () => {
        if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
        speechCbRef.current(text, false);
        bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 5_000);
      };
      window.speechSynthesis.speak(utt);
    };

    bubbleClearTimer.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      speechCbRef.current("", false);
    }, 20_000);

    if (voicesReadyRef.current || window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        cachedVoiceRef.current = pickVoice(window.speechSynthesis.getVoices());
        voicesReadyRef.current = true;
        doSpeak();
      }, { once: true });
    }
  }, []);

  // ── Activity tracking (on-page idle confidence) ───────────────────────────
  // Any real interaction resets the idle clock. We track silently.
  useEffect(() => {
    if (!visible) return;
    const touch = () => { lastActivityRef.current = Date.now(); };
    const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    EVENTS.forEach(ev => window.addEventListener(ev, touch, { passive: true }));
    return () => EVENTS.forEach(ev => window.removeEventListener(ev, touch));
  }, [visible]);

  // ── Greeting (once) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || hasGreeted.current) return;
    hasGreeted.current = true;
    setEmotionBoth("excited");
    const t = setTimeout(() => {
      speak(MSG.greet(fn, grade));
      setTimeout(() => setEmotionBoth("happy"), 4000);
    }, 1200);
    return () => clearTimeout(t);
  }, [visible, fn, grade, speak, setEmotionBoth]);

  // ── Study / break transitions ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isStudying && !prevStudying.current) {
      setEmotionBoth("focused");
      speak(MSG.studyStart(fn, grade));
    } else if (isBreak && !prevBreak.current) {
      setEmotionBoth("relaxed");
      speak(MSG.breakStart(fn));
    }
    prevStudying.current = isStudying;
    prevBreak.current    = isBreak;
  }, [isStudying, isBreak, visible, fn, grade, speak, setEmotionBoth]);

  // ── On-page idle detection with progressive escalation ────────────────────
  // Students reading silently shouldn't be flagged too early. First check at
  // 6–9 minutes. If the popup is ignored, PUKU escalates: friendly → concerned →
  // serious → auto-pause. Resets completely when user confirms "Yes, studying".
  useEffect(() => {
    if (!visible) return;

    // Called every 90s when popup is already showing but still being ignored
    const doEscalate = () => {
      if (!distractPopupRef.current) return; // user dismissed — stop cascade

      idleCheckCountRef.current = Math.min(idleCheckCountRef.current + 1, 4);

      if (idleCheckCountRef.current >= 4) {
        // Auto-pause after 3 consecutive ignored checks
        setDistractPopup(false);
        setIsPaused(true);
        pauseCbRef.current?.();
        setEmotionBoth("frustrated");
        speak(MSG.inactivityAutoPause(fn));
        idleCheckCountRef.current = 0;
        return;
      }

      const nextMsg = MSG.inactivityCheck(fn, idleCheckCountRef.current);
      setIdleCheckMsg(nextMsg);
      speak(nextMsg);
      if (idleCheckCountRef.current >= 3) setEmotionBoth("frustrated");
      else setEmotionBoth("concerned");

      if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
      popupAutoTimer.current = setTimeout(doEscalate, 90_000);
    };

    // Poll every 30 s: fire first check after 6–9 min of on-page inactivity
    const intervalId = setInterval(() => {
      if (!isStudying || isPaused) return;
      if (document.hidden) return; // tab-away handles off-tab case
      if (distractPopupRef.current) return; // popup already visible

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 6 * 60_000) return; // under 6 min — likely reading

      // Cool-down: don't re-fire within 8 min of user confirming "yes"
      if (Date.now() - lastConfirmedStudyingAt.current < 8 * 60_000) return;

      // First check — always friendly
      idleCheckCountRef.current = 1;
      const msg = MSG.inactivityCheck(fn, 1);
      setIdleCheckMsg(msg);
      setEmotionBoth("happy");
      setDistractPopup(true);
      speak(msg);

      if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
      popupAutoTimer.current = setTimeout(doEscalate, 90_000);
    }, 30_000);

    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isStudying, isPaused, fn]); // uses refs for mutable state — intentional

  // ── Milestones ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const checks: [number, (fn: string, grade?: number) => string, PukuEmotion][] = [
      [5,   MSG.milestone5,   "happy"],
      [15,  MSG.milestone15,  "happy"],
      [20,  (f) => MSG.lockedIn(f, 20), "focused"],
      [30,  MSG.milestone30,  "proud"],
      [45,  (f) => MSG.lockedIn(f, 45), "focused"],
      [60,  MSG.milestone60,  "proud"],
      [90,  MSG.milestone90,  "excited"],
      [120, MSG.milestone120, "excited"],
    ];
    for (const [mins, msgFn, em] of checks) {
      if (studyMins >= mins && !milestones.current.has(mins)) {
        milestones.current.add(mins);
        setEmotionBoth(em);
        speak(msgFn(fn, grade));
        setTimeout(() => setEmotionBoth("focused"), 6000);
        return;
      }
    }
  }, [studyMins, visible, fn, grade, speak, setEmotionBoth]);

  // ── Mid-session encouragement (sparse — not spam) ────────────────────────
  // Only fires once every 15–25 minutes. Uses a pool that mixes encouragement,
  // light humour, and grade-relevant tips.
  useEffect(() => {
    if (!visible) return;

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const delay = (15 + Math.random() * 10) * 60_000; // 15–25 min
      return setTimeout(() => {
        if (isStudying && !isPaused) {
          const roll = Math.random();
          if (roll < 0.5) {
            speak(MSG.encouragement(fn, grade));
          } else if (roll < 0.7) {
            speak(MSG.humor(fn));
          } else if (studyMins > 20) {
            speak(MSG.midSession(fn, studyMins, grade));
          } else {
            speak(MSG.encouragement(fn, grade));
          }
        }
        midSessionTimer.current = scheduleNext();
      }, delay);
    };

    midSessionTimer.current = scheduleNext();
    return () => { if (midSessionTimer.current) clearTimeout(midSessionTimer.current); };
  }, [visible, fn, grade]); // intentionally minimal deps — uses stale-ref pattern

  // ── Health reminders — very occasional (every 40–60 min) ─────────────────
  useEffect(() => {
    if (!visible) return;

    const scheduleHealth = (): ReturnType<typeof setTimeout> => {
      const delay = (40 + Math.random() * 20) * 60_000; // 40–60 min
      return setTimeout(() => {
        if (isStudying) {
          const now = Date.now();
          // Alternate: water or a body health tip
          if (now - lastHealthAt.current > 35 * 60_000) {
            lastHealthAt.current = now;
            speak(Math.random() < 0.5 ? MSG.water(fn) : MSG.health());
          }
        }
        healthTimer.current = scheduleHealth();
      }, delay);
    };

    healthTimer.current = scheduleHealth();
    return () => { if (healthTimer.current) clearTimeout(healthTimer.current); };
  }, [visible, fn]);

  // ── Browser notification permission ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [visible]);

  // ── Anti-cheat: tab-away detection ───────────────────────────────────────
  // Warns ONLY after 5 full minutes away (not 30 seconds).
  // Shows a YES/NO popup. If ignored for 60s → auto-pause.
  // After confirming "Yes", cooldown of 15 min before next warning.
  useEffect(() => {
    if (!visible) return;

    const onVis = () => {
      if (document.hidden) {
        if (!isStudying) return;
        tabHiddenAt.current = Date.now();

        // OS notification fires after 5 minutes away — only once
        if (osNotifTimer.current) clearTimeout(osNotifTimer.current);
        osNotifTimer.current = setTimeout(() => {
          if (!document.hidden) return;
          const now = Date.now();
          if (now - lastWarnedAt.current < 15 * 60_000) return; // respect cooldown
          sendOsNotif(`Still studying, ${fn}?`, "You've been away for 5 minutes. Come back when you're ready.");
        }, 5 * 60_000);

      } else {
        if (osNotifTimer.current) { clearTimeout(osNotifTimer.current); osNotifTimer.current = null; }

        const at = tabHiddenAt.current;
        tabHiddenAt.current = null;
        if (!at || !isStudying) return;

        const secsAway = Math.round((Date.now() - at) / 1_000);
        if (secsAway < 5 * 60) return; // only warn after 5 full minutes

        const now = Date.now();
        if (now - lastWarnedAt.current < 15 * 60_000) return; // cooldown after "yes"

        const minsAway = Math.max(1, Math.round(secsAway / 60));
        distractCount.current += 1;

        // Update emotion based on distraction count
        if (distractCount.current >= 3) setEmotionBoth("frustrated");
        else if (distractCount.current >= 2) setEmotionBoth("concerned");
        else setEmotionBoth("concerned");

        const tabAwayMsg = MSG.comeBack(fn, minsAway, grade);
        setIdleCheckMsg(tabAwayMsg);
        speak(tabAwayMsg);
        setDistractPopup(true);

        // Auto-pause if ignored for 60 seconds
        if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
        popupAutoTimer.current = setTimeout(() => {
          setDistractPopup(false);
          setIsPaused(true);
          setEmotionBoth("frustrated");
          pauseCbRef.current?.();
        }, 60_000);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (osNotifTimer.current) clearTimeout(osNotifTimer.current);
    };
  }, [visible, isStudying, fn, grade, speak, setEmotionBoth]);

  // ── "Yes, studying" handler ───────────────────────────────────────────────
  const handleConfirmStudying = useCallback(() => {
    if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
    setDistractPopup(false);
    lastWarnedAt.current = Date.now();
    // Reset idle-check state so the cascade starts fresh
    idleCheckCountRef.current = 0;
    lastActivityRef.current = Date.now();
    lastConfirmedStudyingAt.current = Date.now();
    if (isPaused) {
      setIsPaused(false);
      resumeCbRef.current?.();
    }
    setEmotionBoth("focused");
    speak(pick([
      `Good — let's get back to it.`,
      `Back in the zone. Let's go.`,
      `Welcome back. Focus mode: on.`,
      `Alright. Back on track.`,
      `That's what I like to hear. Keep going.`,
    ]));
  }, [isPaused, speak, setEmotionBoth]);

  // ── "I'm distracted" handler ──────────────────────────────────────────────
  const handleConfirmDistracted = useCallback(() => {
    if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
    setDistractPopup(false);
    setIsPaused(true);
    setEmotionBoth("concerned");
    pauseCbRef.current?.();
    speak(pick([
      `No worries. Take a moment, then come back. I'll be here.`,
      `That's honest. Rest a bit — come back when you're ready.`,
      `It happens. Take a real break and come back fresh.`,
    ]));
  }, [speak, setEmotionBoth]);

  // ── Resume from paused state ──────────────────────────────────────────────
  const handleResume = useCallback(() => {
    setIsPaused(false);
    resumeCbRef.current?.();
    idleCheckCountRef.current = 0;
    lastActivityRef.current = Date.now();
    lastConfirmedStudyingAt.current = Date.now();
    setEmotionBoth("focused");
    speak(MSG.comeback(fn));
  }, [fn, speak, setEmotionBoth]);

  // ── Bye when Puku hides ───────────────────────────────────────────────────
  useEffect(() => {
    if (!visible && !wasBye.current && hasGreeted.current) {
      wasBye.current = true;
      speak(MSG.bye(fn));
    }
  }, [visible, fn, speak]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    speechCbRef.current("", false);
    if (bubbleClearTimer.current)  clearTimeout(bubbleClearTimer.current);
    if (healthTimer.current)       clearTimeout(healthTimer.current);
    if (midSessionTimer.current)   clearTimeout(midSessionTimer.current);
    if (osNotifTimer.current)      clearTimeout(osNotifTimer.current);
    if (popupAutoTimer.current)    clearTimeout(popupAutoTimer.current);
  }, []);

  const handleMinimize = useCallback((val: boolean) => {
    setMinimized(val);
    onMinimizeChange?.(val);
  }, [onMinimizeChange]);

  if (!visible) return null;

  // ── Distraction popup ─────────────────────────────────────────────────────
  const distractOverlay = distractPopup ? (
    <AnimatePresence>
      <motion.div
        key="puku-distract-popup"
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0,   scale: 1 }}
        exit={{    opacity: 0, y: -14, scale: 0.97 }}
        className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-xs"
      >
        <div className="rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)", boxShadow: "0 8px 32px rgba(124,58,237,0.45)" }}>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <PukuFace emotion="concerned" size={28} speaking={false} />
            <span className="text-white font-black text-xs tracking-widest flex-1">PUKU</span>
          </div>
          <p className="text-white text-sm font-semibold leading-snug px-4 pb-3">{idleCheckMsg}</p>
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={handleConfirmStudying}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Yes, studying
            </button>
            <button
              onClick={handleConfirmDistracted}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Taking a break
            </button>
          </div>
          <motion.div
            key={idleCheckCountRef.current}
            className="h-0.5 bg-white/30"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 90, ease: "linear" }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  ) : null;

  // ── Paused state banner ────────────────────────────────────────────────────
  const pausedBanner = isPaused ? (
    <AnimatePresence>
      <motion.div
        key="puku-paused-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-16 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-2rem)] max-w-xs"
      >
        <div className="rounded-xl bg-amber-500 shadow-lg px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PukuFace emotion="concerned" size={24} speaking={false} />
            <span className="text-white text-xs font-bold">Study tracking paused</span>
          </div>
          <button
            onClick={handleResume}
            className="bg-white text-amber-600 text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 hover:bg-amber-50 transition-colors"
          >
            Resume
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  ) : null;

  // ── Minimized pill ────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <>
        {distractOverlay}
        {pausedBanner}
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => handleMinimize(false)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40"
          title="Show Puku"
        >
          <div className="w-10 h-10 rounded-full shadow-lg border-2 border-white relative overflow-visible"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}>
            <PukuFace emotion={emotion} size={40} speaking={false} />
          </div>
          <span className="block text-center text-[8px] font-black text-purple-600 tracking-widest mt-0.5">PUKU</span>
        </motion.button>
      </>
    );
  }

  return (
    <>
      {distractOverlay}
      {pausedBanner}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed bottom-20 right-3 lg:bottom-5 lg:right-4 z-40"
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(139,92,246,0.2)",
            boxShadow: "0 4px 20px rgba(139,92,246,0.15), 0 2px 8px rgba(0,0,0,0.1)",
          }}>
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}>
            <PukuFace emotion={emotion} size={24} speaking={false} />
          </div>
          <span className="text-[9px] font-black tracking-wider text-purple-600">PUKU</span>

          <button onClick={() => setMuted(m => !m)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            title={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="w-3 h-3 text-gray-400" /> : <Volume2 className="w-3 h-3 text-purple-500" />}
          </button>

          <button onClick={() => handleMinimize(true)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            title="Minimize">
            <Minus className="w-3 h-3 text-gray-400" />
          </button>

          {onLeave && (
            <button
              onClick={() => { window.speechSynthesis?.cancel(); speechCbRef.current("", false); onLeave(); }}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
              title="Dismiss Puku">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── PukuFace — reusable face SVG for emotion states ──────────────────────────
// Used both inside this file and exported for ClassroomView.
export function PukuFace({
  emotion, size, speaking,
}: { emotion: PukuEmotion; size: number; speaking: boolean }) {
  const s = size;

  // Emotion-specific face configs
  const face: Record<PukuEmotion, {
    eyeScaleY: number; eyeOffsetY: number; browOffset: number;
    mouthPath: string; cheekOpacity: number;
  }> = {
    happy:     { eyeScaleY: 1,    eyeOffsetY: 0,    browOffset: 0,  mouthPath: "arc-up",    cheekOpacity: 0.5  },
    relaxed:   { eyeScaleY: 0.5,  eyeOffsetY: 1,    browOffset: 0,  mouthPath: "small-up",  cheekOpacity: 0.4  },
    focused:   { eyeScaleY: 1,    eyeOffsetY: -1,   browOffset: -2, mouthPath: "straight",  cheekOpacity: 0.15 },
    concerned: { eyeScaleY: 1,    eyeOffsetY: -1,   browOffset: -3, mouthPath: "small-down",cheekOpacity: 0.3  },
    frustrated:{ eyeScaleY: 0.85, eyeOffsetY: 0,    browOffset: -5, mouthPath: "frown",     cheekOpacity: 0.2  },
    proud:     { eyeScaleY: 0.6,  eyeOffsetY: 1,    browOffset: 2,  mouthPath: "big-up",    cheekOpacity: 0.55 },
    excited:   { eyeScaleY: 1.2,  eyeOffsetY: -2,   browOffset: 3,  mouthPath: "open-up",   cheekOpacity: 0.6  },
  };

  const cfg = face[emotion];

  const cx = s / 2;
  const cy = s / 2;
  const eyeY  = cy * 0.55 + cfg.eyeOffsetY;
  const eyeGap = s * 0.13;
  const eyeW  = s * 0.11;
  const eyeH  = s * 0.11 * cfg.eyeScaleY;
  const mouthY = cy + s * 0.18;
  const mouthW = s * 0.28;
  const mouthH = s * 0.10;

  function mouthPath() {
    const mx = cx - mouthW / 2;
    const mr = cx + mouthW / 2;
    switch (cfg.mouthPath) {
      case "arc-up":     return `M${mx},${mouthY} Q${cx},${mouthY - mouthH * 1.4} ${mr},${mouthY}`;
      case "small-up":   return `M${mx + mouthW * 0.15},${mouthY} Q${cx},${mouthY - mouthH * 0.9} ${mr - mouthW * 0.15},${mouthY}`;
      case "straight":   return `M${mx},${mouthY} L${mr},${mouthY}`;
      case "small-down": return `M${mx + mouthW * 0.15},${mouthY - mouthH * 0.4} Q${cx},${mouthY + mouthH * 0.6} ${mr - mouthW * 0.15},${mouthY - mouthH * 0.4}`;
      case "frown":      return `M${mx},${mouthY} Q${cx},${mouthY + mouthH * 1.2} ${mr},${mouthY}`;
      case "big-up":     return `M${mx},${mouthY} Q${cx},${mouthY - mouthH * 1.8} ${mr},${mouthY}`;
      case "open-up":    return `M${mx},${mouthY} Q${cx},${mouthY - mouthH * 1.6} ${mr},${mouthY} Q${cx},${mouthY - mouthH * 0.5} ${mx},${mouthY}`;
      default:           return `M${mx},${mouthY} L${mr},${mouthY}`;
    }
  }

  const browY = eyeY - eyeH * 1.3;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Ears */}
      <circle cx={cx - s * 0.37} cy={cy - s * 0.3} r={s * 0.09} fill="rgba(167,139,250,0.9)" />
      <circle cx={cx + s * 0.37} cy={cy - s * 0.3} r={s * 0.09} fill="rgba(167,139,250,0.9)" />

      {/* Left eye */}
      <ellipse cx={cx - eyeGap} cy={eyeY} rx={eyeW / 2} ry={eyeH / 2} fill="white" />
      {/* Right eye */}
      <ellipse cx={cx + eyeGap} cy={eyeY} rx={eyeW / 2} ry={eyeH / 2} fill="white" />

      {/* Eyebrow left */}
      {cfg.browOffset !== 0 && (
        <>
          <line
            x1={cx - eyeGap - eyeW * 0.7} y1={browY + (cfg.browOffset < 0 ? -cfg.browOffset : 0)}
            x2={cx - eyeGap + eyeW * 0.7} y2={browY + (cfg.browOffset < 0 ? 0 : cfg.browOffset)}
            stroke="white" strokeWidth={s * 0.04} strokeLinecap="round" opacity="0.85"
          />
          <line
            x1={cx + eyeGap - eyeW * 0.7} y1={browY + (cfg.browOffset < 0 ? 0 : cfg.browOffset)}
            x2={cx + eyeGap + eyeW * 0.7} y2={browY + (cfg.browOffset < 0 ? -cfg.browOffset : 0)}
            stroke="white" strokeWidth={s * 0.04} strokeLinecap="round" opacity="0.85"
          />
        </>
      )}

      {/* Cheeks */}
      <ellipse cx={cx - s * 0.28} cy={cy + s * 0.12} rx={s * 0.1} ry={s * 0.06}
        fill="rgba(255,180,200,1)" opacity={cfg.cheekOpacity} />
      <ellipse cx={cx + s * 0.28} cy={cy + s * 0.12} rx={s * 0.1} ry={s * 0.06}
        fill="rgba(255,180,200,1)" opacity={cfg.cheekOpacity} />

      {/* Mouth */}
      <path d={mouthPath()} stroke="white" strokeWidth={s * 0.045}
        fill={cfg.mouthPath === "open-up" ? "rgba(255,255,255,0.3)" : "none"}
        strokeLinecap="round" />

      {/* Speaking animation overlay */}
      {speaking && (
        <ellipse cx={cx} cy={mouthY} rx={mouthW * 0.35} ry={mouthH * 0.6}
          fill="rgba(255,255,255,0.3)" />
      )}
    </svg>
  );
}
