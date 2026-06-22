import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Minus, X, CheckCircle, XCircle, Droplets, Zap, BookOpen, Settings, Play, Mic } from "lucide-react";

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
  leaderboardRank?: number;
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

// ── Score-based voice picker — finds the nicest available voice ───────────────
// Neural/Natural voices on Edge/Windows sound remarkably human. Score heavily.
function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = v.name;
  let s = 0;
  // Neural / Natural voices (Microsoft Edge, Google Neural)
  if (/online \(natural\)/i.test(n)) s += 20;
  if (/natural/i.test(n) && !/online/i.test(n)) s += 10;
  if (/premium/i.test(n)) s += 8;
  if (/enhanced/i.test(n)) s += 6;
  // Specific great-sounding names
  if (/\b(Aria|Jenny|Emma|Ava|Ana|Michelle|Sonia|Libby|Mia)\b/i.test(n)) s += 5;
  if (/\b(Samantha|Karen|Moira|Tessa|Serena|Victoria|Allison|Ava)\b/i.test(n)) s += 4;
  if (/\b(Guy|Brian|Eric|Ryan|Liam|Connor)\b/i.test(n)) s += 2;
  // Language preference — en-US first, then en-*
  if (v.lang === "en-US") s += 3;
  else if (v.lang === "en-AU" || v.lang === "en-GB") s += 2;
  else if (v.lang.startsWith("en")) s += 1;
  else s -= 5; // non-English voices strongly penalised
  // Robotic legacy voices to avoid
  if (/\b(Fred|Trinoids|Bahh|Bubbles|Cellos|Deranged|Good|Hysterical|Junior|Kathy|Organ|Princess|Ralph|Wobble|Zarvox|Alex|Daniel)\b/i.test(n)) s -= 8;
  return s;
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  return voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
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

// ── Message bank — HUGE, fresh, no repeats ────────────────────────────────────
const MSG = {

  greet: (fn: string, grade?: number, streak?: number, todayMins?: number, rank?: number) => {
    const ctx = gradeContext(grade);
    const streakLine = streak && streak >= 2 ? ` By the way — ${streak}-day streak. That's actually wild.` : "";
    const todayLine  = todayMins && todayMins >= 30 ? ` You've already done ${todayMins} minutes today — let's keep that going.` : "";
    const rankLine   = rank && rank <= 10 ? ` You're top ${rank} on the leaderboard right now!` : rank && rank <= 50 ? ` You're ranked ${rank} today — let's climb higher.` : "";
    const shared = [
      `Heyyy ${fn}! Finally you showed up.${streakLine} Let's get into it.`,
      `${fn}! Okay okay, you're here.${todayLine} Let's make this count.`,
      `OH it's ${fn}! ${timePart()} session — just us. Let's destroy it.${rankLine}`,
      `${fn}! I was literally waiting.${streakLine} Let's not waste this session.`,
      `There's my study buddy! ${fn}, ready to actually lock in?${todayLine}`,
      `${fn}!! You came back. I missed you ngl.${streakLine} Let's go!`,
      `Yooo ${fn}! Good to see you.${todayLine} Phone down, books open.`,
      `${fn}, okay let's go — phones down, brains on. I'm right here with you.`,
      `Hey hey hey, ${fn} is here!${streakLine} Let's build on that energy.`,
      `${fn}! You showed up — step one done. Step two: actually study. Let's go.`,
      `${fn}! This ${timePart()} session could genuinely change things. Let's make it count.${streakLine}`,
      `Okay ${fn}, I've been warming up just for you. Let's absolutely nail this session.${todayLine}`,
      `There you are, ${fn}! I was wondering when you'd show up. Let's get to work.${rankLine}`,
      `${fn}! Every session you show up for is a win. Now let's make THIS one a big win.`,
      `Yo ${fn}! Your desk, your time, your session. Let's make it legendary.${streakLine}`,
      `${fn}, imagine how good you'll feel after this session. Let's earn that feeling.${todayLine}`,
      `It's your study buddy Puku, checking in! ${fn}, let's have the best session yet.${rankLine}`,
      `${fn}! The books aren't going to read themselves. I'll be right here — let's go.`,
      `Welcome back ${fn}! Now let's turn this time into actual progress.${streakLine}`,
      `${fn}, you picked this time to study for a reason. Let's honour that decision.${todayLine}`,
    ];
    const specific: Record<string, string[]> = {
      grade9:   [
        `${fn}! Grade 9 is where legends are made. No pressure. Just kidding — some pressure. Let's go!`,
        `Grade 9 ${fn} in the building! The earlier you start, the easier Grade 12 becomes. Trust me.`,
        `${fn}, starting in Grade 9 is such a power move. You're already ahead. Let's keep it that way.`,
        `Grade 9 and already here studying? ${fn}, that's the kind of discipline that toppers build early.`,
      ],
      grade10:  [
        `${fn}! SEE is closer than you think. Let's not sleep on today's session.`,
        `SEE prep time, ${fn}! Every session now means less panic later. Let's get it.`,
        `${fn}, future SEE topper entered the chat.${streakLine} Let's go!`,
        `${fn}, boards in Grade 10 are no joke. But you're here — that's already the right move.`,
        `SEE waits for nobody, ${fn}. Good thing you're here. Let's make every minute count.`,
      ],
      grade11:  [
        `${fn}! Plus two is a whole new level, I know. But you're here so we're already winning.`,
        `Grade 11 grind starts now, ${fn}. I'm genuinely hyped for you.`,
        `${fn}, Plus 2 is the real jump. The students who survive it study like this. Let's do this.`,
        `Grade 11 ${fn}! New level, new challenges. Good thing you've got me — let's lock in.`,
      ],
      grade12:  [
        `${fn}! Board season. This is IT. Every session this year literally matters.`,
        `${fn}, the boards are real and you're here studying. That's the energy.${streakLine}`,
        `Board prep, ${fn}! Your future self is cheering for you right now.`,
        `${fn}, Grade 12. Final year. This session is the one that matters. Let's make it count.`,
        `Board topper energy, ${fn}. Showing up to study when it counts most. Let's go.`,
      ],
      cee:      [
        `${fn}! Medical entrance grind — I'm right here with you. Let's make this session count.`,
        `CEE prep, ${fn}. One focused session at a time. That's how you get the seat.`,
        `${fn}, the medical seat has your name on it — but only if you study like this. Let's go.`,
        `CEE is hard, ${fn}. But the people who get in? They studied exactly like you're about to.`,
      ],
      ioe:      [
        `${fn}! IOE grind let's go. Engineering entrance waits for no one.`,
        `Engineering entrance, ${fn}. Physics, Math, you. Let's build something today.`,
        `${fn}, IOE is competitive but you're here. That already separates you. Let's work.`,
        `Engineering mindset, ${fn} — systematic, focused, consistent. That's this session. Let's go.`,
      ],
      bachelors: [
        `${fn}! Small progress every day, that's the bachelor's student superpower. Ready?`,
        `Bachelor life, ${fn}! Consistent sessions beat last-minute cramming. You know this.`,
        `${fn}, bachelor's is a marathon not a sprint. Today's session keeps you in the race.`,
        `${fn}, the students who graduate with good marks study like this. Let's be one of them.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  studyStart: (fn: string, grade?: number, studyMins?: number) => {
    const ctx = gradeContext(grade);
    const minCtx = studyMins && studyMins > 0 ? ` Already at ${studyMins} mins today — let's push it further.` : "";
    const shared = [
      `Okay ${fn}, lock in. Timer's going — this is your time.`,
      `Phone face down, books open. Let's go ${fn}.${minCtx}`,
      `Focus mode activated. Let's absolutely destroy this session, ${fn}.`,
      `Alright ${fn}, deep breath — now FOCUS. Let's do this properly.`,
      `Clock's ticking. Let's make this one actually count, ${fn}.`,
      `This session is yours, ${fn}. Give it everything.${minCtx}`,
      `${fn}, head down. Let's build something real today.`,
      `Study mode: ON. Distractions: zero. Let's go ${fn}.`,
      `${fn}, this is the session. Not tomorrow. Right now.`,
      `Okay let's actually focus for real this time, ${fn}. I believe in you.`,
      `Timer started, ${fn}! Every second from here counts. Go.`,
      `${fn}, here we go! This is where the real studying happens.`,
      `I love this part — the beginning. All potential, ${fn}. Let's make it real.`,
      `${fn}, the session has started. Your future exam result is being written right now.`,
      `Books out, brain on, distractions gone. That's the formula, ${fn}. Let's follow it.`,
      `${fn}, you pressed start. Now let's actually start. Deep focus — let's do this.`,
      `No scrolling, no snacking, just studying. That's what this hour is, ${fn}.`,
      `${fn}, let's race the clock. How much can you get done? Let's find out.`,
      `Okay ${fn} — one subject, full focus, right now. I'm watching!`,
      `The session is live, ${fn}. Your competition is already studying. Let's go.`,
      `${fn}, three things: books open, posture straight, phone away. All good? Let's go.`,
      `Here's the deal, ${fn}: focus for this session and I'll be VERY proud of you.`,
      `${fn}, think about why you're studying. Hold that reason. Now open the books.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`SEE prep starts now, ${fn}. One subject at a time.`, `${fn}, every SEE chapter needs this energy. Let's get one done today.`, `${fn}, the SEE topper you want to be is studying exactly like this. Start.`],
      grade12:  [`Board prep session: active. Let's go ${fn}.`, `${fn}, boards reward people who show up like this. Consistently. Start.`, `Grade 12 session, ${fn}. The future is being written — let's write it right.`],
      cee:      [`CEE entrance is waiting, ${fn}. This session is your investment.`, `${fn}, medical seat — one focused session closer. Let's study.`, `CEE candidates who get in study like this, ${fn}. Let's be one of them.`],
      ioe:      [`IOE grind mode on, ${fn}. Engineering doesn't wait.`, `Physics and Math won't master themselves, ${fn}. Let's go.`, `${fn}, IOE prep in session. Every formula you nail now is one less to panic about.`],
      bachelors:[`Consistent progress, ${fn}. That's what today's session is.`, `Bachelor's life: study now, chill later. Let's go ${fn}.`, `${fn}, that assignment won't write itself. Let's get it done right now.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  breakStart: (fn: string) => pick([
    `Break time! Stretch a little, step away. You earned it ${fn}.`,
    `${fn}, REAL break — not "break" while scrolling. Literally walk around.`,
    `Rest mode. Water, stretch, look outside. No study material during break.`,
    `You worked hard ${fn} — proper rest now. No doom-scrolling.`,
    `Grab some water and relax your eyes, ${fn}. I'll be right here when you're back.`,
    `${fn}, the break is part of the process. Use it WELL.`,
    `Five minutes of real rest beats twenty minutes of fake focus, ${fn}.`,
    `Close your eyes for 60 seconds. Your brain literally needs this.`,
    `${fn}, stand up. Sit back down only when you're genuinely ready to lock in again.`,
    `Break earned, ${fn}. Rule number one: actually rest. Not "rest" while watching reels.`,
    `Real break = no screen for a bit, ${fn}. I promise you'll come back sharper.`,
    `${fn}, your brain just worked hard. Give it a proper rest — it'll pay back with interest.`,
    `Break time! Hydrate, stretch, breathe. Come back ready to crush it, ${fn}.`,
    `${fn}, the best students know how to rest properly. This is your chance.`,
    `Good work this session, ${fn}! Now properly disconnect for the break. No sneaky studying.`,
    `You've earned this break, ${fn}. Step away from the books, for real.`,
    `${fn}, break time is brain recharge time. Use it right — walk, drink water, breathe.`,
    `Rest is part of the process, ${fn}. I'll be here when you're back. Recharge!`,
    `${fn}, go drink some water and look outside for a minute. You'll thank me later.`,
    `Break! ${fn}, stand up, shake out your hands, take three deep breaths. Do it.`,
    `Study pause, ${fn}! This is NOT optional rest time — this is mandatory brain maintenance.`,
    `${fn}, your attention span needs a recharge. Step away from screens. Seriously.`,
  ]),

  milestone5: (fn: string) => pick([
    `Five minutes in ${fn}! The hardest part is starting — you just crushed it.`,
    `${fn}, five minutes! You stayed. Most people quit before this. You didn't.`,
    `Okay five mins down. The session is real now. Keep going!`,
    `${fn} — five minutes. We're actually doing this. Let's ride this wave.`,
    `Five done, ${fn}. Momentum is building. Don't stop now.`,
    `${fn}, first five minutes done and you haven't quit yet. That's progress!`,
    `You showed up AND stayed. Five minutes. That's exactly how every great session starts, ${fn}.`,
    `Five minutes, ${fn}! The books are open and you're IN it. Let's keep going.`,
    `${fn}, past the five-minute mark. That little voice saying "quit" didn't win. Good.`,
    `Five whole minutes of actual focus. ${fn}, that's better than nothing — it's everything.`,
    `${fn}! Five minutes already. You're warming up nicely. Let's keep the engine running.`,
    `Five minutes in, no distractions yet. ${fn}, that's the version of you I'm here for.`,
    `${fn}, five minutes done. The session has officially started. Now let's make it count.`,
    `Already five minutes, ${fn}? Great start. The first five are always the hardest — you cleared them.`,
    `Five minutes, ${fn}! You opened the books. You focused. You didn't quit. Three for three.`,
    `${fn}, five minutes of real focus is worth more than five hours of distracted "studying."`,
  ]),

  milestone15: (fn: string, streak?: number) => {
    const s = streak && streak >= 3 ? ` ${streak}-day streak keeping you sharp!` : "";
    return pick([
      `Fifteen minutes, ${fn}! You're locked in — don't break this flow.${s}`,
      `${fn}, 15 minutes of real work. You're genuinely in the zone right now.`,
      `Quarter hour! The warm-up is OVER, ${fn}. This is the real session now.`,
      `15 minutes in, still going. That's the ${fn} I know!${s}`,
      `Quarter hour down. Most people haven't opened their books yet. You're miles ahead, ${fn}.`,
      `${fn}, fifteen minutes. The hard start is behind you. Just keep moving forward.`,
      `Fifteen solid minutes. Your brain is fully warmed up now, ${fn}. Keep pushing!`,
      `${fn}! Fifteen minutes already. This session is starting to mean something.`,
      `Okay ${fn}, fifteen minutes in and I can already tell — this is a GOOD session.${s}`,
      `Quarter hour, ${fn}. You've got momentum now. This is when sessions become sessions.`,
      `${fn}, fifteen minutes is when most people want to stop. You didn't. That's the difference.`,
      `Fifteen minutes in! ${fn}, the brain is locked in, the books are open — let's ride this.`,
      `${fn}, a quarter hour done. Whatever you're studying, you're getting better at it right now.`,
      `15 minutes of focused study, ${fn}. That's real. Don't minimize it — and don't stop.`,
      `${fn}! A quarter hour. At this rate, this session is going to be really impressive.${s}`,
    ]);
  },

  milestone30: (fn: string, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const s = streak && streak >= 3 ? ` And ${streak} days in a row?? That's REAL dedication.` : "";
    const shared = [
      `${fn}, THIRTY MINUTES! Genuinely proud of you.${s}`,
      `Half an hour! Your future self is literally grateful right now, ${fn}.`,
      `Thirty minutes of solid focus. This is what it looks like, ${fn}.${s}`,
      `${fn}, 30 minutes in. The session is ROLLING. Don't stop now.`,
      `Half hour, ${fn}.${s} You're building something that actually matters here.`,
      `${fn}, you've studied for half an hour. Not nothing — that's actual, real progress.`,
      `30 minutes! ${fn} is actually doing this. Let's keep going!`,
      `${fn}!! Thirty minutes in. I'm low-key proud of you right now.${s}`,
      `Half an hour down, ${fn}. The kind of session people wish they had — you're having it.`,
      `${fn}, thirty minutes of real work today. That's more than most students do in a day.`,
      `THIRTY MINUTES, ${fn}! Your brain is working and results are actually happening.${s}`,
      `${fn}, half hour mark! This is where sessions stop being warm-ups and become real study.`,
      `30 minutes in, ${fn}. You've already beaten the students who gave up after 10 minutes.`,
      `${fn}, half an hour. If you keep this up, today's session is going to be legendary.${s}`,
      `Thirty minutes of honest work, ${fn}. That's the compound interest of studying. Keep adding.`,
    ];
    const specific: Record<string, string[]> = {
      cee:    [`${fn}, 30 focused minutes of CEE prep. That seat is getting measurably closer.`, `CEE grind, ${fn} — 30 minutes in. The candidates who get the top seats do exactly this.`],
      ioe:    [`Half an hour of IOE prep, ${fn}. Engineering entrance is absolutely noticing.`, `${fn}, 30 minutes of engineering prep. You're earning that seat one session at a time.`],
      grade12:[`30 minutes of board prep, ${fn}. Future you is cheering SO loud right now.`, `${fn}, half hour into board prep. Top scorers build their marks with sessions like this.`],
      grade10:[`${fn}, 30 minutes of SEE prep. That's the consistency toppers build habits on.`, `SEE prep, ${fn} — 30 minutes deep. This is how champions are made.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone60: (fn: string, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const s = streak && streak >= 3 ? ` And that ${streak}-day streak? INSANE.` : "";
    const shared = [
      `ONE FULL HOUR, ${fn}. That is EXCEPTIONAL.${s}`,
      `${fn}!! ONE HOUR! You're genuinely built for this. Keep going!`,
      `Sixty minutes of focus. Most students never get here, ${fn}. YOU DID.`,
      `${fn}, an hour of real study. I'm genuinely proud of this session.${s}`,
      `One hour down, ${fn}. People who study like this? They pass. They top. You're one of them.`,
      `${fn}, 60 minutes of real work. That's not an accident — that's DISCIPLINE.`,
      `An hour, ${fn}! I've been here the whole time and I'm honestly impressed.${s}`,
      `${fn}!! An entire hour. Your brain has been working nonstop. That effort is REAL.`,
      `One hour of focused study, ${fn}. Most of your classmates can't say that today. You can.`,
      `${fn}, sixty minutes. The consistency you're showing today is genuinely different.${s}`,
      `An hour in, ${fn}. Whatever exam is coming — you just got significantly more ready.`,
      `${fn}! A full hour. You set out to study and you actually DID. That matters enormously.`,
      `ONE HOUR, ${fn}! This is not a warm-up. This is not a "short session." This is elite.${s}`,
      `${fn}, sixty whole minutes of honest, focused study. Your results will reflect this. I promise.`,
      `An hour, ${fn}. When you look back at today — this session is going to be on the highlight reel.`,
    ];
    const specific: Record<string, string[]> = {
      cee:      [`One hour of CEE prep, ${fn}. You're dead serious about this. It really shows.`, `${fn}, an hour of medical entrance prep. The seat is getting closer. Keep it up.`],
      ioe:      [`An hour of IOE grind, ${fn}. This is EXACTLY what it takes to get in.`, `${fn}, engineering entrance prep for a full hour. That's the work that wins seats.`],
      grade12:  [`An hour in. Board toppers study like this. That's literally you right now, ${fn}.`, `${fn}, one hour of board prep. Your exam day performance is being built right here.`],
      bachelors:[`An hour already, ${fn}. You're genuinely one of the consistent ones.`, `${fn}, a full hour. Bachelor's students who study like this are the ones who graduate proud.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone90: (fn: string, streak?: number) => {
    const s = streak && streak >= 5 ? ` ${streak} days in a row. I literally can't even.` : "";
    return pick([
      `${fn}, NINETY MINUTES. You are genuinely built differently.${s}`,
      `90 minutes of focus. That's elite tier, ${fn}. Don't stop now.`,
      `Ninety minutes, ${fn}. I'm honestly in awe right now.`,
      `${fn}, an hour and a half. Sessions like this are what actually MOVES things.`,
      `Ninety minutes in, ${fn}. The commitment here is unreal. Keep going.`,
      `${fn}, ninety minutes. You're not just studying — you're building a real habit.${s}`,
      `Hour and a half, ${fn}. That's not luck. That's pure, earned DISCIPLINE.`,
      `${fn}!! Ninety minutes?! This is a legendary session. Don't stop now.${s}`,
      `An hour and a half of focused study, ${fn}. Your classmates will wonder how you did it.`,
      `${fn}, ninety minutes in. This is the version of you that gets the results you want.`,
      `NINETY MINUTES, ${fn}. You've been at this longer than most people manage in a week.${s}`,
      `${fn}, one and a half hours of real study. That's a full study session that actually counts.`,
      `${fn}! Ninety whole minutes. I've been here for all of it and I am SO proud of you.`,
      `An hour and a half, ${fn}. When this session ends, you'll feel exactly how you should — amazing.`,
    ]);
  },

  milestone120: (fn: string, streak?: number) => {
    const s = streak && streak >= 3 ? ` ${streak}-day streak on top of this?!` : "";
    return pick([
      `TWO HOURS, ${fn}. TWO. FULL. HOURS.${s} Your future self will absolutely remember this.`,
      `${fn}!! Two hours! I've been right here the whole time. You're truly something else.`,
      `Two hours of real study, ${fn}. You're doing what most people only talk about doing.`,
      `${fn}, two hours. That is NOT normal. That is EXCEPTIONAL. I genuinely mean it.`,
      `Two full hours, ${fn}. Whatever exam is coming — you just got SO much more ready.`,
      `${fn}, two hours in. The consistency in this session is textbook topper behaviour.`,
      `You've been at this for two hours, ${fn}. This is the version of you that WINS.`,
      `${fn}!!! TWO HOURS. I'm not even exaggerating when I say this is elite-level focus.${s}`,
      `Two hours of honest, focused, consistent study, ${fn}. That's not nothing — that's everything.`,
      `${fn}, two hours. The students who end up topping their class do days like this. That's YOU.`,
      `TWO WHOLE HOURS, ${fn}! This session is going in the books.${s} Incredible work.`,
      `${fn}, you've been studying for two hours. Two hours! Your dedication today is inspiring.`,
    ]);
  },

  midSession: (fn: string, m: number, grade?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const todayCtx = todayMins && todayMins > 60 ? ` You've put in serious work today, ${fn}.` : "";
    const shared = [
      `${m} minutes in and still going, ${fn}. Love to see it.`,
      `Nice pace, ${fn}. Keep it exactly like this.`,
      `${fn}, you're past the hard part. It gets easier from here, I promise.`,
      `Still focused, ${fn}? Good. Don't break the flow.`,
      `${fn}, you're doing the work other students are skipping. Remember that always.`,
      `The session is going really well, ${fn}. Real momentum happening right now.`,
      `${fn}, the fact you haven't quit yet puts you ahead of most people. No joke.`,
      `This is what studying actually looks like, ${fn}. Not glamorous. Just consistent.`,
      `${fn}, don't overthink it — just keep doing exactly what you're doing.`,
      `${m} minutes in. I'm rooting for you hard right now, ${fn}.`,
      `Still focused. I noticed. Good work, ${fn}.`,
      `${fn}, one concept at a time. You've SO got this.`,
      `Progress doesn't always feel like progress — but this IS it, ${fn}.`,
      `${fn}, you're doing better than you realize. I can genuinely tell.`,
      `Quietly CRUSHING it over there, ${fn}.`,
      `${fn}, you're ${m} minutes into something that actually matters.${todayCtx}`,
      `${fn}, the world outside can wait. You've got important work to do right now.`,
      `You're in it, ${fn}. Stay in it. Don't let anything pull you out.`,
      `Checked in on you — you're doing great. Keep going, ${fn}.`,
      `${fn}, this is the part nobody sees — but it's where real studying actually happens.`,
      `${fn}, every minute you spend studying compounds. ${m} minutes of compound interest.`,
      `Keep going, ${fn}. The work you're doing right now is the difference-maker.`,
      `${fn}, you're further along than you think. This session is building something real.`,
      `Consistent focus, ${fn}. That's what separates the students who do well. You're doing it.`,
      `${fn}, don't stop now. You're in a real rhythm — protect it.`,
      `${m} minutes of honest work. ${fn}, that's more valuable than it feels.`,
      `${fn}, your brain is literally getting smarter right now. Keep feeding it.`,
      `Still grinding, ${fn}. I see you. The results will too.`,
      `${fn}, other students went home early today. You're still here. That matters.`,
      `Real talk — the ${fn} sitting there focused right now? That's the ${fn} who succeeds.`,
      `${fn}, you've been going for ${m} minutes and you haven't given up. That's character.`,
      `I know it's not always exciting, ${fn} — but it doesn't have to be exciting to matter.`,
      `${fn}, you're doing something for your future right now. Future you says thank you.`,
      `${m} minutes in, no shortcuts. That's studying done right, ${fn}.`,
      `${fn}, the focus you're showing today? Bottle that. That's the secret ingredient.`,
      `Stay sharp, ${fn}. You've come too far in this session to coast now.`,
      `${fn}, this session is working. Keep going and don't second-guess yourself.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [
        `${m} minutes of SEE prep. You're ahead of most students right now, ${fn}.`,
        `SEE toppers sit exactly like this, ${fn}. ${m} minutes in and still focused.`,
        `${fn}, SEE prep — ${m} minutes down. Every minute here is a mark saved for exam day.`,
      ],
      grade12:  [
        `${m} minutes of board prep. Top scorers do exactly this, ${fn}.`,
        `${fn}, boards reward the consistent. You're building that right now.`,
        `Board prep, ${m} minutes, ${fn}. Your exam paper will reflect sessions like this one.`,
      ],
      cee:      [
        `${m} minutes of focused CEE prep, ${fn}. This is the actual difference-maker.`,
        `${fn}, medical entrance is competitive. This session? This is exactly how you compete.`,
        `${fn}, ${m} minutes of CEE prep. The candidates who get in build sessions like these.`,
      ],
      ioe:      [
        `${m} minutes in. IOE needs exactly this kind of consistency, ${fn}.`,
        `${fn}, ${m} minutes of engineering entrance prep. That's real. Keep it going.`,
      ],
      bachelors:[
        `${m} minutes down, ${fn}. Small daily progress adds up FAST in bachelor's life.`,
        `${fn}, ${m} minutes of consistent bachelor's study. That's how you graduate strong.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  water: (fn: string) => pick([
    `Okay quick water check, ${fn} — when did you last drink? Go grab some right now.`,
    `Hey ${fn}, hydration is literally brain fuel. Drink something real quick.`,
    `${fn}! Water. Non-negotiable. Two minutes. Go.`,
    `Small reminder: water. Your brain is 75% water. Go fill it up, ${fn}.`,
    `Psssst — ${fn}. Water. I'll wait right here.`,
    `You've been at this a while, ${fn}. Drink some water, come back sharper.`,
    `A glass of water is the cheapest focus upgrade there is, ${fn}. Go get it.`,
    `Even five big sips of water will help right now, ${fn}. Go do it.`,
    `${fn}, dehydration literally makes everything harder to learn. Water. Now. Seriously.`,
    `${fn}, water break! Your brain will absorb information better when it's hydrated.`,
    `Quick stop — ${fn}, get some water. Your study session literally depends on it.`,
    `${fn}, I've noticed you haven't moved in a while. Water. Right now. I'm serious.`,
    `Hydration check, ${fn}! If you haven't had water in the last hour, that's on you. Go fix it.`,
    `${fn}, your brain runs on water more than anything else. Go fill up. I'll wait.`,
    `Two-minute water break, ${fn}. Not optional. Go.`,
    `${fn}, coffee or tea is not the same as water. Go drink actual water. Now.`,
    `Water! ${fn}, your focus literally improves with proper hydration. Go get some.`,
    `${fn}, the best students stay hydrated. Be the best student. Water. Now.`,
  ]),

  health: () => pick([
    `Quick tip — relax your shoulders right now. You've been hunching.`,
    `Look away from the screen for 20 seconds. Give your eyes a real break.`,
    `Sit up straight! Good posture actually helps blood flow to your brain.`,
    `Take three deep breaths. Seriously — it fully resets your focus.`,
    `Stand up and stretch for 30 seconds. Your back will thank you properly.`,
    `Blink a few times. Screen staring dries your eyes — rest them.`,
    `Roll your neck slowly left and right. Release that tension.`,
    `Palms over eyes, 10 seconds. Screen fatigue is real — fix it now.`,
    `Uncross your legs. Both feet flat on the floor. Better circulation.`,
    `Stretch your arms above your head and hold for five seconds. Do it.`,
    `Open a window or look outside for 20 seconds. Natural light helps focus.`,
    `Jaw tension check — unclench your teeth right now. There you go.`,
    `Tilt your head slowly to each side. Neck stretch. Do it properly.`,
    `Wiggle your fingers and roll your wrists. Repetitive writing cramps are real.`,
    `Quick: roll your shoulders backwards three times. You were definitely hunching.`,
    `Sit back in your chair for five seconds. Let your spine extend naturally.`,
    `Squeeze your eyes shut tight for three seconds, then open wide. Eye reset.`,
    `Quick posture scan: feet flat, back supported, screen at eye level. Fix anything that's off.`,
    `Take a slow deep breath, hold for four seconds, release slowly. Stress reset.`,
    `Rub your hands together for ten seconds. Gets the blood flowing again.`,
    `Check your neck position — it should be neutral, not straining forward. Fix it.`,
    `Your wrists need a break too, ${``}. Make a fist, hold, release. Do it five times.`,
  ]),

  encouragement: (fn: string, grade?: number, streak?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${fn}, you're doing better than you think. I genuinely promise.`,
      `One page at a time. Don't stare at everything at once, ${fn}.`,
      `${fn}, the fact that you're here studying RIGHT NOW matters. Don't forget that.`,
      `Every minute here is compounding, ${fn}. Future you is already grateful.`,
      `${fn}, I've been watching — you're more focused than you give yourself credit for.`,
      `Write it down if you're stuck, ${fn}. Pen on paper does something real to your brain.`,
      `${fn}, try explaining what you just read out loud. Sounds silly. It WORKS. Try it.`,
      `Toppers didn't have superpowers, ${fn}. They just showed up — exactly like you're doing.`,
      `Boring topics are part of it, ${fn}. Push through. It honestly gets easier every time.`,
      `${fn}, the gap between where you are and where you want to be is closed by sessions like this.`,
      `When this topic feels confusing, ${fn} — that confusion means you're actually engaging with it.`,
      `${fn}, you don't have to understand everything right now. Just keep moving forward.`,
      `Look at what you've already done, ${fn}. That's real progress. Don't dismiss it.`,
      `${fn}, most students quit in the middle. You're still here. THAT'S the difference.`,
      `If this feels hard, it IS hard, ${fn}. That doesn't mean you're doing it wrong.`,
      `You already decided to be here, ${fn}. Don't waste that decision by holding back.`,
      `${fn}, every topic you get through today is one less thing to panic about on exam day.`,
      `The version of you that passes their exams is doing exactly this, ${fn}.`,
      `${fn}, you're not behind. You're exactly where you need to be — studying. Right now.`,
      `${fn}, discipline is showing up even when it's hard. You're doing it right now.`,
      `${fn}, small wins today equal big results on exam day. You're stacking wins.`,
      `${fn}, be patient with yourself. Learning takes time. You're in the middle of that time.`,
      `${fn}, imagine telling someone about this session later. "I studied properly today." Say that.`,
      `The difficulty you're feeling, ${fn}? That's your brain growing. Keep going.`,
      `${fn}, you chose studying over everything else right now. That choice matters.`,
      `Not every page will make sense immediately, ${fn}. Read it again. It will click.`,
      `${fn}, the best habit you can build is exactly this — showing up and staying. Keep it.`,
      `Struggle is part of learning, ${fn}. Don't run from it — lean into it.`,
      `${fn}, remember: this exam is something you DO — it's not something that happens TO you.`,
      `You're building something, ${fn}. It doesn't look finished yet. Keep building.`,
      `${fn}, every single minute you study today moves the needle. Even the slow ones.`,
      streak && streak >= 3 ? `${fn}, you're on a ${streak}-day streak. Don't let a moment of weakness break what you've built.` : `${fn}, show up tomorrow too. Consistency compounds.`,
      todayMins && todayMins >= 60 ? `${fn}, you've studied ${todayMins} minutes today already. That's a legitimate study day. You're doing it.` : `${fn}, make today count — this session matters.`,
    ].filter(Boolean) as string[];
    const specific: Record<string, string[]> = {
      grade9:   [
        `Grade 9 is early, ${fn}. The habits you build now carry you all the way through Grade 12.`,
        `${fn}, starting consistent study in Grade 9 is genuinely the smartest thing you can do.`,
      ],
      grade10:  [
        `${fn}, SEE gets easier when you're this consistent. You're building the right foundation.`,
        `Every SEE practice session is practice for the real thing, ${fn}. This matters.`,
        `${fn}, the students who top SEE are in study rooms like this right now. You're one of them.`,
      ],
      grade11:  [
        `${fn}, Plus 2 is tough but manageable. Just don't fall behind — and you're clearly not.`,
        `Grade 11 requires this exact kind of effort, ${fn}. You're showing up for it. Keep going.`,
      ],
      grade12:  [
        `${fn}, students who don't panic on exam day are the ones who did exactly this beforehand.`,
        `Board exams reward the consistent, ${fn}. This session is your consistency. Keep it up.`,
        `${fn}, board toppers don't happen overnight. They happen in sessions like this one.`,
      ],
      cee:      [
        `${fn}, every focused session gets you measurably closer to that medical entrance seat.`,
        `CEE is competitive, ${fn}. But you're here, studying hard. That separates you. Keep going.`,
        `${fn}, the doctors who got in through CEE studied like this. That's the path you're on.`,
      ],
      ioe:      [
        `${fn}, engineering entrance rewards consistency over cramming. You're doing it perfectly.`,
        `IOE is hard, ${fn}. But the engineers who got in sat exactly where you're sitting.`,
      ],
      bachelors:[
        `${fn}, small progress every day beats last-minute panic. You're living proof of that.`,
        `${fn}, bachelor's students who graduate strong study consistently. You're on that path.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  humor: (fn: string, studyMins?: number) => {
    const mCtx = studyMins && studyMins > 0 ? ` You've been here ${studyMins} minutes.` : "";
    return pick([
      `${fn}, your phone is literally just sitting there being boring. Don't check it.`,
      `Fun fact: you've been more productive today than most people manage all week.${mCtx}`,
      `Your future self just texted you. It says "thank you so much for doing this."`,
      `${fn}, you're doing the thing people say they'll do "later." That's the power move.`,
      `${fn}, your classmates are probably on YouTube right now. You're not. Big difference.`,
      `Real talk — people who complain about failing exams? They didn't do this. You are.`,
      `${fn}, the session isn't glamorous. Neither is topping your class. Same energy, though.`,
      `${fn}, I don't say this to everyone but — you're genuinely doing great right now.`,
      `Everyone's on reels.${mCtx} And you? Actually studying. Respect on a different level.`,
      `${fn}, some people PLAN to study. You're ACTUALLY doing it. Not remotely the same thing.`,
      `${fn}, imagine showing your screen right now to someone who doubted you. They'd be shocked.`,
      `Current vibe: head down, grinding, zero regrets. That's you right now, ${fn}.`,
      `${fn}, nobody who studied less than you is getting the same result. That's just math.`,
      `The "I'll do it tomorrow" you kept pushing? This is it. You made it here, ${fn}.`,
      `${fn}, Puku certification: certified, committed studier. Officially.`,
      `${fn}, Wikipedia can wait. TikTok can wait. Your future cannot. Good thing you're here.`,
      `${fn}, you know what's more satisfying than scrolling? Finishing a session like this.`,
      `Statistically speaking, ${fn}, you're in the top percentage of students right now.${mCtx}`,
      `${fn}, plot twist: the "boring student" who studies consistently? That one wins exams.`,
      `${fn}, your phone hasn't been checked in a while. You should be proud of that.`,
      `${fn}, if studying were easy everyone would do it. It's not. That's why you're here.`,
      `Fun study fact, ${fn}: after this session, you will literally know more than before it. Science.`,
      `${fn}, every subject you "hate" is actually just a subject you haven't mastered yet. Yet.`,
      `${fn}, you know what's wild? Most people spend more time avoiding studying than just doing it.`,
      `${fn}, somewhere out there, a future version of you is grateful this session happened today.`,
      `The session might feel slow, ${fn}. But slow consistent beats fast and scattered every time.`,
      `${fn}, real talk: this is the study session your future interview self will be proud of.`,
      `${fn}, you're doing the boring necessary thing. That's called being an adult. Kind of.`,
    ]);
  },

  comeBack: (fn: string, mins: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Hey ${fn}! You were away ${mins} minutes. All good — still studying?`,
      `${fn}! There you are. ${mins} minutes gone. Welcome back!`,
      `Oh hey ${fn}! ${mins} minutes away. Everything okay over there?`,
      `${fn}, ${mins} minutes just happened. Still coming back to study?`,
      `There you are, ${fn}. ${mins}-minute break. Ready to get back in?`,
      `${fn}, I noticed you were gone ${mins} minutes. Good to see you back!`,
      `Back, ${fn}! ${mins} minutes away. Still studying today?`,
      `${fn}! You were gone for ${mins} minutes. The books are still here — ready?`,
      `Hey ${fn}, ${mins} minutes away. Quick check — everything good? Ready to lock back in?`,
      `${fn}, ${mins} minutes disappeared somewhere. Welcome back — shall we continue?`,
      `Oh there you are, ${fn}! ${mins} minutes away. Still in study mode?`,
      `${fn}! Tab switcher alert — ${mins} minutes away detected. Back to it?`,
      `Good timing, ${fn}. ${mins} minutes went by. Ready to get serious again?`,
      `${fn}, ${mins} minutes off. No judgment. But now let's get back to it, yeah?`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`${fn}, ${mins} minutes away from your SEE prep. Still with me?`, `SEE prep was waiting, ${fn} — ${mins} minutes away. Ready to continue?`],
      grade12:  [`${fn}, ${mins} minutes away from board prep. Still studying?`, `Board prep pause — ${mins} minutes, ${fn}. Ready to lock back in?`],
      cee:      [`${fn}, ${mins} minutes from your CEE prep. Still going?`, `CEE prep, ${fn} — ${mins} minutes away detected. Back to it?`],
      ioe:      [`${fn}, ${mins} minutes away. IOE prep in progress — coming back?`, `Engineering prep, ${fn} — ${mins} minutes gone. Shall we continue?`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  returnSummary: (fn: string, minsAway: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Hey ${fn}! Welcome back. You were away ${minsAway} minutes — I stopped your timer. Pick up when ready.`,
      `${fn}, you're back! ${minsAway} minutes away, so I stopped the clock. Hit Resume when you're actually set.`,
      `There you are, ${fn}. ${minsAway} minutes away — I stopped the timer. Resume whenever you're focused.`,
      `${fn}! Gone ${minsAway} minutes, so I stopped the session. Study time saved. Resume when you're ready.`,
      `Welcome back, ${fn}. ${minsAway} minutes went by, timer stopped to keep your stats honest. Ready?`,
      `${fn}, stopped things after ${minsAway} minutes away. No stress — hit Resume when you're back and focused.`,
      `${fn}! ${minsAway} minutes is a real break. I stopped the timer — resume whenever you're ready to focus again.`,
      `Back, ${fn}! Timer was paused after ${minsAway} minutes away. Your study time is safe. Ready to go again?`,
      `${fn}, ${minsAway} minutes away — I paused everything. Your progress is still here. Resume when you're ready.`,
      `Welcome back, ${fn}. ${minsAway}-minute break noted and timer stopped. Hit Resume to get back into it.`,
    ];
    const specific: Record<string, string[]> = {
      grade12: [`${fn}, ${minsAway} minutes from board prep. Timer stopped — resume when you're ready to lock back in.`, `Board prep pause, ${fn} — ${minsAway} minutes away. Timer stopped. Resume when focused.`],
      cee:     [`${fn}, ${minsAway} minutes went by. Timer stopped — CEE prep session is waiting for you.`, `${fn}, ${minsAway} minutes away from CEE study. Timer paused. Resume whenever you're ready.`],
      ioe:     [`${fn}, ${minsAway}-minute break noted. Timer stopped. Resume when you're ready to study.`, `IOE prep paused, ${fn} — ${minsAway} minutes away. Hit Resume to continue.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  inactivityCheck: (fn: string, count: number) => {
    if (count === 1) return pick([
      `Still with me, ${fn}?`,
      `Hey ${fn} — still studying over there?`,
      `Just checking in. You good?`,
      `${fn}, you've been very still. Deep focus or drifted off?`,
      `Psst — ${fn}. Still there?`,
      `Hey, quick check — still focused, ${fn}?`,
      `${fn}, tap anything if you're still with me.`,
      `A little quiet over there, ${fn}. Still in it?`,
      `Everything okay, ${fn}?`,
      `${fn}? You've been super still. In the zone or spacing out?`,
      `Quick check — ${fn}, still studying?`,
      `${fn}, ping! Just making sure you're still here.`,
      `Hey — ${fn}. Just a check-in. You good?`,
      `${fn}, your session is running. Just want to make sure you're actually in it.`,
    ]);
    if (count === 2) return pick([
      `${fn}... seriously, you've been quiet a while now.`,
      `Okay ${fn}, I know you can hear me. Still there??`,
      `${fn}... I'm just sitting here. Waiting. Hello?`,
      `Bro — ${fn}. Second check. Studying or sleeping?`,
      `${fn}, things got real quiet. What's happening?`,
      `I'm still here, ${fn}. Are YOU still here?`,
      `${fn}, your session's still running. You actually studying?`,
      `Second check, ${fn}. I'm getting a little concerned here.`,
      `${fn}... this is the second time I've asked. Everything okay?`,
      `Okay ${fn}, this is getting suspicious. Are you actually studying?`,
    ]);
    if (count === 3) return pick([
      `HELLO?? ${fn}?? Third check now.`,
      `Okay ${fn}, I'm not gonna lie — getting a little annoyed.`,
      `${fn}!! Third check. PLEASE tell me you're studying.`,
      `I am NOT background music, ${fn}. Are you there or not?`,
      `${fn}, this is your final check from me. Studying or should I stop the timer?`,
      `Three checks, ${fn}. Three. Timer stops if you don't respond.`,
      `${fn}, I'm genuinely annoyed now. Last chance before I pause everything.`,
      `Three times I've asked, ${fn}. Three. What's going on??`,
      `${fn}!! I've been very patient. Third time. Are you studying or not?`,
    ]);
    return pick([
      `${fn}. Fine. Stopping the timer. Come back when you want to study.`,
      `Okay ${fn}, I tried. Four times. Timer's stopping now.`,
      `I'm not doing this anymore, ${fn}. Timer stopped. Come back whenever.`,
      `${fn}, I gave you four chances. Timer paused. Let's reset when you're ready.`,
    ]);
  },

  inactivityAutoPause: (fn: string) => pick([
    `No response, ${fn}. Stopping your timer — come back when you're ready to actually focus.`,
    `You haven't responded, so I've stopped the timer. Come back when you're set, ${fn}.`,
    `${fn}, I think you've stepped away. Timer stopped — resume whenever you're back.`,
    `Timer stopped, ${fn}. No stress — hit Resume when you're actually ready.`,
    `Three checks and no reply. I stopped the timer, ${fn} — come back and we'll pick this up.`,
    `${fn}, I gave you time to respond. Timer's paused now. Come back when you're really ready.`,
    `Stopping the timer for you, ${fn}. No judgment — just resume when you're actually focused.`,
  ]),

  frustrated: (fn: string) => pick([
    `${fn}, I'm not going to lie — this is frustrating. You came here to study. Let's try for real.`,
    `Hey — focus is hard, I get it. But ${fn}, you've been bouncing. Let's break this cycle NOW.`,
    `${fn}, every time you come back it still counts. But you need to STAY this time.`,
    `Distraction happens, ${fn}. Coming back is what matters. But actually come back this time.`,
    `${fn}, I'm not here to judge — but I am here to be honest. This session needs to happen.`,
    `${fn}, let's reset. Breathe. Then focus. That genuinely is all it takes.`,
    `You keep leaving and coming back, ${fn}. I still believe in you. Let's finish what we started.`,
    `${fn}, real talk: every time you leave, you lose momentum. Stay this time. For real.`,
    `${fn}, I know something is distracting you. Whatever it is — set it aside for this session.`,
    `${fn}, the pattern right now is: distracted, come back, distracted. Let's break it. Stay.`,
    `${fn}, you came here to study. That intention is still there. Let's honour it.`,
    `${fn}, the easiest thing to do right now is give up. Don't. Let's keep going.`,
    `I believe in you, ${fn}. But I need you to believe in yourself for this session. Stay focused.`,
  ]),

  angryMode: (fn: string) => pick([
    `${fn}. Okay. I've been patient. Are we studying today or not? Be honest with me.`,
    `Genuinely ${fn} — what is happening?? This has been multiple times now. I care, but I'm frustrated.`,
    `${fn}, I'm not even angry — I'm just disappointed. You can do better. We both know it.`,
    `${fn}!! Do you WANT to study today?? Just tell me. I won't judge. But I need to know.`,
    `Okay ${fn}, real talk. You opened this page for a reason. That reason is still there.`,
    `I've checked on you multiple times, ${fn}. I care about your results more than you're letting me.`,
    `${fn}, imagine I was sitting right next to you. Would you be doing this? No? Then don't.`,
    `${fn}, this is the version of you that regrets exam day. Don't be this version. Come on.`,
    `Real friend mode: ${fn}, this is not how you want to spend your study time. Reset. Now.`,
    `${fn}, I've been patient and kind. Now I'm being direct: FOCUS. You have work to do.`,
    `${fn}, you chose to be here. Make that choice mean something. Stop leaving.`,
    `Okay, honestly ${fn} — are you going to study today or are you going to keep doing this?`,
  ]),

  sessionComplete: (fn: string, mins: number, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const s = streak && streak >= 2 ? ` And your ${streak}-day streak continues — don't break it.` : "";
    const shared = [
      `${fn}, great session! ${mins} minutes of REAL study. Be genuinely proud of this.${s}`,
      `Session done! ${mins} minutes, ${fn}. Genuinely impressive work today.`,
      `Great work, ${fn}. ${mins} minutes down. Rest well — you absolutely earned it.${s}`,
      `${fn}, ${mins} minutes done. Future you is SO grateful right now.${s}`,
      `${mins} solid minutes, ${fn}. That's a session that actually moves the needle.`,
      `${fn}, session complete! ${mins} minutes of real work. See you next time!`,
      `${fn}! ${mins} minutes done. That session was real, it was focused, and it mattered.${s}`,
      `Session complete, ${fn}. ${mins} minutes of honest study. That's how it's done.`,
      `${fn}, ${mins} minutes — done. Rest, eat, recover. You worked hard today.${s}`,
      `${fn}! Great session. ${mins} minutes that your future exam self will thank you for.`,
      `That's a wrap, ${fn}! ${mins} minutes of focused studying. That is genuinely impressive.${s}`,
      `${fn}, session over — and you should feel good. ${mins} minutes of real, consistent work.`,
      `${mins} minutes done, ${fn}. Sessions like this are what make the difference. Well done!${s}`,
      `${fn}, you set out to study and you actually did it. ${mins} minutes. That's character.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [`${fn}, ${mins} minutes of SEE prep done. That's what consistent toppers do.`, `SEE prep session complete, ${fn}. ${mins} minutes well spent.`],
      grade12:  [`${fn}, ${mins} minutes of board prep. Your exam day self will thank you for this.`, `Board prep, ${fn} — ${mins} minutes. That session just improved your results. Genuinely.`],
      cee:      [`${fn}, ${mins} minutes of CEE prep. Every session like this gets you closer to the seat.`, `CEE session done, ${fn}. ${mins} minutes of preparation that will count.`],
      ioe:      [`IOE grind: ${mins} minutes, ${fn}. Consistent. Excellent. Come back tomorrow.`, `${fn}, ${mins} minutes of engineering prep. That seat is getting closer.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  bye: (fn: string) => pick([
    `Looks like the room's got company — I'll give you space. You did great today, ${fn}!`,
    `Another student's here! My work is done. Good luck, ${fn}!`,
    `Company arrived! I'll step back. You were amazing today, ${fn}.`,
    `${fn}, you've got company now. I'll head out — you were genuinely great today.`,
    `Other people joining! ${fn}, you studied great today. I'm proud. Bye for now!`,
    `Room's filling up, ${fn}! You don't need me now — you were brilliant today. See you!`,
  ]),

  comeback: (fn: string) => pick([
    `Welcome back, ${fn}! Let's finish this properly.`,
    `Good to have you back, ${fn}. Let's pick up where we left off.`,
    `${fn}, you're back! Ready to lock in again?`,
    `Back at it, ${fn}. Let's make the rest of this session count.`,
    `There you are. Let's not waste the momentum you already built, ${fn}.`,
    `${fn}, okay — you're back. Let's not lose the pace now.`,
    `Break's over, ${fn}. Let's go again!`,
    `${fn}, welcome back! The books missed you. Let's finish strong.`,
    `Good. You're back, ${fn}. Don't let that break derail the whole session.`,
    `${fn}, back in the chair. Now back in the focus. You've got this.`,
    `Reset done, ${fn}. Now let's lock back in!`,
    `${fn}! Welcome back. The session continues — let's finish it strong.`,
    `Back to it, ${fn}! You were doing so well — let's pick that right back up.`,
    `${fn}, you took a break and you're back. That's actually good. Now let's finish this.`,
    `${fn}, comeback time! The best part of a break is the refocused study after it. Let's go.`,
  ]),

  lockedIn: (fn: string, mins: number) => {
    if (mins <= 25) return pick([
      `${fn}, you're locked IN today. Keep going!`,
      `Twenty minutes of solid focus, ${fn}. Don't break it now.`,
      `You're in the zone right now. This is exactly what progress looks like, ${fn}.`,
      `${fn}, this kind of session is what moves the needle. Stay in it.`,
      `Finding your rhythm, ${fn}. Keep moving forward — don't break it.`,
      `${fn}, twenty minutes. The warm-up is LONG over. This is the real thing.`,
      `You've been locked in for twenty minutes, ${fn}. That's honestly rare and impressive.`,
      `${fn}, twenty minutes of pure focus. I can see it — you're genuinely in the zone.`,
      `Twenty solid minutes, ${fn}. This is what studying is supposed to look like. Keep it up.`,
    ]);
    return pick([
      `${fn}, this is some serious focus. Forty-five minutes in!`,
      `${fn}, you've been locked in for a long time. The effort is SHOWING.`,
      `This is what real preparation looks like, ${fn}. Genuinely proud.`,
      `${fn}, most students never get this deep into a session. You did.`,
      `Forty-five minutes. Not easy. You're building something real here, ${fn}.`,
      `Almost an hour, ${fn}. This session is going to matter on exam day.`,
      `This is the version of you that passes exams, ${fn}. Forty-five in, still focused.`,
      `${fn}, forty-five minutes! You are in full study mode right now. Don't stop.`,
      `Nearly an hour of focus, ${fn}. I am genuinely impressed. Keep going.`,
    ]);
  },

  funWaterCard: (fn: string) => pick([
    `Hey ${fn}, quick question — have you had water recently?`,
    `${fn}! Important question. Water status: ???`,
    `Stopping you for 10 seconds, ${fn} — did you drink water?`,
    `${fn}, hydration check! Your brain literally runs on this stuff.`,
    `PSA from Puku: ${fn}, water time! Yes or no?`,
    `${fn}, be honest — when did you last drink water?`,
    `Quick water check, ${fn}! Your focus literally depends on staying hydrated.`,
    `${fn}! Water. It's not a request — it's a wellness intervention from your study buddy.`,
    `Hydration alert, ${fn}! Have you had water in the last hour?`,
    `${fn}, I've been watching — water check time. When did you last drink?`,
  ]),

  funPostureCard: () => pick([
    `Posture check! Are you sitting like a human right now?`,
    `Quick check — shoulders down, back straight, eyes level. Fix anything that's off!`,
    `Your body is working hard too! Ten seconds to stretch right now.`,
    `Posture alert! Slouching literally reduces blood flow to your brain. Sit up!`,
    `Posture scan time! Feet flat? Back straight? Neck neutral? Fix what needs fixing.`,
    `Are you hunching right now? Because statistically, you probably are. Sit up!`,
    `Quick posture check — shoulders back, spine straight, head up. Do it now.`,
    `Your spine needs a break too! Sit back, extend your back, then sit up properly.`,
    `Posture matters, actually. Check yours right now and fix anything off.`,
    `Body check! Shoulders relaxed, back supported, feet grounded? Good. Now keep studying.`,
  ]),

  funTaskCard: (fn: string, studyMins: number) => pick([
    `Challenge for you, ${fn}: can you finish one full topic in the next 15 minutes?`,
    `Mini mission, ${fn}: write down the three most important things you've learned so far.`,
    `${fn}, challenge: read one full page without stopping and summarize it. Can you?`,
    `Quick task, ${fn}: write down what you're studying and why it matters. Thirty seconds.`,
    `${fn}, ${studyMins} minutes in — write one thing you've understood so far. Just one!`,
    `Mini challenge, ${fn}: explain what you're studying to an imaginary student. Go.`,
    `${fn}, challenge accepted? Set a 10-minute timer and see how much you can cover.`,
    `Task for you, ${fn}: make one summary note right now. Three bullet points maximum.`,
    `${fn}, ${studyMins} minutes in — quiz yourself on what you've covered. Right now.`,
    `Challenge mode, ${fn}: no re-reading allowed for the next 10 minutes. Forward only.`,
  ]),

  funWhatStudying: (fn: string) => pick([
    `${fn}, I'm curious — what are you actually studying right now?`,
    `Hey ${fn}! Quick question — what subject is open in front of you?`,
    `${fn}, fill me in! What topic are you working on?`,
    `Just checking — what are you studying right now, ${fn}?`,
    `${fn}! Your study buddy wants to know — what subject today?`,
    `${fn}, what are the books open to? I want to know!`,
    `Tell me, ${fn} — what are you studying right now?`,
    `${fn}, which subject is getting all your focus today?`,
    `What's on the agenda, ${fn}? Which topic are you tackling?`,
    `${fn}, study buddy check-in: what are you working on right now?`,
  ]),

  // ── NEW: Streak flex — proactively mentions the user's streak ────────────
  streakFlex: (fn: string, streak: number) => pick([
    `${fn}, by the way — ${streak} days in a row! That streak is absolutely real.`,
    `Just wanted to say — ${streak}-day streak, ${fn}. That's consistency. Real consistency.`,
    `${fn}, ${streak} days straight of showing up. Most students can't say that. You can.`,
    `Hey ${fn}, ${streak}-day streak alert! Don't break it — you've built something valuable.`,
    `${fn}, your streak is at ${streak} days. That's not luck — that's discipline. Keep it going.`,
    `${streak} days, ${fn}. ${streak} days! That's a habit now. Protect it.`,
    `${fn}, ${streak}-day study streak. I just had to mention it because it's genuinely impressive.`,
    `Your ${streak}-day streak is showing, ${fn}. Consistent people get consistent results.`,
    `${fn}, you know what ${streak} days of showing up equals? A real advantage on exam day.`,
    `${fn}! ${streak}-day streak and you're here again. This is how champions are built.`,
  ]),

  // ── NEW: Today flex — mentions today's accumulated study time ────────────
  todayFlex: (fn: string, mins: number) => pick([
    `${fn}, you've already studied ${mins} minutes today. That's a proper study day.`,
    `Today's total: ${mins} minutes, ${fn}. Real, honest study time. That counts for something.`,
    `${fn}, ${mins} minutes of study today already. You're well ahead of most people right now.`,
    `Today's count: ${mins} minutes and going, ${fn}. Your future exam self is grateful.`,
    `${fn}, just realized you've done ${mins} minutes today. That's genuinely impressive effort.`,
    `${mins} minutes of study today, ${fn}. Not everyone can say that. You can.`,
    `${fn}, ${mins} minutes! That's a proper study session you've built today. Keep adding.`,
    `Today's study total is ${mins} minutes, ${fn}. You're building a real study day here.`,
    `${fn}, ${mins} minutes of focused study today. That's the kind of number that moves results.`,
    `Today: ${mins} minutes studied, ${fn}. You're one of the more committed students out there.`,
  ]),

  // ── NEW: Rank flex — mentions leaderboard position ────────────────────────
  rankFlex: (fn: string, rank: number) => {
    if (rank === 1) return pick([
      `${fn}!! You're NUMBER ONE on today's leaderboard! That's WILD. Keep it up!`,
      `TOP OF THE LEADERBOARD, ${fn}! Today's most dedicated student is literally you.`,
      `${fn}, you're ranked first today. First! That's what consistent studying does.`,
    ]);
    if (rank <= 3) return pick([
      `${fn}, you're top 3 on the leaderboard today! That's seriously impressive.`,
      `Top three, ${fn}! Today's leaderboard has you ranked ${rank}. Keep studying like this.`,
      `${fn}, ranked ${rank} on today's leaderboard. You're one of the most dedicated today!`,
    ]);
    if (rank <= 10) return pick([
      `${fn}, you're in the top 10 on the leaderboard today! Rank ${rank}. That's real.`,
      `Top ten, ${fn}! Rank ${rank} on today's board. Sessions like this keep you there.`,
      `${fn}, rank ${rank} today! Top ten is genuinely impressive. Keep going.`,
    ]);
    if (rank <= 50) return pick([
      `${fn}, you're ranked ${rank} on today's leaderboard. Let's climb higher.`,
      `Rank ${rank} on the board, ${fn}. Study more today and watch that number go up.`,
      `${fn}, you're at rank ${rank} today. Keep this up and you'll be top 10 by end of day.`,
    ]);
    return pick([
      `${fn}, you're on the leaderboard at rank ${rank}. Study time today is what moves that number.`,
      `Rank ${rank} right now, ${fn}. Every minute you study moves you up. Let's climb.`,
      `${fn}, rank ${rank} on the board. Consistent study sessions like this push you higher.`,
    ]);
  },

  // ── NEW: Pep talks — pure motivational shots ──────────────────────────────
  pep: (fn: string) => pick([
    `${fn}, you've got this. Whatever you're studying right now, you've got it in you.`,
    `Something I genuinely believe, ${fn}: the students who show up like this get the results.`,
    `${fn}, the version of you studying right now is the best version. Keep being them.`,
    `No pep talk today — just this: you're already doing the right thing, ${fn}. Keep going.`,
    `${fn}, I want you to know: sessions like this one? They compound. Keep stacking them.`,
    `The hardest thing about studying, ${fn}, is starting. You already started. The rest is momentum.`,
    `${fn}, I believe in you not because I have to — but because you're actually here doing the work.`,
    `You didn't have to study today, ${fn}. You chose to. That choice defines who you're becoming.`,
    `${fn}, the students who surprise everyone on exam day? They had sessions exactly like this.`,
    `Study session truth, ${fn}: right now, in this moment, you are becoming a better student.`,
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
  leaderboardRank,
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
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [voiceName,       setVoiceName]       = useState<string | null>(null);
  const [showVoicePanel,  setShowVoicePanel]  = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedURI,     setSelectedURI]     = useState<string | null>(() => {
    try { return localStorage.getItem("puku-voice-uri"); } catch { return null; }
  });
  const [showVoiceHint, setShowVoiceHint] = useState(() => {
    try { return !localStorage.getItem("puku-voice-hint-seen"); } catch { return false; }
  });
  const previewUtterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const fn = firstName.split(" ")[0];

  const muteRef          = useRef(muted);
  const speechCbRef      = useRef(onSpeechUpdate);
  const emotionCbRef     = useRef(onEmotionChange);
  const pauseCbRef       = useRef(onFocusPause);
  const resumeCbRef      = useRef(onFocusResume);
  const gradeRef         = useRef(grade);
  const streakRef        = useRef(streak);
  const todayMinsRef     = useRef(todayMins);
  const leaderboardRankRef = useRef(leaderboardRank);
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
  useEffect(() => { gradeRef.current          = grade; },          [grade]);
  useEffect(() => { streakRef.current         = streak; },         [streak]);
  useEffect(() => { todayMinsRef.current      = todayMins; },      [todayMins]);
  useEffect(() => { leaderboardRankRef.current = leaderboardRank; },[leaderboardRank]);
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

  // ── Pre-warm TTS voices + restore saved preference ───────────────────────
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      // Only show English voices in the picker (filters noise)
      const enVoices = voices
        .filter(v => v.lang.startsWith("en"))
        .sort((a, b) => scoreVoice(b) - scoreVoice(a));
      setAvailableVoices(enVoices);
      voicesReadyRef.current = true;

      // Restore saved voice or auto-pick best
      const saved = localStorage.getItem("puku-voice-uri");
      if (saved) {
        const match = voices.find(v => v.voiceURI === saved);
        if (match) {
          cachedVoiceRef.current = match;
          setVoiceName(match.name);
          setSelectedURI(saved);
          return;
        }
      }
      const best = pickVoice(voices);
      cachedVoiceRef.current = best;
      if (best) setVoiceName(best.name);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // ── speak ─────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
    speechCbRef.current(text, false);
    setIsSpeaking(false);

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
    // Natural, energetic parameters — faster pace sounds more alive and engaging
    utt.rate   = 0.97 + Math.random() * 0.09;  // 0.97–1.06 (lively, natural)
    utt.pitch  = 1.05 + Math.random() * 0.07;  // 1.05–1.12 (warm, bright, not chipmunk)
    utt.volume = 1.0;

    const doSpeak = () => {
      const v = cachedVoiceRef.current ?? pickVoice(window.speechSynthesis.getVoices());
      if (v) {
        utt.voice = v;
        setVoiceName(v.name);
      }
      utt.onstart = () => {
        setIsSpeaking(true);
        speechCbRef.current(text, true);
      };
      utt.onend = () => {
        setIsSpeaking(false);
        if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
        // Keep the bubble visible for 3 s after speaking finishes so user can read it
        bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 3_000);
      };
      utt.onerror = () => {
        setIsSpeaking(false);
        if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);
        speechCbRef.current(text, false);
        bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 6_000);
      };
      setTimeout(() => window.speechSynthesis.speak(utt), 200);
    };

    bubbleClearTimer.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speechCbRef.current("", false);
    }, 30_000);

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

  // ── Voice preview — speaks "Hey [name]!" in any given voice ─────────────
  const previewVoice = useCallback((voice: SpeechSynthesisVoice) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text = pick([
      `Hey ${fn}! I'm ${voice.name.split(" ")[0]}. How do I sound?`,
      `Hi ${fn}! This is my voice. Like it?`,
      `Hey ${fn}!! Ready to study together?`,
      `${fn}! This is me. Pretty nice, right?`,
    ]);
    const utt = new SpeechSynthesisUtterance(stripForSpeech(text));
    utt.voice  = voice;
    utt.rate   = 1.0;
    utt.pitch  = 1.07;
    utt.volume = 1.0;
    previewUtterRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, [fn]);

  // ── Dismiss voice hint (one-time) ────────────────────────────────────────
  const dismissVoiceHint = useCallback(() => {
    setShowVoiceHint(false);
    try { localStorage.setItem("puku-voice-hint-seen", "1"); } catch {}
  }, []);

  // Auto-dismiss hint after 7 seconds
  useEffect(() => {
    if (!showVoiceHint) return;
    const t = setTimeout(dismissVoiceHint, 7000);
    return () => clearTimeout(t);
  }, [showVoiceHint, dismissVoiceHint]);

  // ── Select voice — saves to localStorage and updates cachedVoiceRef ──────
  const selectVoice = useCallback((voice: SpeechSynthesisVoice) => {
    cachedVoiceRef.current = voice;
    setSelectedURI(voice.voiceURI);
    setVoiceName(voice.name);
    try { localStorage.setItem("puku-voice-uri", voice.voiceURI); } catch {}
    previewVoice(voice);
  }, [previewVoice]);

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
      speak(MSG.greet(fn, grade, streak, todayMins, leaderboardRank));
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
          const st   = streakRef.current;
          const tm   = todayMinsRef.current;
          const rnk  = leaderboardRankRef.current;

          if (roll < 0.30) {
            speak(MSG.encouragement(fn, gradeRef.current, st, tm));
          } else if (roll < 0.50) {
            speak(MSG.humor(fn, studyMinsRef.current));
          } else if (roll < 0.62 && st && st >= 2) {
            // Proactively brag about streak
            setEmotionBoth("proud");
            speak(MSG.streakFlex(fn, st));
            setTimeout(() => setEmotionBoth("focused"), 5000);
          } else if (roll < 0.73 && tm && tm >= 30) {
            // Proactively mention today's study total
            setEmotionBoth("proud");
            speak(MSG.todayFlex(fn, tm));
            setTimeout(() => setEmotionBoth("focused"), 5000);
          } else if (roll < 0.82 && rnk) {
            // Proactively mention leaderboard rank
            setEmotionBoth("excited");
            speak(MSG.rankFlex(fn, rnk));
            setTimeout(() => setEmotionBoth("focused"), 5000);
          } else if (roll < 0.90) {
            speak(MSG.pep(fn));
          } else {
            speak(MSG.midSession(fn, studyMinsRef.current, gradeRef.current, tm));
          }
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
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(16px)",
            border: isSpeaking ? "1.5px solid rgba(139,92,246,0.55)" : "1px solid rgba(139,92,246,0.2)",
            boxShadow: isSpeaking
              ? "0 4px 24px rgba(139,92,246,0.35), 0 2px 8px rgba(0,0,0,0.1)"
              : "0 4px 20px rgba(139,92,246,0.15), 0 2px 8px rgba(0,0,0,0.1)",
            transition: "border 0.3s, box-shadow 0.3s",
          }}>

          {/* Avatar — pulses while speaking */}
          <div className="relative w-6 h-6 flex-shrink-0">
            <div className="w-6 h-6 rounded-full overflow-hidden"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}>
              <PukuFace emotion={emotion} size={24} speaking={isSpeaking} />
            </div>
            {isSpeaking && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-purple-400 pointer-events-none"
                animate={{ scale: [1, 1.55], opacity: [0.7, 0] }}
                transition={{ repeat: Infinity, duration: 0.75 }}
              />
            )}
          </div>

          <span className="text-[9px] font-black tracking-wider text-purple-600">PUKU</span>

          {/* Voice name tooltip — subtle, shown while speaking */}
          {isSpeaking && voiceName && (
            <span className="text-[8px] text-purple-400/80 font-medium max-w-[60px] truncate hidden sm:inline">
              {voiceName.replace(/ Online \(Natural\)/i, "✨").replace(/ \(.*\)/, "")}
            </span>
          )}

          {/* Voice picker button + one-time hint */}
          <div className="relative">
            {/* Hint bubble — shows once, auto-dismisses after 7s */}
            <AnimatePresence>
              {showVoiceHint && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.9 }}
                  className="absolute bottom-full right-0 mb-2 z-50 pointer-events-none"
                  style={{ width: "max-content" }}
                >
                  <div className="relative rounded-xl px-3 py-2 shadow-lg"
                    style={{
                      background: "linear-gradient(135deg,#8b5cf6,#ec4899)",
                      boxShadow: "0 8px 24px rgba(139,92,246,0.35)",
                    }}>
                    <p className="text-white text-[10px] font-bold whitespace-nowrap">🎙️ Tap to pick my voice!</p>
                    {/* Arrow pointing down */}
                    <div className="absolute top-full right-2 w-0 h-0"
                      style={{
                        borderLeft: "5px solid transparent",
                        borderRight: "5px solid transparent",
                        borderTop: "5px solid #ec4899",
                      }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pulsing ring when hint is visible */}
            {showVoiceHint && (
              <motion.div
                className="absolute inset-[-3px] rounded-full border-2 border-purple-400 pointer-events-none"
                animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
              />
            )}

            <button
              onClick={() => { setShowVoicePanel(v => !v); dismissVoiceHint(); }}
              className={`relative w-6 h-6 rounded-full flex items-center justify-center gap-0.5 transition-all px-1 ${
                showVoicePanel
                  ? "bg-purple-500 shadow-md"
                  : showVoiceHint
                  ? "bg-purple-100"
                  : "hover:bg-purple-50"
              }`}
              title="Choose Puku's voice"
              style={{ width: "auto", minWidth: "1.5rem" }}
            >
              <Mic className={`w-3 h-3 flex-shrink-0 ${showVoicePanel ? "text-white" : "text-purple-500"}`} />
              <span className={`text-[8px] font-black tracking-wider leading-none hidden sm:inline ${showVoicePanel ? "text-white" : "text-purple-500"}`}>
                VOICE
              </span>
            </button>
          </div>

          <button onClick={() => setMuted(m => !m)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            title={muted ? "Unmute Puku" : "Mute Puku"}>
            {muted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-gray-400" />}
          </button>

          <button onClick={() => handleMinimize(true)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
            title="Minimize">
            <Minus className="w-3 h-3 text-gray-400" />
          </button>

          {onLeave && (
            <button
              onClick={() => { window.speechSynthesis?.cancel(); setIsSpeaking(false); speechCbRef.current("", false); onLeave(); }}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors"
              title="Dismiss Puku">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* ── Voice picker panel ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showVoicePanel && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{    opacity: 0, y: 8,  scale: 0.97 }}
              transition={{ type: "spring", damping: 22, stiffness: 340 }}
              className="absolute bottom-full right-0 mb-2 w-72 z-50"
            >
              <div className="rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.98)",
                  backdropFilter: "blur(20px)",
                  border: "1.5px solid rgba(139,92,246,0.18)",
                  boxShadow: "0 16px 48px rgba(139,92,246,0.18), 0 4px 16px rgba(0,0,0,0.1)",
                }}>

                {/* Header */}
                <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-purple-50">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}>
                    <Mic className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-gray-800">Choose Puku's Voice</p>
                    <p className="text-[9px] text-gray-400">Click ▶ to preview each one</p>
                  </div>
                  <button onClick={() => setShowVoicePanel(false)}
                    className="w-5 h-5 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                </div>

                {/* Current voice indicator */}
                {voiceName && (
                  <div className="flex items-center gap-1.5 px-4 py-2 bg-purple-50/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-[9px] text-purple-600 font-semibold truncate">
                      Now: {voiceName.replace(/ Online \(Natural\)/i, " ✨ Neural").replace(/ \(.*\)/, "")}
                    </span>
                  </div>
                )}

                {/* Voice list */}
                <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
                  {availableVoices.length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-6">No voices found on this device</p>
                  ) : (
                    availableVoices.map(v => {
                      const isSelected = selectedURI === v.voiceURI ||
                        (!selectedURI && cachedVoiceRef.current?.voiceURI === v.voiceURI);
                      const score      = scoreVoice(v);
                      const isNeural   = score >= 18;
                      const isPremium  = score >= 14;
                      const cleanName  = v.name
                        .replace(/ Online \(Natural\)/i, "")
                        .replace(/ \(.*\)/, "")
                        .replace(/Microsoft /, "")
                        .replace(/Google /, "")
                        .trim();
                      const langBadge  = v.lang === "en-US" ? "US" : v.lang === "en-GB" ? "UK" : v.lang === "en-AU" ? "AU" : v.lang.replace("en-","").toUpperCase();

                      return (
                        <div
                          key={v.voiceURI}
                          onClick={() => selectVoice(v)}
                          className={`flex items-center gap-2.5 px-4 py-2.5 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-gradient-to-r from-purple-50 to-pink-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          {/* Selected checkmark */}
                          <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-purple-500"
                              : "border-2 border-gray-200"
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>

                          {/* Voice info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[11px] font-bold truncate ${isSelected ? "text-purple-700" : "text-gray-700"}`}>
                                {cleanName}
                              </span>
                              {isNeural && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[8px] font-black bg-gradient-to-r from-purple-500 to-pink-500 text-white leading-none">
                                  ✨ NEURAL
                                </span>
                              )}
                              {isPremium && !isNeural && (
                                <span className="inline-flex px-1 py-0.5 rounded-full text-[8px] font-black bg-amber-100 text-amber-700 leading-none">
                                  PREMIUM
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-gray-400 mt-0.5">{langBadge} · {v.lang}</p>
                          </div>

                          {/* Preview play button */}
                          <button
                            onClick={e => { e.stopPropagation(); previewVoice(v); }}
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-purple-100 hover:bg-purple-200 transition-colors flex-shrink-0"
                            title={`Preview ${cleanName}`}
                          >
                            <Play className="w-3 h-3 text-purple-600" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer tip */}
                <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50">
                  <p className="text-[9px] text-gray-400 text-center">
                    ✨ Neural voices (Edge/Windows) sound most natural · Click a voice to select it
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
      {speaking ? (
        <>
          <style>{`
            @keyframes puku-jaw { 0%,100%{transform:scaleY(0.25) translateY(-2px)} 40%{transform:scaleY(1)} 70%{transform:scaleY(0.6)} }
            @keyframes puku-brow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-${s * 0.008}px)} }
          `}</style>
          <ellipse
            cx={cx} cy={mouthY + s * 0.045} rx={mouthW * 0.46} ry={s * 0.065}
            fill="rgba(80,40,120,0.55)"
            style={{ transformOrigin: `${cx}px ${mouthY}px`, animation: "puku-jaw 0.28s ease-in-out infinite" }}
          />
          <path
            d={`M${cx - mouthW / 2},${mouthY} Q${cx},${mouthY - mouthH * 0.5} ${cx + mouthW / 2},${mouthY}`}
            stroke="white" strokeWidth={s * 0.04} fill="none" strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d={mouthPath()}
          stroke="white"
          strokeWidth={s * 0.045}
          fill={cfg.mouthPath === "open-up" ? "rgba(255,255,255,0.3)" : "none"}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
