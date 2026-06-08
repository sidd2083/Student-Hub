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

  // ── Anti-cheat messages ────────────────────────────────────────────────────
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

// ── Puku Avatar ───────────────────────────────────────────────────────────────
function PukuAvatar({ isSpeaking, size = 72 }: { isSpeaking: boolean; size?: number }) {
  return (
    <motion.div
      animate={isSpeaking ? { scale: [1, 1.04, 1, 1.04, 1] } : { scale: 1 }}
      transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.7 }}
      style={{ width: size, height: size }}
      className="relative shrink-0"
    >
      <div
        className="rounded-full flex items-center justify-center text-white relative overflow-hidden shadow-xl"
        style={{
          width: size, height: size,
          background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
          boxShadow: isSpeaking
            ? "0 0 0 4px rgba(139,92,246,0.25), 0 0 20px rgba(139,92,246,0.35), 0 4px 20px rgba(0,0,0,0.3)"
            : "0 4px 20px rgba(0,0,0,0.25), 0 0 0 3px rgba(255,255,255,0.15)",
        }}
      >
        {/* Eyes */}
        <div className="absolute flex gap-2.5" style={{ top: "28%" }}>
          <motion.div
            animate={isSpeaking ? {} : { scaleY: [1, 0.08, 1] }}
            transition={{ repeat: Infinity, repeatDelay: 3.5, duration: 0.12 }}
            className="bg-white rounded-full"
            style={{ width: size * 0.13, height: size * 0.13 }}
          />
          <motion.div
            animate={isSpeaking ? {} : { scaleY: [1, 0.08, 1] }}
            transition={{ repeat: Infinity, repeatDelay: 3.5, duration: 0.12, delay: 0.05 }}
            className="bg-white rounded-full"
            style={{ width: size * 0.13, height: size * 0.13 }}
          />
        </div>
        {/* Mouth */}
        <motion.div
          animate={isSpeaking ? { scaleX: [1, 1.4, 0.7, 1.3, 1] } : {}}
          transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.35 }}
          className="absolute bg-white"
          style={{
            width: size * 0.22, height: size * 0.11,
            bottom: "22%",
            borderRadius: "0 0 50% 50%",
          }}
        />
        {/* Cheeks */}
        <div className="absolute" style={{ bottom: "18%", left: "10%", width: size * 0.16, height: size * 0.1, borderRadius: "50%", background: "rgba(255,180,200,0.45)" }} />
        <div className="absolute" style={{ bottom: "18%", right: "10%", width: size * 0.16, height: size * 0.1, borderRadius: "50%", background: "rgba(255,180,200,0.45)" }} />
        {/* Ears */}
        <div className="absolute bg-purple-400 rounded-full" style={{ width: size * 0.17, height: size * 0.17, top: "-6%", left: "11%" }} />
        <div className="absolute bg-purple-400 rounded-full" style={{ width: size * 0.17, height: size * 0.17, top: "-6%", right: "11%" }} />
      </div>

      {/* Pulsing ring when speaking */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-purple-400"
          animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
          transition={{ repeat: Infinity, duration: 0.9 }}
        />
      )}

      {/* Online dot */}
      <div
        className="absolute border-2 border-white rounded-full bg-green-400"
        style={{ width: 12, height: 12, bottom: 2, right: 2, boxShadow: "0 0 0 2px rgba(34,197,94,0.3)" }}
      />
    </motion.div>
  );
}

// ── Speech bubble ──────────────────────────────────────────────────────────────
function SpeechBubble({ text, visible }: { text: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && text && (
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 4 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64"
          style={{ zIndex: 1 }}
        >
          <div
            className="relative px-3.5 py-2.5 rounded-2xl text-sm leading-snug font-medium text-gray-800 dark:text-gray-100 shadow-xl"
            style={{
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(139,92,246,0.18)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(139,92,246,0.12)",
            }}
          >
            {text}
            {/* Bubble tail */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full"
              style={{
                width: 0, height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "8px solid rgba(255,255,255,0.97)",
                filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.08))",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function PukuPartner({ firstName, isStudying, isBreak, studyMins, onLeave, visible }: Props) {
  const [minimized,  setMinimized]  = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [bubble,     setBubble]     = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const fn = firstName.split(" ")[0];

  // Tracking refs
  const hasGreeted      = useRef(false);
  const prevStudying    = useRef(false);
  const prevBreak       = useRef(false);
  const milestones      = useRef<Set<number>>(new Set());
  const bubbleTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waterTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Anti-cheat refs
  const tabHiddenAt     = useRef<number | null>(null);
  const lastActivity    = useRef<number>(Date.now());
  const distractCount   = useRef(0);
  const lastIdleAlert   = useRef<number>(0);

  // ── Show bubble with auto-hide ────────────────────────────────────────────
  const showMessage = useCallback((text: string, durationMs = 7000) => {
    setBubble(text);
    setShowBubble(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setShowBubble(false), durationMs);
  }, []);

  // ── Speak via TTS (strips emojis, picks best voice) ──────────────────────
  const speak = useCallback((text: string) => {
    showMessage(text);
    if (muted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = stripForSpeech(text);
    if (!clean) return;

    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate   = 0.93;
    utt.pitch  = 1.08;
    utt.volume = 0.9;

    const trySpeak = () => {
      const v = pickVoice(window.speechSynthesis.getVoices());
      if (v) utt.voice = v;
      setIsSpeaking(true);
      utt.onend  = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utt);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", trySpeak, { once: true });
    }
  }, [muted, showMessage]);

  // ── Greeting ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || hasGreeted.current) return;
    hasGreeted.current = true;
    const t = setTimeout(() => speak(MESSAGES.greet(fn)), 1200);
    return () => clearTimeout(t);
  }, [visible]);

  // ── Study/break phase changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isStudying && !prevStudying.current) {
      speak(MESSAGES.studyStart(fn));
    } else if (isBreak && !prevBreak.current) {
      speak(MESSAGES.breakStart(fn));
    }
    prevStudying.current = isStudying;
    prevBreak.current    = isBreak;
  }, [isStudying, isBreak]);

  // ── Milestones ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const checks: [number, (fn: string) => string][] = [
      [5,   MESSAGES.milestone5],
      [15,  MESSAGES.milestone15],
      [30,  MESSAGES.milestone30],
      [60,  MESSAGES.milestone60],
      [90,  MESSAGES.milestone90],
      [120, MESSAGES.milestone120],
    ];
    for (const [mins, msgFn] of checks) {
      if (studyMins >= mins && !milestones.current.has(mins)) {
        milestones.current.add(mins);
        speak(msgFn(fn));
        return;
      }
    }
  }, [studyMins]);

  // ── Periodic motivational messages (only during study) ───────────────────
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
        idleTimer.current = scheduleNext();
      }, delayMs);
    };
    idleTimer.current = scheduleNext();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current as unknown as number); };
  }, [visible, fn]);

  // ── Water reminder every 30 min ──────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    waterTimer.current = setInterval(() => {
      if (isStudying) speak(MESSAGES.water(fn));
    }, 30 * 60 * 1000);
    return () => { if (waterTimer.current) clearInterval(waterTimer.current); };
  }, [visible, fn]);

  // ── Activity tracker ─────────────────────────────────────────────────────
  useEffect(() => {
    const touch = () => { lastActivity.current = Date.now(); };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach(e => window.addEventListener(e, touch, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, touch));
  }, []);

  // ── Anti-cheat: tab-away detection ───────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const onVisChange = () => {
      if (document.hidden) {
        if (isStudying) tabHiddenAt.current = Date.now();
      } else {
        const hiddenAt = tabHiddenAt.current;
        tabHiddenAt.current = null;
        if (!hiddenAt || !isStudying) return;
        const awayMs   = Date.now() - hiddenAt;
        const awayMins = Math.max(1, Math.round(awayMs / 60000));
        if (awayMins < 1.5) return; // < 90s → ignore

        distractCount.current += 1;
        const n = distractCount.current;
        const msg = n >= 3
          ? MESSAGES.tabAway3plus(fn, awayMins)
          : n === 2
            ? MESSAGES.tabAway2(fn, awayMins)
            : MESSAGES.tabAway1(fn, awayMins);
        setTimeout(() => speak(msg), 500);
      }
    };

    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, [visible, isStudying, fn]);

  // ── Anti-cheat: idle-on-page detection ───────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      if (!isStudying || document.hidden) return;
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs < 6 * 60 * 1000) return;
      if (Date.now() - lastIdleAlert.current < 12 * 60 * 1000) return;
      lastIdleAlert.current = Date.now();
      const idleMins = Math.round(idleMs / 60000);
      speak(MESSAGES.idleOnPage(fn, idleMins));
    }, 90 * 1000);
    return () => clearInterval(interval);
  }, [visible, isStudying, fn]);

  // ── Bye when others join ─────────────────────────────────────────────────
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
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      if (waterTimer.current)  clearInterval(waterTimer.current);
    };
  }, []);

  if (!visible) return null;

  // ── Minimized pill ────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-center gap-0.5"
        title="Puku is here"
      >
        <PukuAvatar isSpeaking={isSpeaking} size={48} />
        <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 tracking-widest">PUKU</span>
        {bubble && showBubble && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-white animate-pulse" />
        )}
      </motion.button>
    );
  }

  // ── Expanded presence ─────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.9 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-center"
    >
      {/* Speech bubble sits above avatar */}
      <div className="relative w-20 flex flex-col items-center">
        <SpeechBubble text={bubble} visible={showBubble} />

        {/* Avatar */}
        <PukuAvatar isSpeaking={isSpeaking} size={72} />

        {/* Name tag */}
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[10px] font-black tracking-widest text-purple-600 dark:text-purple-400">PUKU</span>
          {isSpeaking && (
            <motion.div className="flex gap-0.5 items-end" style={{ height: 10 }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="w-0.5 rounded-full bg-purple-500"
                  animate={{ height: ["3px", "9px", "3px"] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.12 }}
                />
              ))}
            </motion.div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={() => setMuted(m => !m)}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={muted ? "Unmute Puku" : "Mute Puku"}
          >
            {muted
              ? <VolumeX className="w-3 h-3 text-gray-500" />
              : <Volume2 className="w-3 h-3 text-purple-500" />
            }
          </button>
          <button
            onClick={() => setMinimized(true)}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Minimize Puku"
          >
            <Minus className="w-3 h-3 text-gray-500" />
          </button>
          {onLeave && (
            <button
              onClick={() => { window.speechSynthesis?.cancel(); onLeave(); }}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20 transition-colors"
              title="Dismiss Puku"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
