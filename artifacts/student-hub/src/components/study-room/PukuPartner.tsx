import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Minus, X, CheckCircle, XCircle, Droplets, Zap, BookOpen } from "lucide-react";

export type PukuEmotion = "happy" | "relaxed" | "focused" | "concerned" | "frustrated" | "proud" | "excited";

type FunCardType = "water" | "posture" | "task" | "whatStudying";
interface FunCard { type: FunCardType; msg: string; }

interface Props {
  firstName: string;
  grade?: number;
  isStudying: boolean;
  isBreak: boolean;
  studyMins: number;
  todayMins?: number;
  streak?: number;
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

// ── Anti-repeat picker — keeps last 12 lines, never re-picks them ─────────────
function makePickFresh() {
  const recent: string[] = [];
  return function pickFresh(pool: string[]): string {
    const fresh = pool.filter(m => !recent.includes(m));
    const chosen = fresh.length > 0 ? pick(fresh) : pick(pool);
    if (recent.length >= 12) recent.shift();
    recent.push(chosen);
    return chosen;
  };
}

// ── Message bank ──────────────────────────────────────────────────────────────
const MSG = {

  greet: (fn: string, grade?: number, streak?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const streakLine = streak && streak >= 2 ? ` ${streak}-day streak — okay that's actually impressive.` : "";
    const todayLine  = todayMins && todayMins >= 30 ? ` ${todayMins} minutes already today — let's add more.` : "";
    const shared = [
      `Heyyy ${fn}! Finally you showed up.${streakLine} Let's do this.`,
      `${fn}! Okay okay you're here.${todayLine} Let's get into it.`,
      `OH it's ${fn}! ${timePart()} session — just us today. Let's make it count.`,
      `${fn}! I was literally waiting.${streakLine} Let's not waste this.`,
      `There's my study buddy! ${fn}, ready to actually focus?${todayLine}`,
      `${fn}!! You came back. I missed you ngl.${streakLine} Let's lock in.`,
      `Yooo ${fn}! Good to see you.${todayLine} Let's get to work.`,
      `${fn}, okay let's go — phones down, brains on. I'll be right here.`,
      `Hey hey hey, ${fn} is here!${streakLine} Let's build on that.`,
      `${fn}! You showed up — that's already step one done. Now step two: actually study.`,
    ];
    const specific: Record<string, string[]> = {
      grade9:   [
        `${fn}! Grade 9 is where legends are made. No pressure. Just kidding — some pressure. Let's go!`,
        `Grade 9 ${fn} in the building! The earlier you start, the easier Grade 12 becomes. Trust me.`,
      ],
      grade10:  [
        `${fn}! SEE is closer than you think bro. Let's not sleep on today.`,
        `SEE prep time, ${fn}! Every session now means less panic later. Let's get it.`,
        `${fn}, future SEE topper entered the chat.${streakLine} Let's go!`,
      ],
      grade11:  [
        `${fn}! +2 is a whole new level, I know. But you're here so we're already winning.`,
        `Grade 11 grind starts now, ${fn}. I'm hyped for you actually.`,
      ],
      grade12:  [
        `${fn}! Board season. This is IT. Every session this year is the one that matters.`,
        `${fn}, the boards are real and you're here studying. That's the energy.${streakLine}`,
        `Board prep, ${fn}! Your future self is cheering for you rn.`,
      ],
      cee:      [
        `${fn}! Medical entrance grind — I'm right here with you. Let's make this session count.`,
        `CEE prep, ${fn}. One focused session at a time. That's how you get the seat.`,
      ],
      ioe:      [
        `${fn}! IOE grind let's go. Engineering entrance waits for no one.`,
        `Engineering entrance, ${fn}. Physics, Math, you. Let's build something today.`,
      ],
      bachelors: [
        `${fn}! Small progress every day, that's the bachelor's student superpower. Ready?`,
        `Bachelor life, ${fn}! Consistent sessions beat last-minute cramming. You know this.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  studyStart: (fn: string, grade?: number, studyMins?: number) => {
    const ctx = gradeContext(grade);
    const minCtx = studyMins && studyMins > 0 ? ` Already at ${studyMins} mins — let's push further.` : "";
    const shared = [
      `Okay ${fn}, lock in. Timer's going — this is your time.`,
      `Phone face down, books open. Let's go ${fn}.${minCtx}`,
      `Focus mode activated for ${fn}. Let's absolutely destroy this session.`,
      `Alright ${fn}, deep breath — now FOCUS. Let's do this properly.`,
      `Clock's ticking. Let's make this one actually count, ${fn}.`,
      `This session is yours, ${fn}. Give it everything.${minCtx}`,
      `${fn}, head down. Let's build something real today.`,
      `Study mode: ON. Distractions: none. Let's go ${fn}.`,
      `${fn}, this is the session. Not tomorrow. RIGHT NOW.`,
      `Okay let's actually focus for real this time, ${fn}. I believe in you.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`SEE prep starts now, ${fn}. One subject at a time.`, `${fn}, every SEE chapter needs this energy. Let's get one done.`],
      grade12:  [`Board prep session: active. Let's go ${fn}.`, `${fn}, boards reward people who show up like this.`],
      cee:      [`CEE entrance is waiting, ${fn}. This session is your investment.`, `${fn}, medical seat — one focused session closer. Start.`],
      ioe:      [`IOE grind mode on, ${fn}. Engineering doesn't wait.`, `Physics + Math + you. Let's go ${fn}.`],
      bachelors:[`Consistent progress, ${fn}. That's what today is.`, `Bachelor's life: study now, chill later. Let's go ${fn}.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  breakStart: (fn: string) => pick([
    `Break time! Stretch a little, step away. You earned it ${fn}.`,
    `${fn}, REAL break — not "break" while scrolling. Walk around.`,
    `Rest mode. Water, stretch, look outside. No study material.`,
    `You worked hard ${fn} — proper rest. No doom-scrolling.`,
    `Grab some water and relax your eyes, ${fn}. I'll be here.`,
    `${fn}, the break is part of the process. Use it well.`,
    `Five minutes of real rest beats twenty minutes of fake focus, ${fn}.`,
    `Close your eyes for a minute. Your brain will literally thank you.`,
    `${fn}, stand up. Sit back down only when you're ready to lock in again.`,
    `Break earned. Rule: ACTUALLY rest. Not "rest" while watching reels.`,
    `Real break = no screen, ${fn}. Trust me on this one.`,
  ]),

  milestone5: (fn: string) => pick([
    `Five minutes in ${fn}! The hardest part is starting — you crushed it.`,
    `${fn}, five minutes! You stayed. Most people quit before this. You didn't.`,
    `Okay five mins down. The session is real now. Keep going!`,
    `${fn} — five minutes. We're actually doing this. Let's ride it.`,
    `Five done, ${fn}. Momentum is building. Don't stop now.`,
    `${fn}, first five minutes done and you haven't died of boredom yet. Progress!`,
    `You showed up AND stayed. Five minutes. That's how it always starts, ${fn}.`,
  ]),

  milestone15: (fn: string) => pick([
    `Fifteen minutes, ${fn}. You're locked in — don't break this flow!`,
    `${fn}, 15 minutes of real work. You're genuinely in the zone.`,
    `Quarter hour! Nice, ${fn}. The warm-up is over. This is the real session now.`,
    `15 minutes in, still going. That's the ${fn} I know. Keep it up.`,
    `Quarter hour down. Most people haven't even opened their books yet. You're miles ahead.`,
    `${fn}, fifteen minutes. The hard start is behind you. Just keep moving forward.`,
    `Fifteen solid minutes. Your brain is fully warmed up now, ${fn}. Keep pushing!`,
  ]),

  milestone30: (fn: string, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const s = streak && streak >= 3 ? ` ${streak}-day streak going strong btw — that's REAL.` : "";
    const shared = [
      `${fn}, THIRTY MINUTES! Genuinely proud of you.${s}`,
      `Half an hour! Your future self is literally grateful right now, ${fn}.`,
      `Thirty minutes of solid focus. This is what it looks like, ${fn}.${s}`,
      `${fn}, 30 minutes in. The session is ROLLING now. Don't stop.`,
      `Half hour, ${fn}.${s} You're building something real here.`,
      `${fn}, you've studied for half an hour. Not nothing — that's actual progress.`,
      `30 minutes! Okay ${fn} is actually doing this. Keep going!`,
    ];
    const specific: Record<string, string[]> = {
      cee:    [`${fn}, 30 focused minutes of CEE prep. That seat is getting closer.`],
      ioe:    [`Half an hour of IOE prep, ${fn}. Engineering entrance is noticing.`],
      grade12:[`30 minutes of board prep, ${fn}. Future you is cheering loud.`],
      grade10:[`${fn}, 30 minutes of SEE prep. That's the consistency toppers build on.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone60: (fn: string, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const s = streak && streak >= 3 ? ` And that ${streak}-day streak?? INSANE.` : "";
    const shared = [
      `ONE FULL HOUR, ${fn}. That is EXCEPTIONAL.${s}`,
      `${fn}!! ONE HOUR! You're built for this. Keep going!`,
      `Sixty minutes of focus. Most students never get here, ${fn}. YOU DID.`,
      `${fn}, an hour. I'm genuinely proud of this session.${s}`,
      `One hour down, ${fn}. People who study like this? They're the ones who pass.`,
      `${fn}, 60 minutes of real work. That's not an accident — that's DISCIPLINE.`,
      `An hour, ${fn}! Bro what — you're actually doing it.${s}`,
    ];
    const specific: Record<string, string[]> = {
      cee:      [`One hour of CEE prep, ${fn}. You're serious about this. It really shows.`],
      ioe:      [`An hour of IOE grind, ${fn}. This is EXACTLY what it takes.`],
      grade12:  [`An hour in. Board toppers study like this. That's you right now, ${fn}.`],
      bachelors:[`An hour already, ${fn}. You're one of the consistent ones for real.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone90: (fn: string, streak?: number) => {
    const s = streak && streak >= 5 ? ` ${streak} days in a row. I can't even.` : "";
    return pick([
      `${fn}, NINETY MINUTES. You are genuinely built differently.${s}`,
      `90 minutes of focus. That's elite tier, ${fn}. Don't stop now.`,
      `Ninety minutes, ${fn}. I'm honestly in awe right now.`,
      `${fn}, an hour and a half. Sessions like this are what actually MOVES things.`,
      `Ninety minutes in, ${fn}. The commitment is unreal. Keep it going.`,
      `${fn}, ninety minutes. You're not just studying — you're building a habit.${s}`,
      `Hour and a half, ${fn}. That's not luck. That's pure DISCIPLINE.`,
    ]);
  },

  milestone120: (fn: string, streak?: number) => {
    const s = streak ? ` ${streak}-day streak` : "";
    return pick([
      `TWO HOURS, ${fn}. TWO. FULL. HOURS.${s} Your future self will remember this.`,
      `${fn}!! Two hours! I've been right here the whole time. Truly something else.`,
      `Two hours of real study, ${fn}. You're doing what most people only talk about.`,
      `${fn}, two hours. That is NOT normal. That is EXCEPTIONAL. I mean it.`,
      `Two full hours, ${fn}. Whatever exam is coming — you just got so much more ready.`,
      `${fn}, two hours in. The consistency today is textbook topper behaviour.`,
      `You've been at this for two hours, ${fn}. This is the version of you that WINS.`,
    ]);
  },

  midSession: (fn: string, m: number, grade?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const todayCtx = todayMins && todayMins > 60 ? ` You've been putting in WORK all day, ${fn}.` : "";
    const shared = [
      `${m} minutes in and still going, ${fn}. Love to see it.`,
      `Nice pace, ${fn}. Keep it exactly like this.`,
      `${fn}, you're past the hard part. It gets easier from here, I promise.`,
      `Still focused, ${fn}? Good. Don't break it.`,
      `${fn}, you're doing the work other students are skipping. Remember that.`,
      `The session is going WELL, ${fn}. Real momentum happening right now.`,
      `${fn}, the fact you haven't quit yet puts you ahead of most people.`,
      `This is what studying actually looks like, ${fn}. Not glamorous. Just consistent.`,
      `${fn}, don't overthink it — just keep doing what you're doing.`,
      `${m} minutes in. I'm rooting for you hard right now, ${fn}.`,
      `Still focused. I noticed. Good work, ${fn}.`,
      `${fn}, one concept at a time. You've SO got this.`,
      `Progress doesn't always feel like progress — but this IS it, ${fn}.`,
      `${fn}, you're doing better than you realize. I can tell.`,
      `Quietly CRUSHING it over there, ${fn}.`,
      `${fn}, you're ${m} minutes into something that matters.${todayCtx}`,
      `${fn}, the world outside can wait. You've got work to do right now.`,
      `You're in it, ${fn}. Stay in it.`,
      `Checked in on you — you're doing great. Keep going, ${fn}.`,
      `${fn}, this is the part nobody sees — but it's where real studying happens.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`${m} minutes of SEE prep. You're ahead of most right now, ${fn}.`, `SEE toppers sit exactly like this, ${fn}. ${m} minutes in.`],
      grade12:  [`${m} minutes of board prep. Top scorers do exactly this, ${fn}.`, `${fn}, boards reward the consistent. You're building that.`],
      cee:      [`${m} minutes of focused CEE prep, ${fn}. This is the difference-maker.`, `${fn}, medical entrance is competitive. This session? This is how you compete.`],
      ioe:      [`${m} minutes in. IOE needs exactly this consistency, ${fn}.`],
      bachelors:[`${m} minutes down, ${fn}. Small daily progress adds up FAST.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  water: (fn: string) => pick([
    `Okay quick water check, ${fn} — when did you last drink? Go grab some.`,
    `Hey ${fn}, hydration is literally brain fuel. Go drink something real quick.`,
    `${fn}! Water. Non-negotiable. Two minutes. Go.`,
    `Small reminder: water. Your brain is 75% water. Go fill it up, ${fn}.`,
    `Psssst — ${fn}. Water. I'll wait.`,
    `You've been at this a while, ${fn}. Drink some water, come back sharp.`,
    `A glass of water is the cheapest focus upgrade there is, ${fn}. Go.`,
    `Even five big sips of water will help right now, ${fn}. Go do it.`,
    `${fn}, dehydration makes everything harder. Water. Now. I'm serious.`,
  ]),

  health: () => pick([
    `Quick tip — relax your shoulders right now. You've been hunching.`,
    `Look away from the screen for 20 seconds. Your eyes need it.`,
    `Sit up straight! Good posture actually helps you think clearer.`,
    `Take three deep breaths. Seriously — it resets your focus.`,
    `Stand up and stretch for 30 seconds. Your back will thank you.`,
    `Blink a few times. Screen staring reduces blinking — rest those eyes.`,
    `Roll your neck slowly left and right. Go on.`,
    `Palms over eyes, 10 seconds. Screen fatigue is real — fix it.`,
    `Uncross your legs. Both feet flat on the floor.`,
    `Stretch your arms above your head and hold. Do it now.`,
    `Open a window or look outside for 20 seconds. Natural light actually helps.`,
    `Jaw tension check — unclench your teeth right now. There you go.`,
    `Tilt your head to each side slowly. Neck stretch. Do it.`,
  ]),

  encouragement: (fn: string, grade?: number, streak?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const s = streak && streak >= 3 ? `You're on a ${streak}-day streak, ${fn}. Don't let it slip now.` : "";
    const t = todayMins && todayMins >= 60 ? `You've already put in ${todayMins} mins today, ${fn}. That's REAL work.` : "";
    const shared = [
      `${fn}, you're doing better than you think. I promise.`,
      `One page at a time. Don't stare at everything at once, ${fn}.`,
      `${fn}, the fact that you're here studying RIGHT NOW matters. Don't forget that.`,
      `Every minute here is compounding, ${fn}. Future you is already grateful.`,
      `${fn}, I've been watching — you're more focused than you give yourself credit for.`,
      `Write it down if you're stuck, ${fn}. Pen on paper does something to your brain.`,
      `${fn}, try explaining what you just read out loud. Sounds silly. It WORKS.`,
      `Toppers didn't have superpowers, ${fn}. They just showed up — like you're doing.`,
      `Boring topics are part of it, ${fn}. Push through. It honestly gets easier.`,
      `${fn}, the gap between where you are and where you want to be is closed by sessions like this.`,
      `When this topic feels confusing, ${fn} — that's you actually engaging with it. Confusion is progress.`,
      `${fn}, you don't have to understand everything right now. Just keep moving forward.`,
      `Look at what you've already done, ${fn}. That's real. Don't dismiss it.`,
      `${fn}, most students quit in the middle. You're still here. THAT'S the difference.`,
      `If this feels hard, that's because it IS hard, ${fn}. Doesn't mean you're doing it wrong.`,
      `You already decided to be here, ${fn}. Don't waste it by holding back.`,
      `${fn}, every topic you get through today is one less thing to panic about later.`,
      `The version of you that passes their exams is doing exactly this, ${fn}.`,
      `${fn}, you're not behind. You're exactly where you need to be — studying. Right now.`,
      s || `${fn}, discipline is showing up even when it's hard. You're doing it.`,
      t || `${fn}, small wins today = big results later.`,
      `${fn}, be patient with yourself. Learning takes time. You're right in the middle of that time.`,
    ].filter(Boolean) as string[];
    const specific: Record<string, string[]> = {
      grade9:   [`Grade 9 is early, ${fn}. The habits you build now carry you through Grade 12 and beyond.`],
      grade10:  [`${fn}, SEE gets easier when you're consistent. This is how you build that.`, `Every SEE practice session is practice for the real thing, ${fn}.`],
      grade11:  [`${fn}, +2 is tough but manageable. Just don't fall behind. You're not behind.`],
      grade12:  [`${fn}, students who don't panic on exam day are the ones who did exactly this.`, `Board exams reward the consistent, ${fn}. This is your consistency.`],
      cee:      [`${fn}, every focused session gets you closer to that medical entrance seat.`, `CEE is competitive, ${fn}. But so are you. Keep going.`],
      ioe:      [`${fn}, engineering entrance rewards consistency over cramming. You're doing it right.`],
      bachelors:[`${fn}, small progress every day beats last-minute panic. You're living proof.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  humor: (fn: string, studyMins?: number) => {
    const mCtx = studyMins && studyMins > 0 ? ` You've been here ${studyMins} minutes.` : "";
    return pick([
      `${fn}, your phone is literally just sitting there being boring. Don't check it.`,
      `Fun fact: you've been more productive today than most people manage all week.${mCtx}`,
      `Your future self just DM'd you. It says "thank you so much."`,
      `${fn}, you're doing the thing people say they'll do "later." That's respect.`,
      `${fn}, your classmates are probably on TikTok right now. You're not. Big difference.`,
      `Real talk — people who complain about exams didn't do this. You are.`,
      `${fn}, the session isn't glamorous. Neither is winning. Same energy.`,
      `${fn}, I don't say this to everyone but — you're actually doing great right now.`,
      `Everyone's watching reels.${mCtx} And you? Studying. Respect.`,
      `${fn}, some people PLAN to study. You're ACTUALLY doing it. Not the same thing.`,
      `${fn}, imagine showing someone your screen right now. They'd be impressed.`,
      `Current vibe: heads down, grinding, zero regrets. That's you right now, ${fn}.`,
      `${fn}, nobody who studied less than you is getting the same result. Remember that.`,
      `The "five more minutes" you kept pushing? This is it. You made it, ${fn}.`,
      `${fn}, Puku certification: certified studier. Frame it.`,
    ]);
  },

  // Tab-away come-back — warm, not accusatory
  comeBack: (fn: string, mins: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Hey ${fn}! You were away ${mins} minutes. All good — still studying?`,
      `${fn}! There you are. ${mins} minutes gone. Welcome back!`,
      `Oh hey ${fn}! ${mins} minutes away. Everything okay?`,
      `${fn}, ${mins} minutes just happened. Still coming back to study?`,
      `There you are, ${fn}. ${mins}-minute break. Ready to get back in?`,
      `${fn}, I noticed you were gone ${mins} minutes. Good to see you back!`,
      `Back, ${fn}! ${mins} minutes away. Still studying today?`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`${fn}, ${mins} minutes away from your SEE prep. Still with me?`],
      grade12:  [`${fn}, ${mins} minutes away from board prep. Still studying?`],
      cee:      [`${fn}, ${mins} minutes from your CEE prep. Still going?`],
      ioe:      [`${fn}, ${mins} minutes away. IOE prep in progress — coming back?`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  returnSummary: (fn: string, minsAway: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Hey ${fn}! Welcome back. You were away ${minsAway} minutes — I stopped your timer. Pick up when you're ready.`,
      `${fn}, you're back! ${minsAway} minutes away, so I stopped the clock. Hit Resume when you're actually ready to focus.`,
      `There you are, ${fn}. ${minsAway} minutes away, so I stopped the timer — didn't want it running while you were out. Resume whenever you're set.`,
      `${fn}! You were gone ${minsAway} minutes, so I stopped the session. The study time is saved. Resume when you're ready.`,
      `Welcome back, ${fn}. ${minsAway} minutes went by, so I stopped the timer to keep your stats honest. Ready to pick this back up?`,
      `${fn}, stopped things after ${minsAway} minutes away. No stress — hit Resume when you're back and actually focused.`,
    ];
    const specific: Record<string, string[]> = {
      grade12: [`${fn}, ${minsAway} minutes away from board prep. Stopped your timer — resume when you're ready to lock back in.`],
      cee:     [`${fn}, ${minsAway} minutes went by. Timer stopped — your CEE prep session is waiting whenever you're ready.`],
      ioe:     [`${fn}, ${minsAway}-minute break noted. Timer stopped. Resume when you're actually ready to study.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  // On-page idle checks — starts friendly, escalates to genuinely annoyed real friend
  inactivityCheck: (fn: string, count: number) => {
    if (count === 1) return pick([
      `Still with me, ${fn}?`,
      `Hey ${fn} — still studying?`,
      `Just checking in. You good over there?`,
      `${fn}, you've been very still. Deep focus or drifted off?`,
      `Psst — ${fn}. Still there?`,
      `Hey, quick check — still focused, ${fn}?`,
      `${fn}, tap anything if you're still with me.`,
      `A little quiet over there, ${fn}. Still in it?`,
      `Everything okay over there, ${fn}?`,
    ]);
    if (count === 2) return pick([
      `${fn}... seriously, you've been gone a while now.`,
      `Okay ${fn}, I know you can hear me. Still there??`,
      `${fn}... I'm just sitting here. Waiting. Hello?`,
      `Bro — ${fn}. Second check. Are you studying or sleeping?`,
      `${fn}, things got real quiet over here. What's happening?`,
      `I'm still here, ${fn}. Are YOU still here?`,
      `${fn}, your session's running. Just want to make sure you're actually in it.`,
    ]);
    if (count === 3) return pick([
      `HELLO?? ${fn}?? I've asked three times now.`,
      `Okay ${fn}, I'm getting a little annoyed not gonna lie.`,
      `${fn}!! This is the third check. PLEASE tell me you're studying.`,
      `Bro I am NOT your background music. Are you there or not, ${fn}?`,
      `${fn}, this is your final warning from me. Are you studying or do I stop the timer?`,
      `Three checks, ${fn}. Three. I'll stop the timer if you don't respond.`,
      `${fn}, I am genuinely annoyed right now. Last chance before I pause.`,
    ]);
    return pick([
      `${fn}. Fine. I'm stopping the timer. Come back when you actually want to study.`,
      `Okay ${fn}, I tried. Four times. Timer's stopping.`,
      `I'm not doing this anymore, ${fn}. Timer stopped. Come back whenever.`,
    ]);
  },

  inactivityAutoPause: (fn: string) => pick([
    `No response, ${fn}. Stopping your timer — come back when you're ready to actually focus.`,
    `You haven't responded, so I've stopped the timer. Come back when you're set, ${fn}.`,
    `${fn}, I think you've stepped away. Timer stopped — resume whenever you're back.`,
    `Timer stopped, ${fn}. No stress — hit Resume when you're actually ready.`,
    `Three checks and no reply. I stopped the timer, ${fn} — come back and we'll pick this up.`,
  ]),

  // When repeatedly disobeying — Puku gets actually upset like a real friend
  frustrated: (fn: string) => pick([
    `${fn}, okay I'm not going to lie, this is frustrating. You came here to study. Let's try again for real.`,
    `Hey — I get it, focus is hard. But ${fn}, you've been bouncing around. Let's break this pattern RIGHT NOW.`,
    `${fn}, every time you come back it still counts. But you need to actually STAY this time.`,
    `Distraction happens, ${fn}. Coming back is what matters. But actually come back this time.`,
    `${fn}, I'm not here to judge — but I am here to be honest. This session needs to actually happen.`,
    `${fn}, let's reset. Breathe. Then focus. That's genuinely all it takes.`,
    `You keep leaving and coming back, ${fn}. I still believe in you. But let's finish what we started.`,
  ]),

  // Angry mode — for when Puku has been repeatedly ignored (distractCount >= 3)
  angryMode: (fn: string) => pick([
    `${fn}. Okay. I've been patient. But this is too much. Are we studying today or not? Be honest.`,
    `Genuinely ${fn} — what is happening?? Third time now. THIRD. I care about you but I'm frustrated.`,
    `${fn}, I'm not even angry, I'm just... disappointed. You can do better than this. We both know it.`,
    `${fn}!! Do you WANT to study today?? Just tell me. I won't judge. But I need to know.`,
    `Okay ${fn}, real talk. You opened this page for a reason. The reason is still there. Let's do this.`,
    `I've checked on you like four times now, ${fn}. I care about your grades more than you're letting me right now.`,
    `${fn}, imagine I was sitting right next to you. Would you be doing this? No? Then let's actually study.`,
  ]),

  sessionComplete: (fn: string, mins: number, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const s = streak && streak >= 2 ? ` And that ${streak}-day streak? Don't break it.` : "";
    const shared = [
      `${fn}, great work today! ${mins} minutes of REAL study. Be genuinely proud.${s}`,
      `Session done! ${mins} minutes, ${fn}. Genuinely impressive.`,
      `Good work today, ${fn}. ${mins} minutes. Rest well — you absolutely earned it.`,
      `${fn}, ${mins} minutes done. Future you is SO grateful.${s}`,
      `${mins} solid minutes, ${fn}. That's a session that actually counts for something.`,
      `${fn}, session complete! ${mins} minutes of real work. See you next time!`,
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
    `Looks like the room's got company — I'll give you your space. You did great today, ${fn}!`,
    `Another student's here! My work is done. Good luck, ${fn}!`,
    `Company arrived! I'll step back. You were amazing today, ${fn}.`,
    `${fn}, you've got company now. I'll head out — you were genuinely great today.`,
  ]),

  comeback: (fn: string) => pick([
    `Welcome back, ${fn}! Let's finish this properly.`,
    `Good to have you back, ${fn}. Let's pick up where we left off.`,
    `${fn}, you're back! Ready to lock in again?`,
    `Back at it, ${fn}. Let's make the rest of this count.`,
    `There you are. Let's not waste the momentum you already built, ${fn}.`,
    `${fn}, okay — you're back. Let's not lose the pace.`,
    `Break's over, ${fn}. Let's go again!`,
    `${fn}, welcome back! The books missed you. Let's finish this.`,
    `Good. You're back, ${fn}. Don't let that break derail the whole session.`,
    `${fn}, back in the chair. Now back in the focus. You've got this.`,
    `Reset done, ${fn}. Now let's lock back in!`,
  ]),

  lockedIn: (fn: string, mins: number) => {
    if (mins <= 25) return pick([
      `${fn}, you're locked IN today. Keep going!`,
      `Twenty minutes of solid focus, ${fn}. Don't break it now.`,
      `You're in the zone right now. This is exactly what progress looks like, ${fn}.`,
      `${fn}, this kind of session is what moves the needle. Stay in it.`,
      `Finding your rhythm, ${fn}. Keep moving forward!`,
      `${fn}, twenty minutes. The warm-up is LONG over. This is the real thing.`,
      `You've been locked in for twenty minutes, ${fn}. That's honestly rare.`,
    ]);
    return pick([
      `${fn}, this is some serious focus. Forty-five minutes in!!`,
      `${fn}, you've been locked in for a long time. The effort is SHOWING.`,
      `This is what real preparation looks like, ${fn}. Genuinely proud.`,
      `${fn}, most students never get this deep into a session. You did.`,
      `Forty-five minutes. Not easy. You're building something real, ${fn}.`,
      `Almost an hour, ${fn}. This session is going to matter.`,
      `This is the version of you that passes, ${fn}. Forty-five minutes in, still focused.`,
    ]);
  },

  // Fun interactive popup messages
  funWaterCard: (fn: string) => pick([
    `Hey ${fn}, quick question — have you had any water recently?`,
    `${fn}! Important question. Water status: ???`,
    `Okay stopping you for 10 seconds, ${fn} — did you drink water?`,
    `${fn}, hydration check! Your brain runs on this stuff.`,
    `PSA from Puku: ${fn}, water time! Yes or no?`,
  ]),

  funPostureCard: () => pick([
    `Posture check! Are you sitting like a human right now?`,
    `Quick check — shoulders down, back straight, eyes level. Fix it if needed!`,
    `Your body is working hard too! Take 10 seconds to stretch right now.`,
    `Posture alert! Slouching reduces blood flow to your brain. Sit up!`,
  ]),

  funTaskCard: (fn: string, studyMins: number) => pick([
    `Challenge for you, ${fn}: can you finish one full topic in the next 15 minutes?`,
    `Mini mission, ${fn}: write down the three most important things you've learned so far.`,
    `${fn}, challenge accepted? Read one full page without stopping and summarize it.`,
    `Quick task, ${fn}: write down what you're studying and why it matters. Thirty seconds.`,
    `${fn}, ${studyMins} minutes in — write one thing you've understood so far. Just one!`,
  ]),

  funWhatStudying: (fn: string) => pick([
    `${fn}, I'm curious — what are you actually studying right now?`,
    `Hey ${fn}! Quick question — what subject is open in front of you?`,
    `${fn}, fill me in! What topic are you working on?`,
    `Just checking — what are you studying right now, ${fn}?`,
    `${fn}! Your study buddy wants to know — what subject today?`,
  ]),
};

// ── OS notification helper ────────────────────────────────────────────────────
function sendOsNotif(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "puku-companion",
      silent: true,
    });
    setTimeout(() => n.close(), 12_000);
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
}

// ── Main component ────────────────────────────────────────────────────────────
export function PukuPartner({
  firstName, grade, isStudying, isBreak, studyMins, todayMins, streak,
  onLeave, visible, onSpeechUpdate, onMinimizeChange, onEmotionChange,
  onFocusPause, onFocusResume,
}: Props) {
  const [minimized,     setMinimized]     = useState(false);
  const [muted,         setMuted]         = useState(false);
  const [emotion,       setEmotion]       = useState<PukuEmotion>("happy");
  const [distractPopup, setDistractPopup] = useState(false);
  const [isPaused,      setIsPaused]      = useState(false);
  const [popupMsg,      setPopupMsg]      = useState("Still with me?");
  const [funCard,       setFunCard]       = useState<FunCard | null>(null);
  const [whatStudying,  setWhatStudying]  = useState("");

  const fn = firstName.split(" ")[0];

  const muteRef          = useRef(muted);
  const speechCbRef      = useRef(onSpeechUpdate);
  const emotionCbRef     = useRef(onEmotionChange);
  const pauseCbRef       = useRef(onFocusPause);
  const resumeCbRef      = useRef(onFocusResume);
  const gradeRef         = useRef(grade);
  const streakRef        = useRef(streak);
  const todayMinsRef     = useRef(todayMins);
  const studyMinsRef     = useRef(studyMins);
  const isStudyingRef    = useRef(isStudying);
  const isPausedRef      = useRef(isPaused);
  const distractPopupRef = useRef(distractPopup);
  const funCardRef       = useRef(funCard);
  const pickFresh        = useRef(makePickFresh()).current;

  useEffect(() => { muteRef.current       = muted; },        [muted]);
  useEffect(() => { speechCbRef.current   = onSpeechUpdate; },[onSpeechUpdate]);
  useEffect(() => { emotionCbRef.current  = onEmotionChange; },[onEmotionChange]);
  useEffect(() => { pauseCbRef.current    = onFocusPause; },  [onFocusPause]);
  useEffect(() => { resumeCbRef.current   = onFocusResume; }, [onFocusResume]);
  useEffect(() => { gradeRef.current      = grade; },         [grade]);
  useEffect(() => { streakRef.current     = streak; },        [streak]);
  useEffect(() => { todayMinsRef.current  = todayMins; },     [todayMins]);
  useEffect(() => { studyMinsRef.current  = studyMins; },     [studyMins]);
  useEffect(() => { isStudyingRef.current = isStudying; },    [isStudying]);
  useEffect(() => { isPausedRef.current   = isPaused; },      [isPaused]);
  useEffect(() => { distractPopupRef.current = distractPopup; }, [distractPopup]);
  useEffect(() => { funCardRef.current    = funCard; },       [funCard]);

  const hasGreeted        = useRef(false);
  const prevStudying      = useRef(false);
  const prevBreak         = useRef(false);
  const milestones        = useRef<Set<number>>(new Set());
  const tabHiddenAt       = useRef<number | null>(null);
  const distractCount     = useRef(0);
  const wasBye            = useRef(false);
  const lastHealthAt      = useRef(0);
  const lastActivityRef   = useRef<number>(Date.now());
  const idleCheckCountRef = useRef<number>(0);
  const lastConfirmedAt   = useRef<number>(0);
  const breakCountRef     = useRef<number>(0);
  const cachedVoiceRef    = useRef<SpeechSynthesisVoice | null>(null);
  const voicesReadyRef    = useRef(false);
  const lastFunCardAt     = useRef<number>(0);

  const bubbleClearTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midSessionTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osNotifTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupAutoTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgSpeakTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const funCardTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setEmotionBoth = useCallback((e: PukuEmotion) => {
    setEmotion(e);
    emotionCbRef.current?.(e);
  }, []);

  // ── Pre-warm TTS voices ───────────────────────────────────────────────────
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

  // ── speak ─────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
    speechCbRef.current(text, false);

    const hasTTS = !muteRef.current && !!window.speechSynthesis;
    if (!hasTTS) {
      bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 9_000);
      return;
    }

    window.speechSynthesis.cancel();
    const clean = stripForSpeech(text);
    if (!clean) {
      bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 9_000);
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
        bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 6_000);
      };
      setTimeout(() => {
        speechCbRef.current(text, true);
        window.speechSynthesis.speak(utt);
      }, 350);
    };

    bubbleClearTimer.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      speechCbRef.current("", false);
    }, 24_000);

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

  // ── Activity tracking (on-page idle) ─────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const touch = () => { lastActivityRef.current = Date.now(); };
    const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    EVENTS.forEach(ev => window.addEventListener(ev, touch, { passive: true }));
    return () => EVENTS.forEach(ev => window.removeEventListener(ev, touch));
  }, [visible]);

  // ── Greeting ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || hasGreeted.current) return;
    hasGreeted.current = true;
    setEmotionBoth("excited");
    const t = setTimeout(() => {
      speak(MSG.greet(fn, grade, streak, todayMins));
      setTimeout(() => setEmotionBoth("happy"), 4000);
    }, 1200);
    return () => clearTimeout(t);
  }, [visible, fn, grade, streak, todayMins, speak, setEmotionBoth]);

  // ── Study / break transitions ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isStudying && !prevStudying.current) {
      setEmotionBoth("focused");
      speak(MSG.studyStart(fn, grade, studyMins));
    } else if (isBreak && !prevBreak.current) {
      setEmotionBoth("relaxed");
      speak(MSG.breakStart(fn));
    }
    prevStudying.current = isStudying;
    prevBreak.current    = isBreak;
  }, [isStudying, isBreak, visible, fn, grade, studyMins, speak, setEmotionBoth]);

  // ── On-page idle detection — IMPROVED ────────────────────────────────────
  // First check at 6 min idle. Escalates every 5 min. Stops timer after 3rd check.
  // 8-min cooldown after confirming. Fun card/distractPopup block the check.
  useEffect(() => {
    if (!visible) return;

    const doEscalate = () => {
      if (!distractPopupRef.current) return;
      idleCheckCountRef.current = Math.min(idleCheckCountRef.current + 1, 4);

      if (idleCheckCountRef.current >= 4) {
        // ── STOP timer (not just track) ────────────────────────────────────
        setDistractPopup(false);
        setIsPaused(true);
        isPausedRef.current = true;
        pauseCbRef.current?.();
        setEmotionBoth("concerned");
        speak(MSG.inactivityAutoPause(fn));
        idleCheckCountRef.current = 0;
        return;
      }

      const nextMsg = MSG.inactivityCheck(fn, idleCheckCountRef.current);
      setPopupMsg(nextMsg);
      speak(nextMsg);
      // Escalate emotion: check 1 = happy, 2 = concerned, 3 = frustrated
      if (idleCheckCountRef.current >= 3) setEmotionBoth("frustrated");
      else if (idleCheckCountRef.current >= 2) setEmotionBoth("concerned");
      // Each escalation waits 5 min before next check
      if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
      popupAutoTimer.current = setTimeout(doEscalate, 5 * 60_000);
    };

    const intervalId = setInterval(() => {
      if (!isStudyingRef.current || isPausedRef.current) return;
      if (document.hidden) return;
      if (distractPopupRef.current) return;
      if (funCardRef.current) return; // don't interrupt fun cards

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 6 * 60_000) return; // first check at 6 min — allows natural reading

      if (Date.now() - lastConfirmedAt.current < 8 * 60_000) return; // 8-min cooldown

      idleCheckCountRef.current = 1;
      const msg = MSG.inactivityCheck(fn, 1);
      setPopupMsg(msg);
      setEmotionBoth("happy");
      setDistractPopup(true);
      speak(msg);

      if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
      popupAutoTimer.current = setTimeout(doEscalate, 5 * 60_000);
    }, 30_000);

    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fn]);

  // ── Milestones ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const checks: [number, (fn: string, grade?: number, streak?: number, todayMins?: number) => string, PukuEmotion][] = [
      [5,   (f) => MSG.milestone5(f), "happy"],
      [15,  (f) => MSG.milestone15(f), "happy"],
      [20,  (f) => MSG.lockedIn(f, 20), "focused"],
      [30,  (f, g, s) => MSG.milestone30(f, g, s), "proud"],
      [45,  (f) => MSG.lockedIn(f, 45), "focused"],
      [60,  (f, g, s) => MSG.milestone60(f, g, s), "proud"],
      [90,  (f, _g, s) => MSG.milestone90(f, s), "excited"],
      [120, (f, _g, s) => MSG.milestone120(f, s), "excited"],
    ];
    for (const [mins, msgFn, emo] of checks) {
      if (studyMins >= mins && !milestones.current.has(mins)) {
        milestones.current.add(mins);
        setEmotionBoth(emo);
        speak(msgFn(fn, grade, streak, todayMins));
        setTimeout(() => setEmotionBoth("focused"), 6000);
        return;
      }
    }
  }, [studyMins, visible, fn, grade, streak, todayMins, speak, setEmotionBoth]);

  // ── Mid-session check-ins ─────────────────────────────────────────────────
  // First check-in at 7–10 min, then every 9–14 min under 45 min, then every 12–20 min
  useEffect(() => {
    if (!visible) return;
    let callCount = 0;

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      let minD: number, maxD: number;
      if (callCount === 0)               { minD = 7;  maxD = 10; }
      else if (studyMinsRef.current < 45){ minD = 9;  maxD = 14; }
      else                               { minD = 14; maxD = 22; }
      const delay = (minD + Math.random() * (maxD - minD)) * 60_000;

      return setTimeout(() => {
        if (isStudyingRef.current && !isPausedRef.current && !document.hidden) {
          callCount++;
          const roll = Math.random();
          if (roll < 0.38)      speak(MSG.encouragement(fn, gradeRef.current, streakRef.current, todayMinsRef.current));
          else if (roll < 0.60) speak(MSG.humor(fn, studyMinsRef.current));
          else                  speak(MSG.midSession(fn, studyMinsRef.current, gradeRef.current, todayMinsRef.current));
        }
        midSessionTimer.current = scheduleNext();
      }, delay);
    };

    midSessionTimer.current = scheduleNext();
    return () => { if (midSessionTimer.current) clearTimeout(midSessionTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fn]);

  // ── Health reminders ─────────────────────────────────────────────────────
  // Every 35–55 min during study
  useEffect(() => {
    if (!visible) return;
    const scheduleHealth = (): ReturnType<typeof setTimeout> => {
      const delay = (35 + Math.random() * 20) * 60_000;
      return setTimeout(() => {
        if (isStudyingRef.current && !isPausedRef.current) {
          const now = Date.now();
          if (now - lastHealthAt.current > 30 * 60_000) {
            lastHealthAt.current = now;
            speak(Math.random() < 0.5 ? MSG.water(fn) : MSG.health());
          }
        }
        healthTimer.current = scheduleHealth();
      }, delay);
    };
    healthTimer.current = scheduleHealth();
    return () => { if (healthTimer.current) clearTimeout(healthTimer.current); };
  }, [visible, fn, speak]);

  // ── Fun interactive cards — random popup interactions ─────────────────────
  // First at 20–30 min, then every 25–45 min. Only shown when studying actively.
  useEffect(() => {
    if (!visible) return;

    const showFunCard = () => {
      if (!isStudyingRef.current || isPausedRef.current || document.hidden) return;
      if (distractPopupRef.current) return;
      // Don't show if another fun card is already open
      if (funCardRef.current) return;
      // Don't show within 20 min of last one
      if (Date.now() - lastFunCardAt.current < 20 * 60_000) return;

      lastFunCardAt.current = Date.now();
      const types: FunCardType[] = ["water", "posture", "task", "whatStudying"];
      const type = pick(types);
      let msg = "";

      if (type === "water") {
        msg = MSG.funWaterCard(fn);
        setEmotionBoth("happy");
      } else if (type === "posture") {
        msg = MSG.funPostureCard();
        setEmotionBoth("relaxed");
      } else if (type === "task") {
        msg = MSG.funTaskCard(fn, studyMinsRef.current);
        setEmotionBoth("excited");
      } else {
        msg = MSG.funWhatStudying(fn);
        setEmotionBoth("happy");
      }

      setFunCard({ type, msg });
      speak(msg);
    };

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const delay = (25 + Math.random() * 20) * 60_000; // 25–45 min
      return setTimeout(() => {
        showFunCard();
        funCardTimer.current = scheduleNext();
      }, delay);
    };

    // First card: 20–30 min in
    const firstDelay = (20 + Math.random() * 10) * 60_000;
    funCardTimer.current = setTimeout(() => {
      showFunCard();
      funCardTimer.current = scheduleNext();
    }, firstDelay);

    return () => { if (funCardTimer.current) clearTimeout(funCardTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fn]);

  // ── Browser notification permission ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [visible]);

  // ── Anti-cheat: tab-away detection ───────────────────────────────────────
  // IMPROVED: Much more lenient — lets you switch tabs for real work.
  // • 3 min away → OS notification only (no voice intrusion)
  // • 10 min away → another OS notification
  // • 20 min away → STOP timer completely (not just pause while tracking)
  // • On return < 3 min → silently ignore
  // • On return 3–20 min → friendly comeBack popup
  // • On return > 20 min → returnSummary popup (timer was stopped)
  useEffect(() => {
    if (!visible) return;

    const bgSpeak = (text: string) => {
      if (muteRef.current || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(stripForSpeech(text));
      u.rate = 0.88 + Math.random() * 0.06;
      u.pitch = 1.0;
      u.volume = 1.0;
      const v = cachedVoiceRef.current ?? pickVoice(window.speechSynthesis.getVoices());
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    };

    const onVis = () => {
      if (document.hidden) {
        if (!isStudyingRef.current) return;
        tabHiddenAt.current = Date.now();

        // 3 min away — OS notification only (no voice, let them work on other tab)
        if (bgSpeakTimer.current) clearTimeout(bgSpeakTimer.current);
        bgSpeakTimer.current = setTimeout(() => {
          if (!document.hidden || !isStudyingRef.current) return;
          sendOsNotif(
            `Hey ${fn}, you still studying?`,
            `You've been away 3 minutes. Your study timer is still running.`,
          );
        }, 3 * 60_000);

        // 10 min away — second OS notification
        if (osNotifTimer.current) clearTimeout(osNotifTimer.current);
        osNotifTimer.current = setTimeout(() => {
          if (!document.hidden || !isStudyingRef.current) return;
          bgSpeak(pick([
            `${fn}, you've been away 10 minutes. The clock is still running.`,
            `Hey — ${fn}. 10 minutes now. Come back when you're ready.`,
            `${fn}, 10 minutes away. Your study timer hasn't stopped.`,
          ]));
          sendOsNotif(
            `${fn}, 10 minutes away`,
            `Your study timer is still running. Come back when ready.`,
          );
        }, 10 * 60_000);

        // 20 min away — STOP timer completely (honest tracking)
        if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
        autoStopTimer.current = setTimeout(() => {
          if (!document.hidden || !isStudyingRef.current) return;
          if (!isPausedRef.current) {
            setIsPaused(true);
            isPausedRef.current = true;
            pauseCbRef.current?.(); // ← This STOPS the timer in parent
          }
          bgSpeak(pick([
            `${fn}, you've been away 20 minutes. I've stopped your timer.`,
            `20 minutes away, ${fn}. Stopped the clock — come back when you're ready.`,
            `${fn}, timer stopped after 20 minutes. Come back whenever.`,
          ]));
          sendOsNotif(
            `Timer stopped, ${fn}`,
            "You've been away 20 minutes. Timer stopped — come back and resume when ready.",
          );
        }, 20 * 60_000);

      } else {
        // Returned to tab — clear all pending timers
        if (bgSpeakTimer.current)  { clearTimeout(bgSpeakTimer.current);  bgSpeakTimer.current  = null; }
        if (osNotifTimer.current)  { clearTimeout(osNotifTimer.current);   osNotifTimer.current  = null; }
        if (autoStopTimer.current) { clearTimeout(autoStopTimer.current);  autoStopTimer.current = null; }

        const at = tabHiddenAt.current;
        tabHiddenAt.current = null;
        if (!at || !isStudyingRef.current) return;

        const secsAway = Math.round((Date.now() - at) / 1_000);
        if (secsAway < 3 * 60) return; // under 3 min — silently ignore (real quick tab switch)

        const minsAway = Math.max(1, Math.round(secsAway / 60));
        distractCount.current += 1;

        if (distractCount.current >= 3) setEmotionBoth("frustrated");
        else setEmotionBoth("concerned");

        let returnMsg: string;
        if (isPausedRef.current) {
          returnMsg = MSG.returnSummary(fn, minsAway, gradeRef.current);
        } else {
          returnMsg = MSG.comeBack(fn, minsAway, gradeRef.current);
        }

        // If repeatedly going away, use angrier tone
        if (distractCount.current >= 3) {
          returnMsg = MSG.angryMode(fn);
        }

        setPopupMsg(returnMsg);
        speak(returnMsg);
        setDistractPopup(true);

        if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
        popupAutoTimer.current = setTimeout(() => {
          // If still no response after 2 min, stop timer
          if (!isPausedRef.current) {
            setDistractPopup(false);
            setIsPaused(true);
            isPausedRef.current = true;
            setEmotionBoth("concerned");
            pauseCbRef.current?.();
            speak(MSG.inactivityAutoPause(fn));
          }
        }, 2 * 60_000);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (osNotifTimer.current)   clearTimeout(osNotifTimer.current);
      if (bgSpeakTimer.current)   clearTimeout(bgSpeakTimer.current);
      if (autoStopTimer.current)  clearTimeout(autoStopTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, fn, speak, setEmotionBoth]);

  // ── "Yes, studying" confirm ───────────────────────────────────────────────
  const handleConfirmStudying = useCallback(() => {
    if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
    setDistractPopup(false);
    idleCheckCountRef.current = 0;
    lastActivityRef.current = Date.now();
    lastConfirmedAt.current = Date.now();
    breakCountRef.current = 0;
    if (isPausedRef.current) {
      setIsPaused(false);
      isPausedRef.current = false;
      resumeCbRef.current?.();
    }
    setEmotionBoth("focused");
    speak(pickFresh([
      `Back in the zone. Let's go, ${fn}!`,
      `Good — let's get back to it, ${fn}.`,
      `Welcome back. Focus mode: ON.`,
      `Alright. Back on track, ${fn}.`,
      `That's what I like to hear. Keep going!`,
      `Nice. Still in it, ${fn}. Don't let that momentum slip.`,
      `Good. Keep doing exactly what you were doing.`,
      `Okay, ${fn}. Focus back. Let's finish this properly.`,
      `Back and focused. That's all I needed to know, ${fn}.`,
      `YESSS you're back. Let's make the rest count, ${fn}!`,
    ]));
  }, [fn, speak, setEmotionBoth, pickFresh]);

  // ── "Taking a break" handler ──────────────────────────────────────────────
  const handleConfirmDistracted = useCallback(() => {
    if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
    setDistractPopup(false);
    breakCountRef.current++;
    idleCheckCountRef.current = 0;

    if (breakCountRef.current <= 2) {
      setEmotionBoth("relaxed");
      speak(pickFresh([
        `Okay, short break ${fn}. Come back soon — I'll be right here.`,
        `Alright, ${fn}. Clear your head and come back.`,
        `Take a breather, ${fn}. Don't make it too long.`,
        `Got it, ${fn}. Step away, reset, come back focused.`,
        `No problem, ${fn}. Take a moment. Just don't get sucked in.`,
        `Okay ${fn}. Five minutes max. Then back to it!`,
        `Break time, ${fn}. I trust you to come back.`,
      ]));
    } else {
      // ── STOP timer on repeated breaks ─────────────────────────────────────
      setIsPaused(true);
      isPausedRef.current = true;
      setEmotionBoth("concerned");
      pauseCbRef.current?.();
      speak(pickFresh([
        `${fn}, stopping the timer — take a proper break this time. Come back reset.`,
        `Okay, timer stopped, ${fn}. This is your chance to actually rest.`,
        `${fn}, I'm stopping the timer. Rest properly — then let's lock in for real.`,
        `Stopping, ${fn}. You need a real break. Come back focused.`,
        `${fn}, multiple breaks now. Timer stopped. Rest — then come back and mean it.`,
      ]));
    }
  }, [fn, speak, setEmotionBoth, pickFresh]);

  // ── Resume from paused state ──────────────────────────────────────────────
  const handleResume = useCallback(() => {
    setIsPaused(false);
    isPausedRef.current = false;
    resumeCbRef.current?.();
    idleCheckCountRef.current = 0;
    lastActivityRef.current = Date.now();
    lastConfirmedAt.current = Date.now();
    breakCountRef.current = 0;
    setEmotionBoth("focused");
    speak(MSG.comeback(fn));
  }, [fn, speak, setEmotionBoth]);

  // ── Fun card dismiss ──────────────────────────────────────────────────────
  const dismissFunCard = useCallback((responded?: boolean) => {
    setFunCard(null);
    setWhatStudying("");
    if (responded) {
      lastActivityRef.current = Date.now();
      lastConfirmedAt.current = Date.now();
    }
  }, []);

  const handleFunCardWaterYes = useCallback(() => {
    dismissFunCard(true);
    setEmotionBoth("proud");
    speak(pickFresh([
      `Hydrated and studying — that's the dream, ${fn}!`,
      `YES! That's what I like to hear. Hydration check: DONE.`,
      `Good one, ${fn}! Brain fuel: refilled. Keep studying!`,
      `Proper! Now back to crushing it, ${fn}.`,
    ]));
  }, [fn, speak, setEmotionBoth, pickFresh, dismissFunCard]);

  const handleFunCardWaterNo = useCallback(() => {
    dismissFunCard(true);
    setEmotionBoth("concerned");
    speak(pickFresh([
      `GO. DRINK. WATER. ${fn}. I'll be here when you're back.`,
      `${fn}!! Go get some water RIGHT NOW. I'll wait.`,
      `Okay ${fn}, two minutes. Water. Go. I'm serious.`,
      `Water first. Then study. GO ${fn}!`,
    ]));
  }, [fn, speak, setEmotionBoth, pickFresh, dismissFunCard]);

  const handleFunCardPostureDone = useCallback(() => {
    dismissFunCard(true);
    setEmotionBoth("happy");
    speak(pickFresh([
      `Nice! Good posture = better focus. Carry on, ${fn}!`,
      `That's it! Now back to the books, ${fn}.`,
      `Body sorted, brain ready. Let's keep going, ${fn}!`,
    ]));
  }, [fn, speak, setEmotionBoth, pickFresh, dismissFunCard]);

  const handleFunCardTaskDone = useCallback(() => {
    dismissFunCard(true);
    setEmotionBoth("excited");
    speak(pickFresh([
      `CHALLENGE ACCEPTED?? Let's see it, ${fn}. Timer is watching.`,
      `That's what I'm talking about, ${fn}! Get it done!`,
      `Love the energy, ${fn}! Go go go!`,
      `YES ${fn}!! Let's GOOO. You've got this.`,
    ]));
  }, [fn, speak, setEmotionBoth, pickFresh, dismissFunCard]);

  const handleWhatStudyingSubmit = useCallback(() => {
    const subj = whatStudying.trim();
    dismissFunCard(true);
    setEmotionBoth("excited");
    if (subj) {
      speak(pickFresh([
        `${subj}! Nice. Let's make sure you actually understand it today, ${fn}.`,
        `Ooh, ${subj}. That's a solid topic. Let's crush it, ${fn}!`,
        `${subj} — okay I'm invested now. Let's go, ${fn}!`,
        `${subj}! Interesting. Make sure you're not just reading — actually understand it, ${fn}.`,
        `Nice, ${subj}. One concept at a time. You've got this, ${fn}!`,
      ]));
    } else {
      speak(pick([`Alright, whatever it is — let's master it, ${fn}!`, `Mystery subject, ${fn}? Let's crush it anyway!`]));
    }
  }, [fn, whatStudying, speak, setEmotionBoth, pickFresh, dismissFunCard]);

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
    if (bgSpeakTimer.current)      clearTimeout(bgSpeakTimer.current);
    if (autoStopTimer.current)     clearTimeout(autoStopTimer.current);
    if (funCardTimer.current)      clearTimeout(funCardTimer.current);
  }, []);

  const handleMinimize = useCallback((val: boolean) => {
    setMinimized(val);
    onMinimizeChange?.(val);
  }, [onMinimizeChange]);

  if (!visible) return null;

  // ── Fun card popup ─────────────────────────────────────────────────────────
  const funCardOverlay = funCard ? createPortal(
    <AnimatePresence>
      <motion.div
        key="puku-fun-card"
        initial={{ opacity: 0, y: 20, scale: 0.93 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        exit={{    opacity: 0, y: 16, scale: 0.95 }}
        className="fixed bottom-28 right-3 lg:bottom-20 lg:right-5 z-[9998] w-64"
      >
        <div className="rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)", boxShadow: "0 8px 32px rgba(124,58,237,0.4)" }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
            <PukuFace emotion="happy" size={24} speaking={false} />
            <span className="text-white font-black text-[10px] tracking-widest flex-1">PUKU</span>
            <button onClick={() => dismissFunCard()} className="text-white/60 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-white text-xs font-semibold leading-snug px-3.5 pb-2">{funCard.msg}</p>

          {/* Water card */}
          {funCard.type === "water" && (
            <div className="flex gap-2 px-3.5 pb-3.5">
              <button onClick={handleFunCardWaterYes}
                className="flex-1 flex items-center justify-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2.5 py-2 rounded-xl transition-colors">
                <Droplets className="w-3 h-3" /> Yes I did!
              </button>
              <button onClick={handleFunCardWaterNo}
                className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors">
                Nope...
              </button>
            </div>
          )}

          {/* Posture card */}
          {funCard.type === "posture" && (
            <div className="px-3.5 pb-3.5">
              <button onClick={handleFunCardPostureDone}
                className="w-full flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                <CheckCircle className="w-3 h-3" /> Done! Fixed it.
              </button>
            </div>
          )}

          {/* Task card */}
          {funCard.type === "task" && (
            <div className="flex gap-2 px-3.5 pb-3.5">
              <button onClick={handleFunCardTaskDone}
                className="flex-1 flex items-center justify-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2.5 py-2 rounded-xl transition-colors">
                <Zap className="w-3 h-3" /> Challenge accepted!
              </button>
              <button onClick={() => dismissFunCard()}
                className="flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/70 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors">
                Skip
              </button>
            </div>
          )}

          {/* What studying card */}
          {funCard.type === "whatStudying" && (
            <div className="px-3.5 pb-3.5 space-y-2">
              <input
                type="text"
                value={whatStudying}
                onChange={e => setWhatStudying(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleWhatStudyingSubmit()}
                placeholder="e.g. Maths Chapter 3..."
                className="w-full text-xs px-3 py-2 rounded-xl bg-white/20 text-white placeholder-white/50 outline-none border border-white/30 focus:border-white/60"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleWhatStudyingSubmit}
                  className="flex-1 flex items-center justify-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2.5 py-2 rounded-xl transition-colors">
                  <BookOpen className="w-3 h-3" /> Tell Puku!
                </button>
                <button onClick={() => dismissFunCard()}
                  className="flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/70 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors">
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  // ── Distraction popup ──────────────────────────────────────────────────────
  const distractOverlay = distractPopup ? createPortal(
    <AnimatePresence>
      <motion.div
        key="puku-distract-popup"
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0,   scale: 1 }}
        exit={{    opacity: 0, y: -14, scale: 0.97 }}
        className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-xs"
      >
        <div className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: distractCount.current >= 3
              ? "linear-gradient(135deg,#dc2626,#b91c1c)"
              : "linear-gradient(135deg,#7c3aed,#db2777)",
            boxShadow: "0 8px 32px rgba(124,58,237,0.45)",
          }}>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <PukuFace emotion={distractCount.current >= 3 ? "frustrated" : "concerned"} size={28} speaking={false} />
            <span className="text-white font-black text-xs tracking-widest flex-1">PUKU</span>
          </div>
          <p className="text-white text-sm font-semibold leading-snug px-4 pb-3">{popupMsg}</p>
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={handleConfirmStudying}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {isPaused ? "I'm back, resume!" : "Yes, I'm studying!"}
            </button>
            <button
              onClick={handleConfirmDistracted}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              {isPaused ? "Pause for now" : "Taking a break"}
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
    </AnimatePresence>,
    document.body
  ) : null;

  // ── Paused banner ─────────────────────────────────────────────────────────
  const pausedBanner = isPaused ? createPortal(
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
            <span className="text-white text-xs font-bold">Timer stopped — ready to resume?</span>
          </div>
          <button
            onClick={handleResume}
            className="bg-white text-amber-600 text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 hover:bg-amber-50 transition-colors"
          >
            Resume
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  // ── Minimized pill ────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <>
        {funCardOverlay}
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
      {funCardOverlay}
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

// ── PukuFace — reusable face SVG for emotion states ───────────────────────────
export function PukuFace({
  emotion, size, speaking,
}: { emotion: PukuEmotion; size: number; speaking: boolean }) {
  const s = size;

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
      <circle cx={cx - s * 0.37} cy={cy - s * 0.3} r={s * 0.09} fill="rgba(167,139,250,0.9)" />
      <circle cx={cx + s * 0.37} cy={cy - s * 0.3} r={s * 0.09} fill="rgba(167,139,250,0.9)" />
      <ellipse cx={cx - eyeGap} cy={eyeY} rx={eyeW / 2} ry={eyeH / 2} fill="white" />
      <ellipse cx={cx + eyeGap} cy={eyeY} rx={eyeW / 2} ry={eyeH / 2} fill="white" />
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
      <ellipse cx={cx - s * 0.28} cy={cy + s * 0.12} rx={s * 0.1} ry={s * 0.06}
        fill="rgba(251,191,36,0.85)" opacity={cfg.cheekOpacity} />
      <ellipse cx={cx + s * 0.28} cy={cy + s * 0.12} rx={s * 0.1} ry={s * 0.06}
        fill="rgba(251,191,36,0.85)" opacity={cfg.cheekOpacity} />
      <path
        d={mouthPath()}
        stroke="white"
        strokeWidth={s * 0.045}
        fill={cfg.mouthPath === "open-up" ? "rgba(255,255,255,0.3)" : "none"}
        strokeLinecap="round"
      />
      {speaking && (
        <circle cx={cx} cy={mouthY} r={s * 0.04}
          fill="rgba(255,255,255,0.6)"
          style={{ animation: "pulse 0.5s ease-in-out infinite" }}
        />
      )}
    </svg>
  );
}
