import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Minus, X } from "lucide-react";

interface Props {
  firstName: string;
  isStudying: boolean;
  isBreak: boolean;
  studyMins: number;
  onLeave?: () => void;
  visible: boolean;
  /** Called whenever Puku speaks — drives the classroom speech bubble */
  onSpeechUpdate: (speech: string, isSpeaking: boolean) => void;
  /** Called when minimized state changes — parent hides/shows Puku in classroom */
  onMinimizeChange?: (minimized: boolean) => void;
}

// ── Strip emojis so TTS doesn't read them out ────────────────────────────────
function stripForSpeech(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u2600-\u26FF]/g, "")
    .replace(/[\u2700-\u27BF]/g, "")
    .replace(/[\uFE00-\uFEFF]/g, "")
    .replace(/[🐾🎯💪🔥📚🏆🎉💧🌟✨🧠💎🌱🌿☕⏰📖🤝🥺😤💙💡🎙]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Pick the best available voice ────────────────────────────────────────────
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const priority = [
    "Microsoft Aria Online (Natural)",
    "Microsoft Jenny Online (Natural)",
    "Google US English",
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
  ];
  for (const name of priority) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  const enUs = voices.find(v => v.lang === "en-US" && !v.name.includes("Male"));
  if (enUs) return enUs;
  const en   = voices.find(v => v.lang.startsWith("en"));
  if (en) return en;
  return voices[0] ?? null;
}

function getHour() { return new Date().getHours(); }
function timePart() {
  const h = getHour();
  if (h < 5)  return "late night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Huge message bank — unique, natural, varied ──────────────────────────────
const MESSAGES = {
  greet: (fn: string) => pick([
    `Hey ${fn}! I'm Puku, your study buddy. I'll be right here with you — let's make this session count.`,
    `${fn}! Good to see you showing up. That's already half the battle. Let's get to work.`,
    `${fn}, you're here in the ${timePart()} — that means you're serious. I respect that. Let's go.`,
    `${fn}! Your books aren't going to read themselves. I've got your back today — let's focus.`,
    `Hey ${fn}. It's just you and me right now. Let's make every minute worth it.`,
  ]),

  studyStart: (fn: string) => pick([
    `Let's lock in ${fn}. Timer's running — make it count.`,
    `Focus mode activated ${fn}. No distractions, just you and your books.`,
    `Okay ${fn}, this is it. Full focus. I'll be right here watching.`,
    `${fn}, session started. Let's see what you've got today.`,
    `Clock's ticking ${fn}. Give me everything you've got.`,
  ]),

  early: (fn: string) => pick([
    `Good start ${fn}. The first few minutes are always the hardest — push through.`,
    `${fn}, just getting warmed up. Stay with it.`,
    `Keep going ${fn}, you're just finding your rhythm.`,
    `${fn}, lock in. Give yourself 10 minutes and you'll hit your stride.`,
  ]),

  mid: (fn: string, mins: number) => pick([
    `${fn}, ${mins} minutes in and still going. That's the energy I wanted to see.`,
    `Look at you ${fn} — ${mins} minutes of solid focus. Keep that up.`,
    `${fn} is in the zone right now — ${mins} minutes deep. Don't break the flow.`,
    `${mins} minutes, ${fn}. You're past the hard part. This is where real studying happens.`,
    `${fn}, ${mins} minutes of actual work done. Your brain is building right now.`,
    `I see you working ${fn}. ${mins} minutes in. You're doing exactly what you should be doing.`,
  ]),

  long: (fn: string, mins: number) => pick([
    `${fn}, ${mins} minutes. That is serious dedication. Board exam toppers study like this.`,
    `${fn}! An hour plus of focus? That's rare. You should be genuinely proud of that.`,
    `${mins} minutes ${fn}. I'm not exaggerating — most people can't do what you're doing right now.`,
    `${fn}, your brain has been working for ${mins} minutes. Drink some water and keep going.`,
    `${fn} — ${mins} minutes in. The people who succeed are the ones who stay seated this long. That's you.`,
  ]),

  milestone5:  (fn: string) => `${fn}, five minutes down. The hardest part is starting — and you already did that.`,
  milestone15: (fn: string) => `Fifteen minutes ${fn}. You're properly focused now. Ride this wave.`,
  milestone30: (fn: string) => `${fn}, thirty minutes of real studying done. That is genuinely impressive.`,
  milestone60: (fn: string) => `One hour ${fn}. One full hour. I don't say this lightly — that is exceptional.`,
  milestone90: (fn: string) => `${fn}, ninety minutes. You are built differently. Keep going.`,
  milestone120: (fn: string) => `Two hours ${fn}. Two hours of focused work. Your future self is going to thank you for this.`,

  water: (fn: string) => pick([
    `${fn}, when did you last drink water? Your brain is 75 percent water — go get some.`,
    `Hey ${fn}, water check. Go drink a glass right now. I'll be here.`,
    `${fn}, hydration reminder. You can't focus when you're dehydrated. Quick break — drink something.`,
    `${fn}, small thing — drink some water. Your concentration will actually improve.`,
  ]),

  breakStart: (fn: string) => pick([
    `Break time ${fn}. Step away from the screen, stretch out. You earned this.`,
    `${fn}, this is a real break — don't look at study material. Let your brain rest.`,
    `Rest mode ${fn}. Walk around, get some water. Back at it after this.`,
    `${fn}, take this break seriously. Resting properly makes the next session better.`,
  ]),

  random: (fn: string) => pick([
    `${fn}, quick thought — explaining a topic out loud helps you remember it way better. Try it.`,
    `${fn}, you know what separates good students from great ones? They don't quit when it gets boring. Stay with it.`,
    `${fn} — the students who top the NEB board didn't have superpowers. They just didn't stop showing up.`,
    `${fn}, if you're feeling stuck, read the question again from the beginning. Slowly.`,
    `Hey ${fn}, I've been watching — you're more focused than you think. Don't doubt yourself.`,
    `${fn}, one chapter at a time. Don't overwhelm yourself with everything at once.`,
    `${fn}, every minute you study right now is an investment. It compounds. Trust the process.`,
    `${fn}, I notice you're still here. That itself is impressive. Most people would've quit by now.`,
    `${fn} — mistakes while studying are fine. That's how you learn. Keep going.`,
    `The ${timePart()} session is underrated ${fn}. Quiet, focused, effective. You picked the right time.`,
  ]),

  tabAway1: (fn: string, mins: number) => pick([
    `${fn}, you were away for ${mins} minutes. Your timer kept running — was that actually study time?`,
    `Hey ${fn}, I noticed you were gone for ${mins} minutes. Everything okay? Let's get back to it.`,
    `${fn}, ${mins} minutes away. No judgment — but the exam won't give you those minutes back.`,
  ]),

  tabAway2: (fn: string, mins: number) => pick([
    `${fn}, that's the second time. ${mins} more minutes gone. Your focus is slipping — let's fix that.`,
    `Again ${fn}? ${mins} minutes away again. I need you to stay on this page.`,
    `${fn}, twice now. ${mins} minutes this time. What's pulling your attention away?`,
  ]),

  tabAway3plus: (fn: string, mins: number) => pick([
    `${fn}, three times now. I'm not going to pretend ${mins} minutes of distraction is okay. Let's reset and focus.`,
    `${fn}, this keeps happening. The board exam is coming — every distraction counts. Let's stop this pattern right now.`,
    `Okay ${fn}, I need to be real with you. You've been away multiple times. Close everything else and just study.`,
  ]),

  idleOnPage: (fn: string, mins: number) => pick([
    `${fn}, your cursor hasn't moved in ${mins} minutes. Are you actually reading, or just staring?`,
    `Hey ${fn}, still with me? ${mins} minutes of no activity. Just checking you're actually studying.`,
    `${fn} — ${mins} minutes without movement. If you're reading, keep going. If you're distracted, let's reset.`,
  ]),

  bye: (fn: string) => `${fn}, looks like someone joined the room. I'll give you your space. You've been great today.`,
};

// ── Main component — logic + small control pill ───────────────────────────────
export function PukuPartner({
  firstName, isStudying, isBreak, studyMins, onLeave, visible,
  onSpeechUpdate, onMinimizeChange,
}: Props) {
  const [minimized, setMinimized] = useState(false);
  const [muted,     setMuted]     = useState(false);

  const fn = firstName.split(" ")[0];

  // Refs for tracking
  const hasGreeted      = useRef(false);
  const prevStudying    = useRef(false);
  const prevBreak       = useRef(false);
  const milestones      = useRef<Set<number>>(new Set());
  const waterTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Anti-cheat refs
  const tabHiddenAt   = useRef<number | null>(null);
  const lastActivity  = useRef<number>(Date.now());
  const distractCount = useRef(0);
  const lastIdleAlert = useRef<number>(0);

  // ── Notify parent of minimize changes ─────────────────────────────────────
  const handleMinimize = useCallback((val: boolean) => {
    setMinimized(val);
    onMinimizeChange?.(val);
  }, [onMinimizeChange]);

  // ── Speak: TTS + update classroom speech bubble ───────────────────────────
  const speak = useCallback((text: string) => {
    // Show bubble in classroom
    onSpeechUpdate(text, false);

    // Auto-clear bubble after 7s
    setTimeout(() => onSpeechUpdate("", false), 7000);

    if (muted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = stripForSpeech(text);
    if (!clean) return;

    const utt    = new SpeechSynthesisUtterance(clean);
    utt.rate     = 0.93;
    utt.pitch    = 1.08;
    utt.volume   = 0.9;

    const trySpeak = () => {
      const v = pickVoice(window.speechSynthesis.getVoices());
      if (v) utt.voice = v;
      onSpeechUpdate(text, true);
      utt.onend   = () => onSpeechUpdate(text, false);
      utt.onerror = () => onSpeechUpdate(text, false);
      window.speechSynthesis.speak(utt);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", trySpeak, { once: true });
    }
  }, [muted, onSpeechUpdate]);

  // ── Greeting ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || hasGreeted.current) return;
    hasGreeted.current = true;
    const t = setTimeout(() => speak(MESSAGES.greet(fn)), 1200);
    return () => clearTimeout(t);
  }, [visible]);

  // ── Study/break transitions ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isStudying && !prevStudying.current) speak(MESSAGES.studyStart(fn));
    else if (isBreak && !prevBreak.current)  speak(MESSAGES.breakStart(fn));
    prevStudying.current = isStudying;
    prevBreak.current    = isBreak;
  }, [isStudying, isBreak]);

  // ── Study milestones ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const checks: [number, (fn: string) => string][] = [
      [5, MESSAGES.milestone5], [15, MESSAGES.milestone15],
      [30, MESSAGES.milestone30], [60, MESSAGES.milestone60],
      [90, MESSAGES.milestone90], [120, MESSAGES.milestone120],
    ];
    for (const [mins, msgFn] of checks) {
      if (studyMins >= mins && !milestones.current.has(mins)) {
        milestones.current.add(mins);
        speak(msgFn(fn));
        return;
      }
    }
  }, [studyMins]);

  // ── Periodic motivational (only during study) ─────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const scheduleNext = () => {
      const delayMs = (4.5 + Math.random() * 4) * 60 * 1000;
      return setTimeout(() => {
        if (isStudying) {
          const msg = studyMins < 5
            ? MESSAGES.early(fn)
            : studyMins < 20
              ? MESSAGES.mid(fn, studyMins)
              : studyMins < 60
                ? pick([MESSAGES.mid(fn, studyMins), MESSAGES.random(fn)])
                : pick([MESSAGES.long(fn, studyMins), MESSAGES.random(fn)]);
          speak(msg);
        }
        scheduleTimer.current = scheduleNext();
      }, delayMs);
    };
    scheduleTimer.current = scheduleNext();
    return () => { if (scheduleTimer.current) clearTimeout(scheduleTimer.current); };
  }, [visible, fn]);

  // ── Water reminder every 30 min ──────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    waterTimer.current = setInterval(() => {
      if (isStudying) speak(MESSAGES.water(fn));
    }, 30 * 60 * 1000);
    return () => { if (waterTimer.current) clearInterval(waterTimer.current); };
  }, [visible, fn]);

  // ── Activity tracking ─────────────────────────────────────────────────────
  useEffect(() => {
    const touch = () => { lastActivity.current = Date.now(); };
    const evts = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    evts.forEach(e => window.addEventListener(e, touch, { passive: true }));
    return () => evts.forEach(e => window.removeEventListener(e, touch));
  }, []);

  // ── Anti-cheat: tab-away ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const onVisChange = () => {
      if (document.hidden) {
        if (isStudying) tabHiddenAt.current = Date.now();
      } else {
        const hiddenAt = tabHiddenAt.current;
        tabHiddenAt.current = null;
        if (!hiddenAt || !isStudying) return;
        const awayMins = Math.max(1, Math.round((Date.now() - hiddenAt) / 60000));
        if (awayMins < 1.5) return;
        distractCount.current += 1;
        const n = distractCount.current;
        const msg = n >= 3 ? MESSAGES.tabAway3plus(fn, awayMins)
          : n === 2 ? MESSAGES.tabAway2(fn, awayMins)
          : MESSAGES.tabAway1(fn, awayMins);
        setTimeout(() => speak(msg), 500);
      }
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [visible, isStudying, fn]);

  // ── Anti-cheat: idle-on-page ──────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => {
      if (!isStudying || document.hidden) return;
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs < 6 * 60 * 1000) return;
      if (Date.now() - lastIdleAlert.current < 12 * 60 * 1000) return;
      lastIdleAlert.current = Date.now();
      speak(MESSAGES.idleOnPage(fn, Math.round(idleMs / 60000)));
    }, 90 * 1000);
    return () => clearInterval(iv);
  }, [visible, isStudying, fn]);

  // ── Bye when someone joins ────────────────────────────────────────────────
  const wasBye = useRef(false);
  useEffect(() => {
    if (!visible && !wasBye.current && hasGreeted.current) {
      wasBye.current = true;
      speak(MESSAGES.bye(fn));
    }
  }, [visible]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      onSpeechUpdate("", false);
      if (waterTimer.current)  clearInterval(waterTimer.current);
      if (scheduleTimer.current) clearTimeout(scheduleTimer.current);
    };
  }, []);

  if (!visible) return null;

  // ── Minimized: tiny floating avatar pill ──────────────────────────────────
  if (minimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => handleMinimize(false)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-center gap-0.5"
        title="Show Puku in classroom"
      >
        {/* Tiny avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs shadow-lg border-2 border-white"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
        >
          P
        </div>
        <span className="text-[8px] font-black text-purple-600 dark:text-purple-400 tracking-widest">PUKU</span>
      </motion.button>
    );
  }

  // ── Expanded: small control pill ──────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed bottom-20 right-3 lg:bottom-5 lg:right-4 z-40"
      >
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(139,92,246,0.2)",
            boxShadow: "0 4px 20px rgba(139,92,246,0.15), 0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          {/* Small avatar dot */}
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-black shrink-0"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
          >
            P
          </div>
          <span className="text-[9px] font-black tracking-wider text-purple-600">PUKU</span>

          {/* Mute */}
          <button
            onClick={() => setMuted(m => !m)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted
              ? <VolumeX className="w-3 h-3 text-gray-400" />
              : <Volume2 className="w-3 h-3 text-purple-500" />
            }
          </button>

          {/* Minimize */}
          <button
            onClick={() => handleMinimize(true)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3 text-gray-400" />
          </button>

          {/* Dismiss */}
          {onLeave && (
            <button
              onClick={() => { window.speechSynthesis?.cancel(); onSpeechUpdate("", false); onLeave(); }}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
              title="Dismiss Puku"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
