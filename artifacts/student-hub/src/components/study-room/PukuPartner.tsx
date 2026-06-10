import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Minus, X, CheckCircle, XCircle } from "lucide-react";

export type PukuEmotion = "happy" | "relaxed" | "focused" | "concerned" | "frustrated" | "proud" | "excited";

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

// ── HUGE grade-personalized message bank ─────────────────────────────────────
const MSG = {

  greet: (fn: string, grade?: number, streak?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const streakLine = streak && streak >= 2 ? ` ${streak}-day streak — that's real.` : "";
    const todayLine  = todayMins && todayMins >= 30 ? ` You've already studied ${todayMins} min today.` : "";
    const shared = [
      `Hey ${fn}! Puku here.${streakLine} Let's make this one count.`,
      `${fn}! You showed up.${todayLine} That already puts you ahead.`,
      `${fn}, ${timePart()} session — just us today. I'll be right here with you.`,
      `Hey ${fn}! Been waiting.${streakLine} Let's get into it.`,
      `${fn}, ready to actually focus?${todayLine} Let's go.`,
      `Oh hey, ${fn}! Finally. Let's do this properly today.`,
      `${fn}, good to see you.${streakLine} Let's not waste this session.`,
      `Hey ${fn} — phones down, brains up. Let's lock in.`,
      `${fn}! You're here, I'm here.${todayLine} Let's make it happen.`,
      `${fn}, okay. Fresh session. Let's make it a good one.`,
    ];
    const specific: Record<string, string[]> = {
      grade9:   [
        `${fn}! Grade 9 is where good habits start. Let's build one right now.`,
        `${fn}, early study habits are the real superpower. You're building them now.`,
        `Grade 9 ${fn} — the earlier you start, the easier everything gets. Let's focus.`,
      ],
      grade10:  [
        `${fn}! SEE is closer than you think. Let's not waste today.`,
        `${fn}, this is your SEE prep time. Every minute matters.`,
        `SEE toppers start exactly like this, ${fn} — consistent sessions. Let's go.`,
        `${fn}, your SEE board papers won't write themselves. Let's work.`,
      ],
      grade11:  [
        `${fn}! +2 is a fresh start — let's make your early sessions count.`,
        `${fn}, welcome to the big leagues. Grade 11 rewards early prep. Let's focus.`,
        `${fn}, +2 is tough — but you're here, which already puts you ahead.`,
      ],
      grade12:  [
        `${fn}! Board season. Every single session this year counts. Let's go.`,
        `${fn}, final stretch before boards. Let's make this session real.`,
        `Board exam prep, ${fn}. Future you is counting on present you.`,
        `${fn}, board toppers are doing exactly what you're about to do. Let's start.`,
      ],
      cee:      [
        `${fn}! Medical entrance prep is intense. I'm right here with you — let's focus.`,
        `${fn}, every focused session is a step closer to that CEE seat. Let's lock in.`,
        `CEE grind, ${fn}. The students who make it show up consistently. Just like now.`,
        `${fn}, that medical career starts with sessions exactly like this. Let's go.`,
      ],
      ioe:      [
        `${fn}! IOE prep — engineering entrance rewards the consistent. Let's start.`,
        `${fn}, here to crush some IOE prep? Let's do this properly.`,
        `Engineering entrance, ${fn}. Physics, Math, consistency. Let's go.`,
        `${fn}, IOE toppers sit exactly like this — focused, daily. That's today.`,
      ],
      bachelors:[
        `${fn}! Small progress every day beats last-minute panic. Ready?`,
        `${fn}, consistent daily study is the bachelor's student's superpower. Let's go.`,
        `Bachelor's life is a marathon, ${fn}. Let's add another quality session.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  studyStart: (fn: string, grade?: number, studyMins?: number) => {
    const ctx = gradeContext(grade);
    const minCtx = studyMins && studyMins > 0 ? ` You're at ${studyMins} minutes already.` : "";
    const shared = [
      `Lock in, ${fn}. Timer's running — this is your time.`,
      `Focus mode on.${minCtx} Just you and the material. I'm right here.`,
      `Okay ${fn}, phone face-down, books open. Let's go.`,
      `Clock's ticking. Give this session everything you've got.`,
      `This one counts. Make it mean something, ${fn}.`,
      `Alright, ${fn}. Let's do this properly this time.`,
      `${fn}, deep breath. Now focus. Let's go.`,
      `Head down, ${fn}. Let's build something today.`,
      `Study mode: on.${minCtx} Let's not waste it.`,
      `${fn}, this is the session. Not tomorrow, not later. Right now.`,
      `Okay, books out. Distractions out.${minCtx} Focus in. Let's start.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [
        `SEE prep starts now. One session at a time, ${fn}.`,
        `${fn}, every SEE subject has a chapter waiting. Let's get it done.`,
      ],
      grade12:  [
        `Board prep in session. Focus everything, ${fn}.`,
        `${fn}, imagine how good you'll feel at the end of this. Let's start.`,
        `Board season focus mode: on. Let's go, ${fn}.`,
      ],
      cee:      [
        `CEE entrance is waiting, ${fn}. This session is your investment.`,
        `Medical entrance needs this kind of focus. Let's go, ${fn}.`,
        `${fn}, this is the difference between getting that seat and not. Focus.`,
      ],
      ioe:      [
        `IOE prep mode on. Engineering doesn't wait, ${fn}.`,
        `${fn}, every focused minute of IOE prep pays off later. Start.`,
      ],
      bachelors:[
        `Consistent progress. That's today, ${fn}.`,
        `Bachelor's life: study now, enjoy later. Let's go, ${fn}.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  breakStart: (fn: string) => pick([
    `Break time! Step away, stretch a little. You earned it, ${fn}.`,
    `${fn}, real break — don't peek at study material. Let your brain reset.`,
    `Rest mode. Walk around, drink water, look outside.`,
    `You worked hard, ${fn} — rest properly. No doom-scrolling. Just breathe.`,
    `Good time to grab some water and relax your eyes, ${fn}.`,
    `${fn}, the break is part of the process. Use it properly.`,
    `Five minutes of real rest beats twenty of fake studying, ${fn}.`,
    `Close your eyes for a minute. Your brain will thank you.`,
    `${fn}, go stand up. Sit back down only when you're ready to focus.`,
    `This is your break. Own it — no half-resting while scrolling.`,
    `Step away from the screen, ${fn}. The notes will still be there.`,
    `Break earned. Rule: actually rest. Not "rest" while watching reels.`,
    `Your brain just did real work, ${fn}. Let it recharge — properly.`,
    `${fn}, go breathe some fresh air if you can. Even 2 minutes outside helps.`,
    `Real break means no screen, ${fn}. Trust me on this one.`,
  ]),

  milestone5: (fn: string) => pick([
    `Five minutes, ${fn}! The hardest part is starting — you crushed it.`,
    `${fn}, five minutes in. You showed up and stayed. Keep going!`,
    `Nice start. Five minutes is five minutes. Build on it, ${fn}.`,
    `${fn}, first five minutes done. Most people quit before this. You didn't.`,
    `Five in. The session is real now. Don't stop, ${fn}.`,
    `${fn} — okay. We're actually doing this. Five minutes strong.`,
    `You showed up and you stayed. Five minutes. That's how it starts, ${fn}.`,
    `${fn}, five minutes down. The resistance is already losing. Keep it up.`,
    `Momentum is building, ${fn}. Five minutes done. Ride it.`,
  ]),

  milestone15: (fn: string) => pick([
    `Fifteen minutes, ${fn}. You're locked in — don't break this flow.`,
    `${fn}, 15 minutes of real work. You're in the zone. Stay there.`,
    `Quarter hour. Nice, ${fn}.`,
    `${fn}, fifteen minutes. The warm-up is over. This is the real session now.`,
    `15 minutes in and still going. That's the ${fn} I know.`,
    `Quarter hour down. Most people haven't even opened their books yet, ${fn}.`,
    `${fn}, fifteen minutes. The hard start is behind you. Now just keep going.`,
    `Fifteen solid minutes. Your brain is warmed up. Keep pushing, ${fn}.`,
    `${fn}, you've got real momentum now. Fifteen minutes. Keep the energy.`,
    `15 minutes, ${fn}. This is when most people would give up. You're not.`,
  ]),

  milestone30: (fn: string, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const streakLine = streak && streak >= 3 ? ` ${streak}-day streak going strong.` : "";
    const shared = [
      `${fn}, thirty minutes. Genuinely impressive.${streakLine}`,
      `Half an hour! Your future self is already grateful, ${fn}.`,
      `Thirty minutes of solid focus. That's what it looks like, ${fn}.`,
      `${fn}, 30 minutes in. The session is really rolling now.`,
      `Half hour milestone, ${fn}.${streakLine} You're building something real.`,
      `${fn}, you've studied for half an hour. That's not nothing. That's progress.`,
    ];
    const specific: Record<string, string[]> = {
      cee:   [`${fn}, 30 focused minutes of CEE prep. That's real progress.`],
      ioe:   [`Half an hour of IOE prep, ${fn}. Respect.`],
      grade12:[`30 minutes down. Board exam prep is happening right now, ${fn}.`],
      grade10:[`${fn}, 30 minutes of SEE prep done. That's the consistency that wins.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone60: (fn: string, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const streakLine = streak && streak >= 3 ? ` And that ${streak}-day streak? Insane.` : "";
    const shared = [
      `One full hour, ${fn}. That is exceptional.${streakLine}`,
      `${fn}! One hour! You're built for this. Keep going.`,
      `Sixty minutes of focus. Most students never get here, ${fn}. You did.`,
      `${fn}, an hour. I'm genuinely proud of this session.${streakLine}`,
      `One hour down, ${fn}. The people who study like this? They're the ones who pass.`,
      `${fn}, 60 minutes of real work. That's not an accident — that's discipline.`,
    ];
    const specific: Record<string, string[]> = {
      cee:   [`One hour of CEE prep, ${fn}. You're serious about this. It shows.`],
      ioe:   [`An hour of IOE grind, ${fn}. This is what it takes.`],
      grade12:[`An hour in. Board toppers study like this. That's you right now, ${fn}.`],
      bachelors:[`An hour already, ${fn}. You're one of the consistent ones.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  milestone90: (fn: string, streak?: number) => {
    const s = streak && streak >= 5 ? ` ${streak} days in a row now. Wow.` : "";
    return pick([
      `${fn}, ninety minutes. You are genuinely built differently.${s}`,
      `90 minutes of focus. That's elite, ${fn}. Don't stop.`,
      `Ninety minutes, ${fn}. I'm honestly proud of you.`,
      `${fn}, an hour and a half. Sessions like this are what actually moves things.`,
      `Ninety minutes in, ${fn}. The commitment is showing. Keep it going.`,
      `${fn}, ninety minutes. You're not just studying — you're building a habit.${s}`,
      `An hour and a half, ${fn}. That's not luck. That's discipline.`,
      `${fn}, 90 minutes. I've been with you the whole time. This is something.`,
    ]);
  },

  milestone120: (fn: string, streak?: number) => {
    const s = streak ? ` ${streak}-day streak` : "";
    return pick([
      `Two hours, ${fn}. Two full hours.${s} Your future self will remember this.`,
      `${fn}! Two hours! I've been here the whole time. Truly impressive.`,
      `Two hours of real study, ${fn}. You're doing what most only talk about.`,
      `${fn}, two hours. That is not normal. That is exceptional. I mean it.`,
      `Two full hours, ${fn}. Whatever exam is coming — you just got more ready.`,
      `${fn}, two hours in. The consistency today is exactly what toppers do.`,
      `You've been at this for two hours, ${fn}. This is the version of you that wins.`,
      `Two hours, ${fn}. I can't even say more — just, wow.`,
    ]);
  },

  midSession: (fn: string, m: number, grade?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const todayCtx = todayMins && todayMins > 60 ? ` You've been putting in work all day, ${fn}.` : "";
    const shared = [
      `${m} minutes in and still going, ${fn}. That's what I like to see.`,
      `Nice pace, ${fn}. Keep it exactly like this.`,
      `${fn}, you're past the hard part. It gets easier from here.`,
      `Still focused, ${fn}. Don't break it.`,
      `${fn}, you're doing the work other students skip. Remember that.`,
      `Still here, ${fn}? Good. Keep going — this is it.`,
      `The session is going well, ${fn}. Real momentum building.`,
      `${fn}, the fact that you haven't quit yet puts you ahead of most.`,
      `This is what studying actually looks like, ${fn}. Not glamorous. Just consistent.`,
      `${fn}, don't overthink it — just keep doing what you're doing.`,
      `${m} minutes in. Most people gave up before this, ${fn}.`,
      `${fn}, the clock is your friend right now. Every minute counts.`,
      `Still focused. I noticed. Good work, ${fn}.`,
      `${fn}, one concept at a time. You've got this.`,
      `Progress doesn't always feel like progress. But this is it, ${fn}.`,
      `${fn}, you're doing better than you realize.`,
      `Don't stop to check if you're doing it right. Just keep going, ${fn}.`,
      `${fn}, if this topic is tough — it means you're actually learning.`,
      `Quietly crushing it over there, ${fn}.`,
      `${fn}, you're ${m} minutes into something that matters.${todayCtx}`,
      `Still going, ${fn}? Yes. Good. Keep it exactly like this.`,
      `${fn}, the world outside can wait. You've got work to do.`,
      `You're in it, ${fn}. Stay in it.`,
      `${fn}, this is the part nobody sees — but it's where the real studying happens.`,
      `Checked in on you — you're doing great, ${fn}. Keep going.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [
        `${m} minutes of SEE prep. You're ahead of most right now, ${fn}.`,
        `SEE toppers sit exactly like this, ${fn}. ${m} minutes in.`,
        `${fn}, ${m} minutes closer to that SEE score you want.`,
      ],
      grade12:  [
        `${m} minutes of board prep. This is exactly what top scorers do, ${fn}.`,
        `${fn}, board season rewards the consistent. You're building that right now.`,
        `${m} minutes, ${fn}. Boards reward this kind of patience.`,
      ],
      cee:      [
        `${m} minutes of focused CEE prep, ${fn}. This is the difference-maker.`,
        `${fn}, medical entrance is competitive. This session? This is how you compete.`,
        `${m} minutes of CEE grind, ${fn}. Every bit counts.`,
      ],
      ioe:      [
        `${m} minutes in. IOE entrance is about this consistency, ${fn}.`,
        `${fn}, engineering entrance doesn't forgive gaps. You're not leaving any.`,
      ],
      bachelors:[
        `${m} minutes down, ${fn}. Small daily progress adds up fast.`,
        `${fn}, consistency beats intensity every time. You're living proof.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  water: (fn: string) => pick([
    `Quick water break, ${fn}? Your brain is 75% water.`,
    `Hey — when did you last drink water? Go grab some.`,
    `Hydration check, ${fn}! A glass of water will actually help you focus.`,
    `${fn}, water. Non-negotiable. Go drink something now.`,
    `Small reminder: water. Two minutes. Worth it, ${fn}.`,
    `${fn}, seriously — water. Don't make me ask twice.`,
    `You've been at this a while, ${fn}. Drink some water, come back sharp.`,
    `${fn}, when did you last hydrate? Go fix that. Right now.`,
    `Your brain runs on water, ${fn}. Literally. Go drink some.`,
    `A glass of water is the cheapest performance upgrade there is, ${fn}.`,
    `${fn}, dehydration makes everything harder. Water. Now.`,
    `Pssst — ${fn}. Water. I'll wait.`,
    `Even five big sips of water will help right now, ${fn}. Go.`,
  ]),

  health: () => pick([
    `Quick tip — relax your shoulders right now. You've been hunched.`,
    `Look away from the screen for 20 seconds. Your eyes need the rest.`,
    `Sit up straight. Good posture actually helps you think.`,
    `Take three deep breaths. Seriously — it resets your focus.`,
    `Stand up and stretch for 30 seconds. Your back will thank you.`,
    `Blink a few times. Staring reduces blinking — rest your eyes.`,
    `Roll your neck slowly left and right. Your muscles will thank you.`,
    `Palms over eyes, 10 seconds. Screen fatigue is real.`,
    `Uncross your legs. Both feet flat on the floor.`,
    `Stretch your arms above your head and hold for 5 seconds.`,
    `Open a window or look outside for 20 seconds. Natural light helps.`,
    `Wiggle your fingers and shake out your hands.`,
    `Jaw tension check — unclench your teeth right now. There you go.`,
    `Tilt your head to each side slowly. Neck stretch. Do it.`,
  ]),

  encouragement: (fn: string, grade?: number, streak?: number, todayMins?: number) => {
    const ctx = gradeContext(grade);
    const streakLine = streak && streak >= 3 ? `You're on a ${streak}-day streak, ${fn}. Don't let it slip.` : "";
    const todayLine  = todayMins && todayMins >= 60 ? `You've already put in ${todayMins} minutes today, ${fn}. That's real work.` : "";
    const shared = [
      `${fn}, you're doing better than you think.`,
      `One page at a time. Don't look at everything at once, ${fn}.`,
      `${fn}, the fact that you're here studying right now matters. Don't forget that.`,
      `Every minute here is compounding, ${fn}. Future you is grateful.`,
      `${fn}, I've been watching — you're more focused than you give yourself credit for.`,
      `Write it down if you're stuck, ${fn}. Pen on paper does something to your brain.`,
      `${fn}, try explaining what you just read out loud. Sounds silly. It works.`,
      `Toppers didn't have superpowers, ${fn}. They just showed up — like you're doing.`,
      `Boring topics are part of it, ${fn}. Push through. It gets easier.`,
      `${fn}, the gap between where you are and where you want to be is closed by sessions like today.`,
      `When this topic feels confusing, ${fn} — that's you actually engaging with it. Confusion is progress.`,
      `${fn}, you don't have to understand everything right now. Just keep moving forward.`,
      `Look at what you've already done, ${fn}. That's real. Don't dismiss it.`,
      `${fn}, most students quit in the middle. You're still here. That's the difference.`,
      `If this feels hard, that's because it is hard, ${fn}. Doesn't mean you're doing it wrong.`,
      `${fn}, showing up consistently beats occasional bursts every single time.`,
      `You already decided to be here, ${fn}. Don't waste it by holding back.`,
      `${fn}, every topic you get through today is one less thing to panic about later.`,
      `The version of you that passes their exams is the one doing exactly this, ${fn}.`,
      `${fn}, you're not behind. You're exactly where you need to be — studying. Right now.`,
      streakLine || `${fn}, discipline is showing up even when it's hard. You're doing it.`,
      todayLine  || `${fn}, small wins today = big results later.`,
      `${fn}, the thing about studying is — it doesn't feel exciting, but it works.`,
      `You're not studying for the grade, ${fn}. You're studying for what comes after.`,
      `${fn}, be patient with yourself. Learning takes time. You're in the middle of that time.`,
    ].filter(Boolean) as string[];
    const specific: Record<string, string[]> = {
      grade9:   [`Grade 9 is early, ${fn}. The habits you build now carry you through Grade 12 and beyond.`],
      grade10:  [
        `${fn}, SEE gets easier when you're consistent. This is how you build that.`,
        `Every SEE practice session is practice for the real thing, ${fn}.`,
        `${fn}, SEE toppers didn't cram. They were consistent. Like this.`,
      ],
      grade11:  [`${fn}, +2 is tough but manageable. Just don't fall behind. You're not behind.`],
      grade12:  [
        `${fn}, students who don't panic on exam day are the ones who did exactly this.`,
        `Board exams reward the consistent, ${fn}. This is your consistency.`,
        `${fn}, boards feel far away — until they're not. Study now.`,
      ],
      cee:      [
        `${fn}, every focused session gets you closer to that medical entrance seat.`,
        `CEE is competitive, ${fn}. But so are you. Keep going.`,
        `${fn}, the students who get into medicine aren't smarter. They're more consistent.`,
      ],
      ioe:      [
        `${fn}, engineering entrance rewards consistency over cramming. You're doing it right.`,
        `IOE toppers study like this, ${fn}. Consistent. Patient. Focused.`,
      ],
      bachelors:[
        `${fn}, small progress every day beats last-minute panic. You're living proof.`,
        `Bachelor's is a marathon, ${fn}. Pace matters more than sprints.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  humor: (fn: string, studyMins?: number) => {
    const mCtx = studyMins && studyMins > 0 ? ` You've been here ${studyMins} minutes.` : "";
    return pick([
      `${fn}, your phone is probably boring. I promise.`,
      `Fun fact: you've been more productive today than most people manage all week.`,
      `${fn}, the ${timePart()} study session is lowkey the most underrated.`,
      `Your future self just sent a message. It says "thank you."`,
      `${fn}, you're doing the thing people say they'll do "later." Respect.`,
      `Nobody who studied less than you is getting the same result.${mCtx}`,
      `${fn}, that "five more minutes" you kept pushing? This is it. You're in it.`,
      `Imagine showing someone your screen right now. They'd be impressed.`,
      `${fn}, your classmates are probably on TikTok. You're not. Good.`,
      `Real talk — people who complain about exams didn't do this. You are.`,
      `${fn}, the session isn't glamorous. Neither is winning. Both take the same thing.`,
      `${fn}, I don't say this to everyone, but — you're actually doing great right now.`,
      `Everyone's watching reels.${mCtx} And you? You're studying. Respect.`,
      `${fn}, studying is the least exciting thing and the most important thing. Simultaneously.`,
      `Current status: studying hard, zero regrets, ${fn}.`,
      `${fn}, some people make plans to study. You're actually doing it. Big difference.`,
    ]);
  },

  // Tab-away come-back messages — warm, not accusatory
  comeBack: (fn: string, mins: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Hey ${fn}, welcome back! You were away ${mins} minutes. Still studying?`,
      `${fn}! There you are. ${mins} minutes gone. You good?`,
      `Back already? You were out for ${mins} minutes, ${fn}. Still with me?`,
      `${fn}, you left for ${mins} minutes. Timer was still running — still in?`,
      `Oh hey ${fn}! ${mins} minutes away. Everything okay?`,
      `${fn}, ${mins} minutes just happened. Still coming back to study?`,
      `There you are, ${fn}. ${mins}-minute break. Timer's been waiting.`,
      `${fn}, I noticed you were gone for ${mins} minutes. Welcome back!`,
      `Hey — ${fn}'s back! ${mins} minutes away. Still studying today?`,
      `${fn}, you stepped out for ${mins} minutes. Clock was still going.`,
      `Back! ${fn}, ${mins} minutes went by. Ready to get back into it?`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [
        `${fn}, ${mins} minutes away from your SEE prep. Still with me?`,
        `${fn}, that's ${mins} minutes of SEE time. Come back when you're ready.`,
      ],
      grade12:  [
        `${fn}, ${mins} minutes away from board prep. Still studying?`,
        `${fn}, boards don't stop — ${mins} minutes went by. Let's resume?`,
      ],
      cee:      [
        `${fn}, ${mins} minutes from your CEE prep. Still going?`,
        `${fn}, competition didn't take a ${mins}-minute break. Coming back?`,
      ],
      ioe:      [
        `${fn}, ${mins} minutes away. IOE prep in progress — coming back?`,
        `Engineering doesn't wait, ${fn}. ${mins} minutes away. Let's resume.`,
      ],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  // After auto-pause on long absence — detailed friendly summary
  returnSummary: (fn: string, minsAway: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `Hey ${fn}! Welcome back. You were away for ${minsAway} minutes — I went ahead and paused your timer. Pick up whenever you're ready.`,
      `${fn}, you're back! ${minsAway} minutes away, so I paused the clock for you. Hit Resume when you're actually ready to focus again.`,
      `There you are, ${fn}. I paused your session after ${minsAway} minutes — I didn't want your study time running while you were away. Resume when you're set.`,
      `${fn}! Okay — you were gone ${minsAway} minutes, so I hit pause. The session is saved, everything's fine. Just resume when you're ready.`,
      `Welcome back, ${fn}. ${minsAway} minutes went by, so I paused the timer to keep your stats honest. Ready to pick this back up?`,
      `${fn}, I paused things after ${minsAway} minutes away. No stress — just hit Resume when you're actually back and focused.`,
    ];
    const specific: Record<string, string[]> = {
      grade12: [`${fn}, ${minsAway} minutes away from board prep. I paused your timer — resume when you're ready to lock back in.`],
      cee:     [`${fn}, ${minsAway} minutes went by. I've paused — your CEE prep session is waiting whenever you're ready.`],
      ioe:     [`${fn}, ${minsAway}-minute break noted. Timer paused. Resume when you're actually ready to study.`],
    };
    const pool = ctx && specific[ctx] ? [...shared, ...specific[ctx]] : shared;
    return pick(pool);
  },

  frustrated: (fn: string) => pick([
    `${fn}, this keeps happening. Let's break the pattern right now.`,
    `Hey — I know it's tough to stay focused, ${fn}. But you came here to study. Let's try again.`,
    `${fn}, every time you come back, it still counts. Let's lock back in.`,
    `Distraction is normal, ${fn}. Coming back is what matters. Come back.`,
    `${fn}, let's reset. Breathe. Then focus. That's all it takes.`,
    `I'm not here to judge, ${fn} — just to remind you why you opened this page. Still want to study?`,
    `${fn}, it happens to everyone. The important thing is getting back. You're back.`,
  ]),

  sessionComplete: (fn: string, mins: number, grade?: number, streak?: number) => {
    const ctx = gradeContext(grade);
    const streakLine = streak && streak >= 2 ? ` And that ${streak}-day streak? Keep it going.` : "";
    const shared = [
      `${fn}, great work today. ${mins} minutes of real study. Be proud.${streakLine}`,
      `Session done! ${mins} minutes, ${fn}. Genuinely impressive.`,
      `Good work today, ${fn}. ${mins} minutes. Rest well — you earned it.`,
      `${fn}, ${mins} minutes done. Future you is grateful.${streakLine}`,
      `${mins} solid minutes, ${fn}. That's a session that actually counts.`,
      `${fn}, session complete. ${mins} minutes of real work. See you next time.`,
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
    `${fn}, you've got company now. I'll head out — you were great today.`,
  ]),

  // On-page idle checks — escalating but never hostile
  inactivityCheck: (fn: string, count: number) => {
    if (count === 1) return pick([
      `Still with me, ${fn}?`,
      `Hey ${fn} — still studying?`,
      `Just checking in. You good over there?`,
      `${fn}, you've been very still. Deep focus or drifted off?`,
      `Psst — ${fn}. Still there?`,
      `Hey, quick check — still focused, ${fn}?`,
      `${fn}, tap anything if you're still with me.`,
      `${fn}? Just checking you're still in it.`,
      `A little quiet over there, ${fn}. Still studying?`,
      `${fn}, haven't seen any movement. You good?`,
      `Everything okay over there, ${fn}?`,
      `${fn}, just a friendly nudge — still here?`,
    ]);
    if (count === 2) return pick([
      `${fn}, you've been quiet for a while now.`,
      `Haven't heard from you in a bit, ${fn}.`,
      `${fn}... still there?`,
      `You've gone very still, ${fn}. Still focused?`,
      `It's been a while. You with me, ${fn}?`,
      `${fn}, things got quiet over here. Still in the session?`,
      `I'm still here, ${fn}. Are you?`,
      `${fn}, second check — still studying?`,
      `${fn}, your session's still running. Just want to make sure you're still in it.`,
      `${fn}, no pressure — just want to make sure you haven't wandered off.`,
    ]);
    return pick([
      `${fn}, should I pause the timer?`,
      `Want me to pause while you sort things out, ${fn}?`,
      `${fn}, I'm going to pause soon if you don't respond.`,
      `Still there, ${fn}? One more check before I pause.`,
      `${fn}, last call before I pause the timer.`,
      `${fn}, I'm about to pause — tell me you're still there.`,
      `Timer's about to pause, ${fn}. One more chance.`,
      `${fn}, three checks now. Say something or I'm pausing.`,
      `${fn}, last chance before I pause. Still here?`,
    ]);
  },

  inactivityAutoPause: (fn: string) => pick([
    `No response, ${fn}. Pausing your study time — come back when you're ready.`,
    `You haven't responded, so I'm pausing the timer. Come back and we'll pick this up, ${fn}.`,
    `${fn}, I think you've stepped away. Pausing — resume whenever you're back.`,
    `Timer paused, ${fn}. No stress — just come back when you're actually ready to focus.`,
    `${fn}, three checks and no reply. I've paused things — resume whenever you're ready.`,
    `Pausing the timer, ${fn}. Take your time — just hit Resume when you're back.`,
    `${fn}, looks like you needed a longer break than expected. Timer paused — it's all good.`,
  ]),

  lockedIn: (fn: string, mins: number) => {
    if (mins <= 25) return pick([
      `${fn}, you're locked in today. Keep going.`,
      `Twenty minutes of solid focus, ${fn}. Don't break it now.`,
      `You're in the zone right now. This is exactly what progress looks like, ${fn}.`,
      `${fn}, this kind of session is what moves the needle. Stay in it.`,
      `Finding your rhythm, ${fn}. Keep moving forward.`,
      `${fn}, twenty minutes. The warm-up is long over. This is the real thing.`,
      `You've been locked in for twenty minutes, ${fn}. That's rare.`,
      `${fn}, don't stop now. You're right in the middle of something good.`,
      `Twenty minutes, ${fn}. Not checking your phone. Not distracted. Just working.`,
    ]);
    return pick([
      `${fn}, this is some serious focus. Forty-five minutes in.`,
      `${fn}, you've been locked in for a long time. The effort is showing.`,
      `This is what real preparation looks like, ${fn}. Genuinely proud.`,
      `${fn}, most students never get this deep into a session. You did.`,
      `Forty-five minutes. Not easy. You're building something real, ${fn}.`,
      `${fn}, you've been at it for forty-five minutes. Brain working hard. Keep going.`,
      `Almost an hour, ${fn}. This session is going to matter.`,
      `This is the version of you that passes, ${fn}. Forty-five minutes in, still focused.`,
    ]);
  },

  comeback: (fn: string) => pick([
    `Welcome back, ${fn}. Let's finish this properly.`,
    `Good to have you back, ${fn}. Let's pick up where we left off.`,
    `${fn}, you're back. Ready to lock in again?`,
    `Back at it, ${fn}. Let's make the rest of this count.`,
    `There you are. Let's not waste the momentum you already built, ${fn}.`,
    `${fn}, okay — you're back. Let's not lose the pace.`,
    `Break's over, ${fn}. Let's go again.`,
    `${fn}, welcome back. The books missed you. Let's finish this.`,
    `Good. You're back, ${fn}. Don't let that break derail the whole session.`,
    `${fn}, back in the chair. Now back in the focus. You've got this.`,
    `Reset done, ${fn}. Now let's lock back in.`,
    `${fn}, the timer's waiting. Ready to go again?`,
    `Back and ready, ${fn}? Let's make the rest count.`,
    `${fn}, fresh start. This half of the session is yours to own.`,
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

// ── Anti-repeat picker ────────────────────────────────────────────────────────
// Keeps last 8 spoken lines; avoids re-picking them from any pool.
function makePickFresh() {
  const recent: string[] = [];
  return function pickFresh(pool: string[]): string {
    const fresh = pool.filter(m => !recent.includes(m));
    const chosen = fresh.length > 0 ? pick(fresh) : pick(pool);
    if (recent.length >= 8) recent.shift();
    recent.push(chosen);
    return chosen;
  };
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
  const pickFresh        = useRef(makePickFresh()).current;

  useEffect(() => { muteRef.current       = muted; },      [muted]);
  useEffect(() => { speechCbRef.current   = onSpeechUpdate; }, [onSpeechUpdate]);
  useEffect(() => { emotionCbRef.current  = onEmotionChange; }, [onEmotionChange]);
  useEffect(() => { pauseCbRef.current    = onFocusPause; },  [onFocusPause]);
  useEffect(() => { resumeCbRef.current   = onFocusResume; }, [onFocusResume]);
  useEffect(() => { gradeRef.current      = grade; },     [grade]);
  useEffect(() => { streakRef.current     = streak; },    [streak]);
  useEffect(() => { todayMinsRef.current  = todayMins; }, [todayMins]);
  useEffect(() => { studyMinsRef.current  = studyMins; }, [studyMins]);
  useEffect(() => { isStudyingRef.current = isStudying; }, [isStudying]);
  useEffect(() => { isPausedRef.current   = isPaused; },  [isPaused]);
  useEffect(() => { distractPopupRef.current = distractPopup; }, [distractPopup]);

  const hasGreeted           = useRef(false);
  const prevStudying         = useRef(false);
  const prevBreak            = useRef(false);
  const milestones           = useRef<Set<number>>(new Set());
  const tabHiddenAt          = useRef<number | null>(null);
  const distractCount        = useRef(0);
  const wasBye               = useRef(false);
  const lastHealthAt         = useRef(0);
  const lastActivityRef      = useRef<number>(Date.now());
  const idleCheckCountRef    = useRef<number>(0);
  const lastConfirmedAt      = useRef<number>(0);
  const breakCountRef        = useRef<number>(0);
  const cachedVoiceRef       = useRef<SpeechSynthesisVoice | null>(null);
  const voicesReadyRef       = useRef(false);

  const bubbleClearTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midSessionTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const osNotifTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupAutoTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgSpeakTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPauseTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 8_000);
      return;
    }

    window.speechSynthesis.cancel();
    const clean = stripForSpeech(text);
    if (!clean) {
      bubbleClearTimer.current = setTimeout(() => speechCbRef.current("", false), 8_000);
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

  // ── On-page idle detection ─────────────────────────────────────────────────
  // First check at 4 min. Escalates every 2.5 min if ignored. Auto-pause after 3 checks.
  useEffect(() => {
    if (!visible) return;

    const doEscalate = () => {
      if (!distractPopupRef.current) return;
      idleCheckCountRef.current = Math.min(idleCheckCountRef.current + 1, 4);

      if (idleCheckCountRef.current >= 4) {
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
      setEmotionBoth(idleCheckCountRef.current >= 3 ? "frustrated" : "concerned");
      if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
      popupAutoTimer.current = setTimeout(doEscalate, 2.5 * 60_000);
    };

    const intervalId = setInterval(() => {
      if (!isStudyingRef.current || isPausedRef.current) return;
      if (document.hidden) return;
      if (distractPopupRef.current) return;

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 4 * 60_000) return; // under 4 min — probably just reading

      if (Date.now() - lastConfirmedAt.current < 7 * 60_000) return; // cool-down

      idleCheckCountRef.current = 1;
      const msg = MSG.inactivityCheck(fn, 1);
      setPopupMsg(msg);
      setEmotionBoth("happy");
      setDistractPopup(true);
      speak(msg);

      if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
      popupAutoTimer.current = setTimeout(doEscalate, 2.5 * 60_000);
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
    for (const [mins, msgFn, em] of checks) {
      if (studyMins >= mins && !milestones.current.has(mins)) {
        milestones.current.add(mins);
        setEmotionBoth(em);
        speak(msgFn(fn, grade, streak, todayMins));
        setTimeout(() => setEmotionBoth("focused"), 6000);
        return;
      }
    }
  }, [studyMins, visible, fn, grade, streak, todayMins, speak, setEmotionBoth]);

  // ── Mid-session check-ins ─────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    let callCount = 0;

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      let minD: number, maxD: number;
      if (callCount === 0)               { minD = 7;  maxD = 10; }
      else if (studyMinsRef.current < 45){ minD = 9;  maxD = 14; }
      else                               { minD = 12; maxD = 20; }
      const delay = (minD + Math.random() * (maxD - minD)) * 60_000;

      return setTimeout(() => {
        if (isStudyingRef.current && !isPausedRef.current && !document.hidden) {
          callCount++;
          const roll = Math.random();
          if (roll < 0.40)      speak(MSG.encouragement(fn, gradeRef.current, streakRef.current, todayMinsRef.current));
          else if (roll < 0.65) speak(MSG.humor(fn, studyMinsRef.current));
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
  useEffect(() => {
    if (!visible) return;
    const scheduleHealth = (): ReturnType<typeof setTimeout> => {
      const delay = (30 + Math.random() * 20) * 60_000; // 30–50 min
      return setTimeout(() => {
        if (isStudyingRef.current && !isPausedRef.current) {
          const now = Date.now();
          if (now - lastHealthAt.current > 25 * 60_000) {
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

  // ── Browser notification permission ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [visible]);

  // ── Anti-cheat: tab-away detection ────────────────────────────────────────
  // • 1 min away  → soft background voice nudge
  // • 3 min away  → proper background voice + OS notification
  // • 15 min away → auto-pause timer
  // • On return   → show popup with exactly how long they were away
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

        // 1 min — very soft nudge
        if (bgSpeakTimer.current) clearTimeout(bgSpeakTimer.current);
        bgSpeakTimer.current = setTimeout(() => {
          if (!document.hidden || !isStudyingRef.current) return;
          bgSpeak(pick([
            `${fn}, you're still on the clock.`,
            `Hey ${fn}, you left the study room open.`,
            `${fn}... don't forget you're in a study session.`,
            `${fn}, just a reminder — timer's still running.`,
            `Hey — ${fn}, the clock is still going.`,
          ]));
        }, 1 * 60_000);

        // 3 min — real reminder + OS notification
        if (osNotifTimer.current) clearTimeout(osNotifTimer.current);
        osNotifTimer.current = setTimeout(() => {
          if (!document.hidden || !isStudyingRef.current) return;
          bgSpeak(pick([
            `${fn}, you've been away 3 minutes. The clock is still running.`,
            `Hey — ${fn}. It's been 3 minutes. Come back when you're ready.`,
            `${fn}, 3 minutes away. Your study timer hasn't stopped.`,
            `Still here, ${fn}? Three minutes now. Timer's running.`,
          ]));
          sendOsNotif(
            `Still studying, ${fn}?`,
            `You've been away 3 minutes. Come back when you're ready.`,
          );
        }, 3 * 60_000);

        // 15 min — auto-pause (honest timer tracking)
        if (autoPauseTimer.current) clearTimeout(autoPauseTimer.current);
        autoPauseTimer.current = setTimeout(() => {
          if (!document.hidden || !isStudyingRef.current) return;
          if (!isPausedRef.current) {
            setIsPaused(true);
            isPausedRef.current = true;
            pauseCbRef.current?.();
          }
          bgSpeak(pick([
            `${fn}, you've been away 15 minutes. I've paused your timer.`,
            `15 minutes away, ${fn}. I paused the clock — come back when you're ready.`,
            `${fn}, timer paused after 15 minutes. It's all good — just come back.`,
          ]));
          sendOsNotif(
            `Timer paused, ${fn}`,
            "You've been away 15 minutes. I've paused your study timer.",
          );
        }, 15 * 60_000);

      } else {
        // Returned to tab
        if (bgSpeakTimer.current)  { clearTimeout(bgSpeakTimer.current);  bgSpeakTimer.current  = null; }
        if (osNotifTimer.current)  { clearTimeout(osNotifTimer.current);   osNotifTimer.current  = null; }
        if (autoPauseTimer.current){ clearTimeout(autoPauseTimer.current); autoPauseTimer.current = null; }

        const at = tabHiddenAt.current;
        tabHiddenAt.current = null;
        if (!at || !isStudyingRef.current) return;

        const secsAway = Math.round((Date.now() - at) / 1_000);
        if (secsAway < 60) return; // under 1 min — ignore

        const minsAway = Math.max(1, Math.round(secsAway / 60));
        distractCount.current += 1;

        if (distractCount.current >= 3) setEmotionBoth("frustrated");
        else if (distractCount.current >= 2) setEmotionBoth("concerned");
        else setEmotionBoth("concerned");

        let returnMsg: string;
        if (isPausedRef.current) {
          // Timer was auto-paused — give full summary
          returnMsg = MSG.returnSummary(fn, minsAway, gradeRef.current);
        } else {
          // Short enough absence — just note it
          returnMsg = MSG.comeBack(fn, minsAway, gradeRef.current);
        }

        setPopupMsg(returnMsg);
        speak(returnMsg);
        setDistractPopup(true);

        if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
        popupAutoTimer.current = setTimeout(() => {
          // If they still don't respond after 90s, auto-pause if not already
          if (!isPausedRef.current) {
            setDistractPopup(false);
            setIsPaused(true);
            isPausedRef.current = true;
            setEmotionBoth("concerned");
            pauseCbRef.current?.();
            speak(MSG.inactivityAutoPause(fn));
          }
        }, 90_000);
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (osNotifTimer.current)   clearTimeout(osNotifTimer.current);
      if (bgSpeakTimer.current)   clearTimeout(bgSpeakTimer.current);
      if (autoPauseTimer.current) clearTimeout(autoPauseTimer.current);
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
    speak(pick([
      `Good — let's get back to it, ${fn}.`,
      `Back in the zone. Let's go, ${fn}.`,
      `Welcome back. Focus mode: on.`,
      `Alright. Back on track, ${fn}.`,
      `That's what I like to hear. Keep going.`,
      `Nice. Still in it, ${fn}. Don't let that momentum slip.`,
      `Good. Keep doing exactly what you were doing.`,
      `Okay, ${fn}. Focus back. Let's finish this properly.`,
      `Back and focused. That's all I needed to know, ${fn}.`,
    ]));
  }, [fn, speak, setEmotionBoth]);

  // ── "Taking a break" handler ──────────────────────────────────────────────
  const handleConfirmDistracted = useCallback(() => {
    if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
    setDistractPopup(false);
    breakCountRef.current++;
    idleCheckCountRef.current = 0;

    if (breakCountRef.current <= 2) {
      setEmotionBoth("relaxed");
      speak(pick([
        `Okay, short break, ${fn}. Come back soon — I'll be here.`,
        `Alright, ${fn}. Clear your head and come back.`,
        `Take a breather, ${fn}. Don't make it a long one.`,
        `Quick break noted, ${fn}. Timer's still going — come back when you're ready.`,
        `Got it, ${fn}. Step away, reset, come back focused.`,
        `No problem, ${fn}. Take a moment. Just don't get sucked in.`,
        `Okay, ${fn}. Five minutes max. Then back to it.`,
        `Break time, ${fn}. I trust you to come back.`,
      ]));
    } else {
      setIsPaused(true);
      isPausedRef.current = true;
      setEmotionBoth("concerned");
      pauseCbRef.current?.();
      speak(pick([
        `${fn}, I'm pausing the timer — take a proper break this time. Come back reset.`,
        `Okay, timer's paused, ${fn}. This is your chance to actually reset.`,
        `${fn}, I'm pausing. Rest properly — then let's lock in for real.`,
        `Pausing, ${fn}. You need a real break. Come back focused.`,
        `${fn}, multiple breaks now. I'm pausing. Rest — then come back.`,
      ]));
    }
  }, [fn, speak, setEmotionBoth]);

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
    if (autoPauseTimer.current)    clearTimeout(autoPauseTimer.current);
  }, []);

  const handleMinimize = useCallback((val: boolean) => {
    setMinimized(val);
    onMinimizeChange?.(val);
  }, [onMinimizeChange]);

  if (!visible) return null;

  // ── Distraction popup ─────────────────────────────────────────────────────
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
          style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)", boxShadow: "0 8px 32px rgba(124,58,237,0.45)" }}>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <PukuFace emotion="concerned" size={28} speaking={false} />
            <span className="text-white font-black text-xs tracking-widest flex-1">PUKU</span>
          </div>
          <p className="text-white text-sm font-semibold leading-snug px-4 pb-3">{popupMsg}</p>
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={handleConfirmStudying}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {isPaused ? "I'm back, resume" : "Yes, studying"}
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
    </AnimatePresence>,
    document.body
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
        fill="rgba(255,180,200,1)" opacity={cfg.cheekOpacity} />
      <ellipse cx={cx + s * 0.28} cy={cy + s * 0.12} rx={s * 0.1} ry={s * 0.06}
        fill="rgba(255,180,200,1)" opacity={cfg.cheekOpacity} />
      <path d={mouthPath()} stroke="white" strokeWidth={s * 0.045}
        fill={cfg.mouthPath === "open-up" ? "rgba(255,255,255,0.3)" : "none"}
        strokeLinecap="round" />
      {speaking && (
        <ellipse cx={cx} cy={mouthY} rx={mouthW * 0.35} ry={mouthH * 0.6}
          fill="rgba(255,255,255,0.3)" />
      )}
    </svg>
  );
}
