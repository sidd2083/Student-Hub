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
    `${fn}, the break is part of the process. Use it properly.`,
    `Five minutes of real rest beats twenty minutes of fake studying.`,
    `Close your eyes for a minute. Seriously — your brain will thank you.`,
    `${fn}, go stand up. Sit back down only when you're ready to focus.`,
    `This is your break. Own it — no half-resting while scrolling.`,
    `Step away from the screen, ${fn}. The notes will still be there.`,
    `Break earned. The rule: actually rest. Not "rest" while watching reels.`,
    `Your brain just did real work. Now let it recharge — properly.`,
  ]),

  milestone5: (fn: string) => pick([
    `Five minutes down, ${fn}! The hardest part is always starting — you already crushed it.`,
    `${fn}, five minutes in. You showed up and stayed. Keep going!`,
    `Nice start. Five minutes is still five minutes. Build on it.`,
    `${fn}, first five minutes done. Most people quit before this. You didn't.`,
    `Five in. The session is real now. Don't stop.`,
    `${fn}, okay — we're doing this. Five minutes strong.`,
    `You showed up and you stayed. Five minutes. That's how it starts.`,
  ]),

  milestone15: (fn: string) => pick([
    `Fifteen minutes, ${fn}. You're locked in now — don't break this flow.`,
    `${fn}, 15 minutes of real work done. You're in the zone. Stay there.`,
    `Quarter hour. Nice.`,
    `${fn}, fifteen minutes. The warm-up is over. This is the real session now.`,
    `15 minutes in and still going. That's the ${fn} I know.`,
    `Quarter hour down. Most people haven't even opened their books yet.`,
    `${fn}, you're fifteen minutes into something real. Don't let it slip.`,
    `Fifteen solid minutes. Your brain is warmed up. Keep pushing.`,
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
    `${fn}, an hour and a half. This is the kind of session that actually moves things.`,
    `Ninety minutes in. The commitment is showing, ${fn}. Keep it going.`,
    `${fn}, ninety minutes. You're not just studying — you're building a habit.`,
    `An hour and a half. That's not luck, ${fn}. That's discipline.`,
  ]),

  milestone120: (fn: string) => pick([
    `Two hours, ${fn}. Two full hours. Your future self will remember this session.`,
    `${fn}! Two hours! I've been here with you the whole time. Truly impressive.`,
    `Two hours of real study. You're doing something most people only talk about.`,
    `${fn}, two hours. That is not normal. That is exceptional. I mean it.`,
    `Two full hours. Whatever exam is coming — you just got more ready for it.`,
    `${fn}, two hours in. The consistency you're showing today is exactly what toppers do.`,
    `You've been at this for two hours, ${fn}. This is the version of you that wins.`,
  ]),

  midSession: (fn: string, m: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${m} minutes in and still going, ${fn}. That's what I like to see.`,
      `Nice pace, ${fn}. Keep it exactly like this.`,
      `${fn}, you're past the hard part now. It gets easier from here.`,
      `Still focused. Good. Don't break it.`,
      `${fn}, you're doing the work other students skip. Remember that.`,
      `${fn}, still here? Good. Keep going — this is it.`,
      `The session is going well, ${fn}. You're building real momentum.`,
      `${fn}, the fact that you haven't quit yet puts you ahead of most.`,
      `This is what studying actually looks like. Not glamorous. Just consistent.`,
      `${fn}, don't overthink it — just keep doing what you're doing.`,
      `You're ${m} minutes in. Most people gave up before this.`,
      `${fn}, the clock is your friend right now. Every minute counts.`,
      `Still focused. I noticed. Good work, ${fn}.`,
      `${fn}, one concept at a time. You've got this.`,
      `Progress doesn't always feel like progress. But this is it.`,
      `${fn}, you're doing better than you realize.`,
      `Don't stop to check if you're doing it right. Just keep going.`,
      `${fn}, if this topic is tough — it means you're actually learning.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [
        `${m} minutes of SEE prep. You're ahead of most right now, ${fn}.`,
        `SEE toppers sit exactly like this, ${fn}. ${m} minutes in.`,
      ],
      grade12:  [
        `${m} minutes of board prep. This is exactly what the top scorers do.`,
        `${fn}, board season rewards the consistent. You're building that consistency now.`,
      ],
      cee:      [
        `${m} minutes of focused CEE prep, ${fn}. This is the difference-maker.`,
        `${fn}, medical entrance is competitive. This session? This is how you compete.`,
      ],
      ioe:      [
        `${m} minutes in. IOE entrance is about this kind of consistency.`,
        `${fn}, engineering entrance doesn't forgive gaps. You're not leaving any.`,
      ],
      bachelors:[
        `${m} minutes down, ${fn}. Small daily progress adds up fast.`,
        `${fn}, consistency beats intensity every time. You're living proof right now.`,
      ],
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
    `${fn}, seriously — water. Don't make me ask twice.`,
    `You've been at this a while. Drink some water, come back sharp.`,
    `${fn}, when did you last hydrate? Go fix that. Right now.`,
    `Your brain runs on water, ${fn}. Literally. Go drink some.`,
    `A glass of water is the cheapest performance upgrade available. Go get it.`,
    `${fn}, dehydration makes everything harder. Water. Now. I'll be here.`,
  ]),

  health: () => pick([
    `Quick tip — relax your shoulders right now. You've been hunched.`,
    `Look away from the screen for 20 seconds. Your eyes need the rest.`,
    `Sit up straight for a second. Good posture actually helps you think.`,
    `Take three deep breaths. Seriously — it resets your focus.`,
    `Stand up and stretch for just 30 seconds. Your back will thank you.`,
    `Blink a few times. Staring at screens reduces blinking — rest your eyes.`,
    `Roll your neck left and right. Slowly. Your muscles will thank you.`,
    `Put your palms over your eyes for 10 seconds. Screen fatigue is real.`,
    `Uncross your legs. Sit with both feet flat on the floor. Go.`,
    `Stretch your arms above your head and hold it for 5 seconds.`,
    `Open a window or look outside for 20 seconds. Natural light helps.`,
    `Wiggle your fingers and shake out your hands. You've been gripping that pen.`,
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
      `${fn}, the gap between where you are and where you want to be is exactly this — sessions like today.`,
      `When this topic feels confusing, that means you're actually engaging with it. Confusion is progress.`,
      `${fn}, you don't have to understand everything right now. Just keep moving forward.`,
      `Take a second to look at what you've already done. That's real. Don't dismiss it.`,
      `${fn}, most students quit in the middle. You're still here. That's the difference.`,
      `If this feels hard, that's because it is hard. Doesn't mean you're doing it wrong.`,
      `${fn}, the secret isn't studying more. It's showing up consistently. You're here. That counts.`,
      `You already made the decision to be here. Don't waste it by holding back.`,
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
    `Nobody who studied less than you is getting the same result. Just saying.`,
    `${fn}, that "five more minutes" you kept pushing? This is it. You're in it.`,
    `Imagine showing someone your screen right now. They'd be impressed.`,
    `${fn}, your classmates are probably scrolling Instagram. You're not. Good.`,
    `Real talk — the people who complain about exams didn't do this. You are.`,
    `${fn}, the session isn't glamorous. Neither is winning. Both take the same thing.`,
  ]),

  comeBack: (fn: string, mins: number, grade?: number) => {
    const ctx = gradeContext(grade);
    const shared = [
      `${fn}, still studying?`,
      `You've been away for ${mins} minutes, ${fn}. Still with me?`,
      `Hey — ${mins} minutes outside. Everything okay, ${fn}?`,
      `${fn}, the clock kept running. You've been away ${mins} minutes.`,
      `${mins} minutes, ${fn}. Where did you go?`,
      `You left the session open for ${mins} minutes. Still coming back?`,
      `${fn}... ${mins} minutes away. I was starting to wonder.`,
      `Back already? You were gone ${mins} minutes. Still studying or taking a break?`,
      `${fn}, ${mins} minutes just passed. Timer was still running. Still in?`,
      `I noticed you were away, ${fn}. ${mins} minutes. Everything alright?`,
      `Your session's been running without you for ${mins} minutes, ${fn}.`,
    ];
    const specific: Record<string, string[]> = {
      grade10:  [
        `${fn}, ${mins} minutes away from your SEE prep. Still studying?`,
        `${fn}, that's ${mins} minutes of SEE prep time. Come back when you're ready.`,
      ],
      grade12:  [
        `${fn}, ${mins} minutes away. Board prep doesn't stop — come back when you're ready.`,
        `Board exams don't care about distractions, ${fn}. ${mins} minutes gone. Let's go.`,
      ],
      cee:      [
        `${fn}, ${mins} minutes away from your CEE prep. Your seat won't wait. Still studying?`,
        `${fn}, the competition didn't take a ${mins}-minute break. Come back.`,
      ],
      ioe:      [
        `${fn}, ${mins} minutes away. IOE prep in progress — coming back?`,
        `Engineering entrance doesn't wait, ${fn}. ${mins} minutes away. Let's resume.`,
      ],
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
      `${fn}, haven't seen any movement. You good?`,
      `Psst — ${fn}. You still there?`,
      `Hey, just a quick check — still focused, ${fn}?`,
      `${fn}, tap anything if you're still with me.`,
      `You've been very still, ${fn}. Deep focus or drifted off?`,
      `${fn}? Just checking you're still in it.`,
      `A little quiet over there. Still studying, ${fn}?`,
    ]);
    if (count === 2) return pick([
      `${fn}, you've been quiet for a while.`,
      `Haven't heard from you in a bit, ${fn}.`,
      `${fn}... still there?`,
      `You've gone quiet, ${fn}. Still focused?`,
      `It's been a while, ${fn}. You with me?`,
      `${fn}, things got a little too quiet over here.`,
      `I'm still here, ${fn}. Are you?`,
      `${fn}, second check — still in the session?`,
      `You haven't responded, ${fn}. Everything okay?`,
      `${fn}, your session's still running. Just want to make sure you're still in it.`,
    ]);
    return pick([
      `${fn}, should I pause the timer?`,
      `Want me to pause while you sort things out, ${fn}?`,
      `${fn}, I'm going to pause soon if you don't respond.`,
      `Still there, ${fn}? One more check before I pause.`,
      `${fn}, last call before I pause the timer.`,
      `${fn}, I'm about to pause. Tell me you're still there.`,
      `Timer's about to pause, ${fn}. One more chance.`,
      `${fn}, three times now. Say something or I'm pausing.`,
    ]);
  },

  inactivityAutoPause: (fn: string) => pick([
    `No response, ${fn}. I'm pausing your study time.`,
    `You haven't responded. Pausing the timer — come back when you're ready.`,
    `I think you've left, ${fn}. Pausing. Come back and we'll pick this up.`,
    `No response for a while. I'm pausing. You can resume when you're back.`,
    `${fn}, three checks and no reply. I'm pausing — resume when you're ready.`,
    `Pausing the timer, ${fn}. Come back whenever you're actually ready to focus.`,
  ]),

  lockedIn: (fn: string, mins: number) => {
    if (mins <= 25) return pick([
      `${fn}, you're locked in today. Keep going.`,
      `Twenty minutes of solid focus, ${fn}. Don't break it now.`,
      `You're in the zone right now. This is exactly what progress looks like.`,
      `${fn}, this kind of session is what moves the needle. Stay in it.`,
      `Nice. You're finding your rhythm, ${fn}. Keep moving forward.`,
      `${fn}, twenty minutes. The warm-up is long over. This is the real thing.`,
      `You've been locked in for twenty minutes straight, ${fn}. That's rare.`,
      `${fn}, don't stop now. You're right in the middle of something good.`,
      `Twenty minutes. Not checking your phone, not distracted. Just working. That's it.`,
      `${fn}, this is what a good session looks like. Keep exactly this energy.`,
    ]);
    return pick([
      `${fn}, this is some serious focus. Forty-five minutes in.`,
      `${fn}, you've been locked in for a while. The effort is showing.`,
      `This is what real preparation looks like, ${fn}. Genuinely proud of this.`,
      `${fn}, most students never get this deep into a session. You did.`,
      `Forty-five minutes. That's not easy. You're building something real here, ${fn}.`,
      `${fn}, you've been at it for forty-five minutes. Your brain is working hard. Keep going.`,
      `Almost an hour, ${fn}. This session is going to matter.`,
      `${fn}, forty-five minutes of real work. The dedication is real.`,
      `This is the version of you that passes, ${fn}. Forty-five minutes in and still focused.`,
      `${fn}, don't let up now. Forty-five minutes earned — keep building on it.`,
    ]);
  },

  comeback: (fn: string) => pick([
    `Welcome back, ${fn}. Let's finish this properly.`,
    `Good to have you back. Let's pick up where we left off.`,
    `${fn}, you're back. Ready to lock in again?`,
    `Back at it, ${fn}. Let's make the rest of this count.`,
    `There you are. Let's not waste the momentum you already built.`,
    `${fn}, okay — you're back. Let's not lose the pace.`,
    `Break's over. Let's go again, ${fn}.`,
    `${fn}, welcome back. The books missed you. Let's finish this.`,
    `Good. You're back. Don't let that break derail the whole session.`,
    `${fn}, back in the chair. Now back in the focus. You've got this.`,
    `Reset done. Now let's lock back in, ${fn}.`,
    `${fn}, the timer's waiting. Ready to go again?`,
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
  const bgSpeakTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const breakCountRef            = useRef<number>(0);   // how many times "Taking a break" clicked

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
  // Subtitle appears immediately; voice starts 350 ms later so the text
  // is always visible before the voice kicks in.
  const speak = useCallback((text: string) => {
    if (bubbleClearTimer.current) clearTimeout(bubbleClearTimer.current);

    // Show subtitle TEXT immediately (not-speaking state)
    speechCbRef.current(text, false);

    const hasTTS = !muteRef.current && !!window.speechSynthesis;
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
      // 350 ms delay: subtitle renders before voice begins
      setTimeout(() => {
        speechCbRef.current(text, true); // mark as actively speaking
        window.speechSynthesis.speak(utt);
      }, 350);
    };

    bubbleClearTimer.current = setTimeout(() => {
      window.speechSynthesis.cancel();
      speechCbRef.current("", false);
    }, 22_000);

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

  // ── Mid-session check-ins ─────────────────────────────────────────────────
  // More frequent early (8–12 min) so the session feels alive.
  // Spaces out as the student gets deeper in (14–22 min after 45 min).
  useEffect(() => {
    if (!visible) return;
    let callCount = 0;

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      let minD: number, maxD: number;
      if (callCount === 0)          { minD = 8;  maxD = 12; }  // first check-in: 8–12 min
      else if (studyMins < 45)      { minD = 10; maxD = 16; }  // mid-session:   10–16 min
      else                          { minD = 14; maxD = 22; }  // deep session:  14–22 min
      const delay = (minD + Math.random() * (maxD - minD)) * 60_000;

      return setTimeout(() => {
        if (isStudying && !isPaused) {
          callCount++;
          const roll = Math.random();
          if (roll < 0.45)      speak(MSG.encouragement(fn, grade));
          else if (roll < 0.70) speak(MSG.humor(fn));
          else                  speak(MSG.midSession(fn, studyMins, grade));
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

  // ── Anti-cheat: tab-away detection — progressive ─────────────────────────
  // Thresholds scale with offence count: 1st=5min, 2nd=8min, 3rd+=12min.
  // Background TTS fires at 3 min (light nudge) and again at threshold —
  // Chrome & Edge will play the voice even while the tab is in background.
  useEffect(() => {
    if (!visible) return;

    // Helper: speak silently on a background tab via a raw SpeechSynthesisUtterance
    const bgSpeak = (text: string) => {
      if (muteRef.current || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate   = 0.88 + Math.random() * 0.06;
      u.pitch  = 1.0;
      u.volume = 1.0;
      const v = cachedVoiceRef.current ?? pickVoice(window.speechSynthesis.getVoices());
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    };

    const onVis = () => {
      if (document.hidden) {
        if (!isStudying) return;
        tabHiddenAt.current = Date.now();

        // Progressive threshold: 1st=5min, 2nd=8min, 3rd+=12min
        const threshMin = distractCount.current === 0 ? 5
          : distractCount.current === 1 ? 8
          : 12;

        // Early nudge at 3 min — light background voice
        if (bgSpeakTimer.current) clearTimeout(bgSpeakTimer.current);
        bgSpeakTimer.current = setTimeout(() => {
          if (!document.hidden || !isStudying) return;
          bgSpeak(pick([
            `${fn}, you're still on the clock.`,
            `Hey ${fn}, you left the study room open.`,
            `${fn}... don't forget you're in a study session.`,
          ]));
        }, 3 * 60_000);

        // Main check at progressive threshold
        if (osNotifTimer.current) clearTimeout(osNotifTimer.current);
        osNotifTimer.current = setTimeout(() => {
          if (!document.hidden) return;
          // Background voice — audible on another tab
          bgSpeak(pick([
            `${fn}, you've been away for ${threshMin} minutes. The clock is still running.`,
            `Hey — ${fn}. It's been ${threshMin} minutes. Come back when you're ready.`,
            `${fn}, ${threshMin} minutes away. Your study timer hasn't stopped.`,
          ]));
          sendOsNotif(
            `Still studying, ${fn}?`,
            `You've been away for ${threshMin} minutes. Come back when you're ready.`,
          );
        }, threshMin * 60_000);

      } else {
        if (bgSpeakTimer.current) { clearTimeout(bgSpeakTimer.current); bgSpeakTimer.current = null; }
        if (osNotifTimer.current) { clearTimeout(osNotifTimer.current); osNotifTimer.current = null; }

        const at = tabHiddenAt.current;
        tabHiddenAt.current = null;
        if (!at || !isStudying) return;

        const secsAway = Math.round((Date.now() - at) / 1_000);
        const threshMin = distractCount.current === 0 ? 5
          : distractCount.current === 1 ? 8
          : 12;
        if (secsAway < threshMin * 60) return; // not away long enough yet

        const minsAway = Math.max(1, Math.round(secsAway / 60));
        distractCount.current += 1;

        if (distractCount.current >= 3) setEmotionBoth("frustrated");
        else if (distractCount.current >= 2) setEmotionBoth("concerned");
        else setEmotionBoth("concerned");

        const tabAwayMsg = MSG.comeBack(fn, minsAway, grade);
        setIdleCheckMsg(tabAwayMsg);
        speak(tabAwayMsg);
        setDistractPopup(true);

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
      if (bgSpeakTimer.current) clearTimeout(bgSpeakTimer.current);
    };
  }, [visible, isStudying, fn, grade, speak, setEmotionBoth]);

  // ── "Yes, studying" handler ───────────────────────────────────────────────
  const handleConfirmStudying = useCallback(() => {
    if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
    setDistractPopup(false);
    lastWarnedAt.current = Date.now();
    idleCheckCountRef.current = 0;
    lastActivityRef.current = Date.now();
    lastConfirmedStudyingAt.current = Date.now();
    breakCountRef.current = 0; // reset break count on confirmed studying
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
      `Nice. Still in it. Don't let that momentum slip.`,
      `Good. Keep doing exactly what you were doing.`,
    ]));
  }, [isPaused, speak, setEmotionBoth]);

  // ── "Taking a break" handler — smart escalation ───────────────────────────
  // First 2 times: acknowledge without pausing (give benefit of the doubt).
  // 3rd time+: pause the timer and speak directly.
  const handleConfirmDistracted = useCallback(() => {
    if (popupAutoTimer.current) clearTimeout(popupAutoTimer.current);
    setDistractPopup(false);
    breakCountRef.current++;
    idleCheckCountRef.current = 0;

    if (breakCountRef.current <= 2) {
      // Light acknowledgement — timer stays running
      setEmotionBoth("relaxed");
      speak(pick([
        `Okay, short break. Come back soon — I'll be here.`,
        `Alright. Clear your head and come back.`,
        `Take a breather, ${fn}. Don't make it a long one.`,
        `Quick break noted. Timer's still going — come back when you're ready.`,
        `Got it. Step away, reset, come back focused.`,
        `No problem, ${fn}. Take a moment. Just don't get sucked in.`,
      ]));
    } else {
      // Pattern detected — pause and be direct
      setIsPaused(true);
      setEmotionBoth("concerned");
      pauseCbRef.current?.();
      speak(pick([
        `${fn}, this keeps happening. I'm pausing the timer — come back when you're actually ready.`,
        `Okay, timer's paused. Take a proper break this time, ${fn}. Come back reset.`,
        `${fn}, I'm pausing. This is your chance to actually reset. Come back focused.`,
        `Pausing, ${fn}. You need a real break. Take it — then let's lock in properly.`,
        `${fn}, multiple breaks now. I'm pausing the timer. Rest properly, then come back.`,
      ]));
    }
  }, [fn, speak, setEmotionBoth]);

  // ── Resume from paused state ──────────────────────────────────────────────
  const handleResume = useCallback(() => {
    setIsPaused(false);
    resumeCbRef.current?.();
    idleCheckCountRef.current = 0;
    lastActivityRef.current = Date.now();
    lastConfirmedStudyingAt.current = Date.now();
    breakCountRef.current = 0; // fresh start after resuming
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
  }, []);

  const handleMinimize = useCallback((val: boolean) => {
    setMinimized(val);
    onMinimizeChange?.(val);
  }, [onMinimizeChange]);

  if (!visible) return null;

  // ── Distraction popup — portalled to document.body so it always escapes
  //    parent overflow:hidden and fullscreen containers ─────────────────────
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
    </AnimatePresence>,
    document.body
  ) : null;

  // ── Paused state banner — also portalled to document.body ─────────────────
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
