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
  onSpeechUpdate: (speech: string, isSpeaking: boolean) => void;
  onMinimizeChange?: (minimized: boolean) => void;
}

// ── Strip emojis so TTS reads clean text ────────────────────────────────────
function stripForSpeech(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/[\uFE00-\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Best available TTS voice ─────────────────────────────────────────────────
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
  if (h < 5) return "late night"; if (h < 12) return "morning";
  if (h < 17) return "afternoon"; if (h < 21) return "evening"; return "night";
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Message bank ─────────────────────────────────────────────────────────────
const MSG = {
  greet: (fn: string) => pick([
    `Hey ${fn}! I'm Puku, your study buddy. I'll be right here with you — let's make this session count.`,
    `${fn}! Good to see you showing up. That's already half the battle. Let's get to work.`,
    `${fn}, you're here in the ${timePart()} — that means you're serious. I respect that. Let's go.`,
    `Hey ${fn}. It's just you and me right now. Let's make every minute worth it.`,
  ]),
  studyStart: (fn: string) => pick([
    `Let's lock in ${fn}. Timer's running — make it count.`,
    `Focus mode activated ${fn}. No distractions, just you and your books.`,
    `Okay ${fn}, this is it. Full focus. I'll be right here watching.`,
    `Clock's ticking ${fn}. Give me everything you've got.`,
  ]),
  early: (fn: string) => pick([
    `Good start ${fn}. The first few minutes are always the hardest — push through.`,
    `${fn}, just getting warmed up. Stay with it.`,
    `${fn}, lock in. Give yourself 10 minutes and you'll hit your stride.`,
  ]),
  mid: (fn: string, m: number) => pick([
    `${fn}, ${m} minutes in and still going. That's the energy I wanted to see.`,
    `Look at you ${fn} — ${m} minutes of solid focus. Keep that up.`,
    `${m} minutes, ${fn}. You're past the hard part. This is where real studying happens.`,
    `${fn}, ${m} minutes of actual work done. Your brain is building right now.`,
  ]),
  long: (fn: string, m: number) => pick([
    `${fn}, ${m} minutes. That is serious dedication. Board exam toppers study like this.`,
    `${m} minutes ${fn}. I'm not exaggerating — most people can't do what you're doing right now.`,
    `${fn} — ${m} minutes in. The people who succeed are the ones who stay seated this long. That's you.`,
  ]),
  milestone5:   (fn: string) => `${fn}, five minutes down. The hardest part is starting — and you already did that.`,
  milestone15:  (fn: string) => `Fifteen minutes ${fn}. You're properly focused now. Ride this wave.`,
  milestone30:  (fn: string) => `${fn}, thirty minutes of real studying done. That is genuinely impressive.`,
  milestone60:  (fn: string) => `One hour ${fn}. One full hour. I don't say this lightly — that is exceptional.`,
  milestone90:  (fn: string) => `${fn}, ninety minutes. You are built differently. Keep going.`,
  milestone120: (fn: string) => `Two hours ${fn}. Two hours of focused work. Your future self will thank you.`,
  water: (fn: string) => pick([
    `${fn}, when did you last drink water? Your brain is 75 percent water — go get some.`,
    `Hey ${fn}, water check. Go drink a glass right now. I'll be here.`,
    `${fn}, hydration reminder. You can't focus dehydrated. Quick — drink something.`,
  ]),
  breakStart: (fn: string) => pick([
    `Break time ${fn}. Step away from the screen, stretch out. You earned this.`,
    `${fn}, real break — don't look at study material. Let your brain rest.`,
    `Rest mode ${fn}. Walk around, get some water. Back at it after this.`,
  ]),
  random: (fn: string) => pick([
    `${fn}, explaining a topic out loud helps you remember it way better. Try it.`,
    `${fn}, you know what separates good students from great ones? They don't quit when it gets boring.`,
    `${fn} — NEB toppers didn't have superpowers. They just didn't stop showing up.`,
    `Hey ${fn}, I've been watching — you're more focused than you think.`,
    `${fn}, one chapter at a time. Don't overwhelm yourself.`,
    `${fn}, every minute you study right now is an investment. It compounds.`,
    `The ${timePart()} session is underrated ${fn}. Quiet, focused, effective.`,
  ]),
  tabAway1:    (fn: string, m: number) => pick([
    `${fn}, you were away for ${m} minutes. Your timer kept running — was that actually study time?`,
    `Hey ${fn}, I noticed you were gone for ${m} minutes. Let's get back to it.`,
    `${fn}, ${m} minutes away. The exam won't give you those minutes back.`,
  ]),
  tabAway2:    (fn: string, m: number) => pick([
    `${fn}, that's the second time. ${m} more minutes gone. Your focus is slipping — let's fix that.`,
    `Again ${fn}? ${m} minutes away again. I need you to stay on this page.`,
  ]),
  tabAway3:    (fn: string, m: number) => pick([
    `${fn}, three times now. ${m} minutes of distraction. Close everything else and just study.`,
    `${fn}, this keeps happening. The board exam is coming — let's stop this pattern right now.`,
  ]),
  idle: (fn: string, m: number) => pick([
    `${fn}, your cursor hasn't moved in ${m} minutes. Are you actually reading, or just staring?`,
    `Hey ${fn}, still with me? ${m} minutes of no activity.`,
  ]),
  bye: (fn: string) => `${fn}, looks like someone joined. I'll give you your space. You've been great today.`,
};

// ── Main component ────────────────────────────────────────────────────────────
export function PukuPartner({
  firstName, isStudying, isBreak, studyMins, onLeave, visible,
  onSpeechUpdate, onMinimizeChange,
}: Props) {
  const [minimized, setMinimized] = useState(false);
  const [muted,     setMuted]     = useState(false);

  const fn = firstName.split(" ")[0];

  // ── Refs — avoid stale closures + prevent GC of timers ───────────────────
  const muteRef          = useRef(muted);
  const speechCbRef      = useRef(onSpeechUpdate);
  const bubbleClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waterTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCheckTimer   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync — no render triggered
  useEffect(() => { muteRef.current = muted; }, [muted]);
  useEffect(() => { speechCbRef.current = onSpeechUpdate; }, [onSpeechUpdate]);

  // Anti-cheat refs
  const hasGreeted     = useRef(false);
  const prevStudying   = useRef(false);
  const prevBreak      = useRef(false);
  const milestones     = useRef<Set<number>>(new Set());
  const tabHiddenAt    = useRef<number | null>(null);
  const lastActivity   = useRef<number>(Date.now());
  const distractCount  = useRef(0);
  const lastIdleAlert  = useRef<number>(0);
  const wasBye         = useRef(false);

  // ── speak — stable (created once, uses only refs) ────────────────────────
  const speak = useCallback((text: string) => {
    // Cancel any pending bubble-clear
    if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);

    // Show bubble in classroom via parent callback
    speechCbRef.current(text, false);

    // Schedule bubble clear after 7 s
    bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 7000);

    if (muteRef.current || !window.speechSynthesis) return;
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
      speechCbRef.current(text, true);
      utt.onend   = () => speechCbRef.current(text, false);
      utt.onerror = () => speechCbRef.current(text, false);
      window.speechSynthesis.speak(utt);
    };

    window.speechSynthesis.getVoices().length > 0
      ? trySpeak()
      : window.speechSynthesis.addEventListener("voiceschanged", trySpeak, { once: true });
  }, []); // stable — no external deps, only refs

  // ── Greeting (once) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || hasGreeted.current) return;
    hasGreeted.current = true;
    const t = setTimeout(() => speak(MSG.greet(fn)), 1200);
    return () => clearTimeout(t);
  }, [visible, fn, speak]);

  // ── Study / break transitions ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isStudying && !prevStudying.current) speak(MSG.studyStart(fn));
    else if (isBreak && !prevBreak.current)  speak(MSG.breakStart(fn));
    prevStudying.current = isStudying;
    prevBreak.current    = isBreak;
  }, [isStudying, isBreak, visible, fn, speak]);

  // ── Milestones ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const checks: [number, (fn: string) => string][] = [
      [5, MSG.milestone5], [15, MSG.milestone15], [30, MSG.milestone30],
      [60, MSG.milestone60], [90, MSG.milestone90], [120, MSG.milestone120],
    ];
    for (const [mins, msgFn] of checks) {
      if (studyMins >= mins && !milestones.current.has(mins)) {
        milestones.current.add(mins);
        speak(msgFn(fn));
        return;
      }
    }
  }, [studyMins, visible, fn, speak]);

  // ── Periodic motivational (scheduled recursively, cleared on unmount) ────
  useEffect(() => {
    if (!visible) return;
    const scheduleNext = (): ReturnType<typeof setTimeout> =>
      setTimeout(() => {
        if (isStudying) {
          speak(
            studyMins < 5  ? MSG.early(fn) :
            studyMins < 20 ? MSG.mid(fn, studyMins) :
            studyMins < 60 ? pick([MSG.mid(fn, studyMins), MSG.random(fn)]) :
                             pick([MSG.long(fn, studyMins), MSG.random(fn)])
          );
        }
        scheduleTimer.current = scheduleNext();
      }, (4.5 + Math.random() * 4) * 60_000);

    scheduleTimer.current = scheduleNext();
    return () => { if (scheduleTimer.current) clearTimeout(scheduleTimer.current); };
  }, [visible, fn]); // intentionally excludes speak — always latest via ref pattern

  // ── Water reminder every 30 min ───────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    waterTimer.current = setInterval(() => { if (isStudying) speak(MSG.water(fn)); }, 30 * 60_000);
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
    const onVis = () => {
      if (document.hidden) {
        if (isStudying) tabHiddenAt.current = Date.now();
      } else {
        const at = tabHiddenAt.current;
        tabHiddenAt.current = null;
        if (!at || !isStudying) return;
        const mins = Math.max(1, Math.round((Date.now() - at) / 60_000));
        if (mins < 1.5) return;
        distractCount.current += 1;
        const n = distractCount.current;
        setTimeout(() => speak(n >= 3 ? MSG.tabAway3(fn, mins) : n === 2 ? MSG.tabAway2(fn, mins) : MSG.tabAway1(fn, mins)), 500);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [visible, isStudying, fn, speak]);

  // ── Anti-cheat: idle-on-page ──────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    idleCheckTimer.current = setInterval(() => {
      if (!isStudying || document.hidden) return;
      const idleMs = Date.now() - lastActivity.current;
      if (idleMs < 6 * 60_000 || Date.now() - lastIdleAlert.current < 12 * 60_000) return;
      lastIdleAlert.current = Date.now();
      speak(MSG.idle(fn, Math.round(idleMs / 60_000)));
    }, 90_000);
    return () => { if (idleCheckTimer.current) clearInterval(idleCheckTimer.current); };
  }, [visible, isStudying, fn, speak]);

  // ── Bye when Puku hides (someone joined) ─────────────────────────────────
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
    if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
    if (waterTimer.current)       clearInterval(waterTimer.current);
    if (scheduleTimer.current)    clearTimeout(scheduleTimer.current);
    if (idleCheckTimer.current)   clearInterval(idleCheckTimer.current);
  }, []);

  // ── Minimize handler — stable ─────────────────────────────────────────────
  const handleMinimize = useCallback((val: boolean) => {
    setMinimized(val);
    onMinimizeChange?.(val);
  }, [onMinimizeChange]);

  if (!visible) return null;

  // ── Minimized pill ────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => handleMinimize(false)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-center gap-0.5"
        title="Show Puku in classroom"
      >
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

  // ── Control pill ──────────────────────────────────────────────────────────
  return (
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
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-black shrink-0"
          style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
        >
          P
        </div>
        <span className="text-[9px] font-black tracking-wider text-purple-600">PUKU</span>

        <button
          onClick={() => setMuted(m => !m)}
          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="w-3 h-3 text-gray-400" /> : <Volume2 className="w-3 h-3 text-purple-500" />}
        </button>

        <button
          onClick={() => handleMinimize(true)}
          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3 h-3 text-gray-400" />
        </button>

        {onLeave && (
          <button
            onClick={() => { window.speechSynthesis?.cancel(); speechCbRef.current("", false); onLeave(); }}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
            title="Dismiss Puku"
          >
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
