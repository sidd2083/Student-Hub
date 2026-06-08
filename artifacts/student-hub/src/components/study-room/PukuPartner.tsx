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
    `Hey ${fn}! Puku here — your personal study buddy. Just you and me today. Let's make this count, okay?`,
    `${fn}! You actually showed up. That already puts you ahead of most people. Let's get to it.`,
    `${fn}, ${timePart()} session — respect. I'll be right here beside you the whole time. Let's go.`,
    `Hey ${fn}! I was waiting for you. Ready? Let's make this one of those sessions you look back on.`,
    `${fn}! It's us today. No one else — just you, your books, and me. Let's make it a good one.`,
  ]),
  studyStart: (fn: string) => pick([
    `Let's lock in ${fn}. Timer's running — this is your time now.`,
    `Focus mode on, ${fn}. Just you and the material. I'll keep you company.`,
    `Okay ${fn}, this is it. Phone down, books open. I'm right here with you.`,
    `Clock's ticking ${fn}. Give it everything. I believe in you.`,
    `Let's go ${fn}! Forget everything else for now — just this.`,
  ]),
  early: (fn: string) => pick([
    `Good start ${fn}. The first few minutes are always the hardest — push through, you've got this.`,
    `${fn}, you're just warming up. Stay with it — it gets easier in a few minutes.`,
    `${fn}, give it 10 minutes and you'll hit your stride. I've seen you do this before.`,
    `Starting is the hardest part ${fn}. You already did it. Now just keep going.`,
  ]),
  mid: (fn: string, m: number) => pick([
    `${fn}, ${m} minutes in and still going strong. That's what I'm talking about.`,
    `Look at you ${fn} — ${m} minutes of real focus. I'm genuinely proud of you.`,
    `${m} minutes, ${fn}. You're past the hardest part now. This is where it gets good.`,
    `${fn}, ${m} minutes of actual work. Your brain is literally building connections right now.`,
    `${m} minutes ${fn}. Honestly? You're doing great. Don't stop.`,
  ]),
  long: (fn: string, m: number) => pick([
    `${fn}, ${m} minutes. Bro — that is serious dedication. NEB toppers study exactly like this.`,
    `${m} minutes ${fn}. I won't lie — most people can't sit this long. You're different.`,
    `${fn}, ${m} minutes in. The people who top their class? This is what they do. That's you right now.`,
    `${fn}! ${m} minutes. I'm not exaggerating when I say — you should be proud of yourself.`,
  ]),
  milestone5:   (fn: string) => pick([
    `${fn}, five minutes down! The hardest part is always starting — and you already crushed it.`,
    `Five minutes ${fn}. You showed up and stayed. That's more than most. Keep going!`,
  ]),
  milestone15:  (fn: string) => pick([
    `Fifteen minutes ${fn}! You're locked in now. Ride this wave — don't break it.`,
    `${fn}, 15 minutes of real study done. You're in the zone. Stay there.`,
  ]),
  milestone30:  (fn: string) => pick([
    `${fn}, thirty minutes of solid studying. Genuinely impressive — I mean that.`,
    `Half an hour ${fn}! Thirty whole minutes. Your future self is already thanking you.`,
  ]),
  milestone60:  (fn: string) => pick([
    `One hour ${fn}. One full hour. I don't say this lightly — that is exceptional work.`,
    `${fn}! One hour. ONE HOUR. Bro, you are built for this. Keep going.`,
  ]),
  milestone90:  (fn: string) => pick([
    `${fn}, ninety minutes. You are genuinely built differently. I'm not even surprised anymore.`,
    `90 minutes ${fn}. That's elite-level dedication. Board exams won't know what hit them.`,
  ]),
  milestone120: (fn: string) => pick([
    `Two hours ${fn}. Two full hours of focused work. Your future self will look back at this day.`,
    `${fn}! Two hours! You've been here with me for two whole hours. I'm honored, honestly.`,
  ]),
  water: (fn: string) => pick([
    `${fn}, quick — when did you last drink water? Your brain is 75% water. Go get some, I'll wait.`,
    `Hey ${fn}, water check! Get up, grab a glass, come back. Your focus will thank you.`,
    `${fn}, hydration time. You literally cannot focus properly when dehydrated. Go drink something now.`,
    `${fn}! Water break. Non-negotiable. I'll be right here when you get back.`,
  ]),
  breakStart: (fn: string) => pick([
    `Break time ${fn}! Step away from the screen, stretch a little. You earned this rest.`,
    `${fn}, real break — don't peek at study material. Your brain needs to decompress. Let it.`,
    `Rest mode ${fn}. Walk around, drink water, look at something far away. Back at it soon!`,
    `${fn}, you worked hard — now rest properly. No phone doom-scrolling though. Just breathe.`,
  ]),
  random: (fn: string) => pick([
    `${fn}, try explaining what you just read out loud. Sounds silly but it seriously works.`,
    `${fn}, you know what separates good students from great ones? They don't quit when it's boring.`,
    `${fn} — NEB toppers didn't have superpowers. They just showed up. Like you're doing right now.`,
    `Hey ${fn}, I've been watching — you're more focused than you give yourself credit for.`,
    `${fn}, one topic at a time. Don't look at everything at once. Just the next page.`,
    `${fn}, every minute here is compounding. Future you is going to be so glad you stayed.`,
    `The ${timePart()} session is lowkey the best one ${fn}. Quiet, focused, effective.`,
    `${fn}, write it down if you're stuck. Pen on paper does something to your brain.`,
    `Hey ${fn} — you're not just studying, you're building a version of yourself. Keep going.`,
    `${fn}, the fact that you're here right now, studying with me — that means something. Don't forget that.`,
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
  const cachedVoiceRef   = useRef<SpeechSynthesisVoice | null>(null);
  const voicesReadyRef   = useRef(false);

  // Keep refs in sync — no render triggered
  useEffect(() => { muteRef.current = muted; }, [muted]);
  useEffect(() => { speechCbRef.current = onSpeechUpdate; }, [onSpeechUpdate]);

  // ── Pre-warm TTS voices on mount ─────────────────────────────────────────
  // Chrome returns an empty voices array on the very first getVoices() call.
  // By listening to voiceschanged immediately, we cache the best voice before
  // speak() is ever called — so the first greeting fires in sync with the bubble.
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

    const hasTTS = !muteRef.current && !!window.speechSynthesis;

    // Show bubble + start animation immediately.
    // The bubble stays open until TTS onend fires — NOT a fixed timer.
    // This guarantees text, animation, and voice are always in sync.
    speechCbRef.current(text, hasTTS);

    if (!hasTTS) {
      // No TTS — clear bubble after 7 s
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
    // Slightly varied rate/pitch per utterance for a more natural, human feel
    utt.rate   = 0.88 + Math.random() * 0.08; // 0.88–0.96
    utt.pitch  = 1.0  + Math.random() * 0.10; // 1.00–1.10
    utt.volume = 0.92;

    const doSpeak = () => {
      const v = cachedVoiceRef.current ?? pickVoice(window.speechSynthesis.getVoices());
      if (v) utt.voice = v;

      // Bubble clears exactly when speech ends — perfect sync
      utt.onend = () => {
        if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
        speechCbRef.current("", false);
      };
      utt.onerror = () => {
        if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
        // TTS failed — keep bubble visible (no animation) for 4 s
        speechCbRef.current(text, false);
        bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 4_000);
      };

      window.speechSynthesis.speak(utt);
    };

    // Safety fallback: if TTS never fires onend (browser bug), clear after 20 s
    bubbleClearTimer.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      speechCbRef.current("", false);
    }, 20_000);

    if (voicesReadyRef.current || window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      // Voices not cached yet — wait for them, then speak
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        cachedVoiceRef.current = pickVoice(window.speechSynthesis.getVoices());
        voicesReadyRef.current = true;
        doSpeak();
      }, { once: true });
    }
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
