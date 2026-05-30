import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useTimer } from "@/context/TimerContext";
import { getNepaliDate, NPT_OFFSET_MS } from "@/lib/nepaliDate";

export type MissionLevel      = "beginner" | "intermediate" | "advanced";
export type MissionDifficulty = "easy" | "mid" | "hard";
export type MissionType       = "pomodoro" | "manual";

export interface Mission {
  id: string;
  text: string;
  difficulty: MissionDifficulty;
  type: MissionType;
  // Minutes-based missions (subject_study)
  targetMinutes?: number;
  startedAt?: number;           // savedMinutesToday when mission was started
  // Session-based missions (pomodoro_cycle) — 1 session = one 25-min work block
  targetSessions?: number;
  sessionsAtStart?: number;     // sessionsCompleted when mission was started
  completed: boolean;
  completedAt?: string;
  emoji: string;
  actionLink?: string;
  actionLabel?: string;
}

interface CachedMissionState {
  missions: Mission[];
  allCompleted: boolean;
  studyMinsAtStart: number;
  level: MissionLevel;
  version?: number;
}

// Bump this whenever mission structure changes to force a regeneration for all users
const MISSION_VERSION = 6;
const CACHE_KEY  = (uid: string, date: string) => `sh_dm_${uid}_${date}`;
export const POMODORO_MISSION_KEY = "sh_mission_timer";

export interface PomodoroMissionPreset {
  missionId: string;
  missionText: string;
  targetMinutes: number;
  date: string;
}

// Captured once when the module is first imported — used by the anti-cheat guard
// to ensure the page has been open for a minimum time before completions are allowed.
const _PAGE_LOAD_TIME = Date.now();

function readCache(uid: string, date: string): CachedMissionState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY(uid, date));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMissionState;
    if (parsed.version !== MISSION_VERSION) return null;
    return parsed;
  } catch { return null; }
}
function writeCache(uid: string, date: string, s: CachedMissionState) {
  try { localStorage.setItem(CACHE_KEY(uid, date), JSON.stringify({ ...s, version: MISSION_VERSION })); } catch {}
}

function seededRand(seed: string): () => number {
  let h = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
    h ^= h >>> 16;
  }
  return () => {
    h ^= h << 13; h ^= h >> 7; h ^= h << 17;
    return (h >>> 0) / 0x100000000;
  };
}
function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ── Mission level progression ─────────────────────────────────────────────────
// Level is based on the number of days the student has completed ALL daily missions.
// Beginner → Intermediate: 5 completed days | Intermediate → Advanced: 15 completed days
const MCD_KEY = (uid: string) => `sh_mcd_${uid}`;

export function getMissionCompletedDays(uid: string): number {
  if (!uid) return 0;
  try {
    const raw = localStorage.getItem(MCD_KEY(uid));
    if (!raw) return 0;
    return (JSON.parse(raw) as { days: number; lastDate: string }).days ?? 0;
  } catch { return 0; }
}

export function incrementMissionCompletedDays(uid: string, date: string): number {
  if (!uid) return 0;
  try {
    const key = MCD_KEY(uid);
    const raw = localStorage.getItem(key);
    let data: { days: number; lastDate: string } = { days: 0, lastDate: "" };
    if (raw) data = JSON.parse(raw);
    if (data.lastDate === date) return data.days; // idempotent — already counted today
    data.days += 1;
    data.lastDate = date;
    localStorage.setItem(key, JSON.stringify(data));
    // Background sync to Firestore so level persists across devices
    updateDoc(doc(db, "users", uid), { missionCompletedDays: data.days }).catch(() => {});
    return data.days;
  } catch { return 0; }
}

export function getUserLevel(missionCompletedDays: number): MissionLevel {
  if (missionCompletedDays >= 15) return "advanced";
  if (missionCompletedDays >= 5)  return "intermediate";
  return "beginner";
}

// ─── Mission 1: Pomodoro Study ────────────────────────────────────────────────
// Tracked by minutes — auto-completes when the timer logs enough study time.
// targetMinutes: 50 (beginner) | 100 (intermediate) | 150 (advanced)
function getPomodoroMission(level: MissionLevel, grade: number): Mission {
  const isBoardYear = grade === 10 || grade === 12;
  const examName    = grade === 10 ? "SEE" : "NEB";

  const minsMap: Record<MissionLevel, number> = { beginner: 50, intermediate: 100, advanced: 150 };
  const mins = minsMap[level];

  let text: string;
  if (grade === 13) { // CEE
    text = level === "beginner"
      ? `Study for ${mins} minutes using the Pomodoro timer today. Focus on Biology, Chemistry, or Physics for your CEE preparation.`
      : level === "intermediate"
      ? `Log ${mins} minutes of focused Pomodoro study for CEE. Work through MCQs in your weakest science subject — no phone, full focus.`
      : `Complete ${mins} minutes of intensive CEE preparation using the Pomodoro timer. Exam conditions — solve MCQs under pressure, no shortcuts.`;
  } else if (grade === 14) { // IOE
    text = level === "beginner"
      ? `Study for ${mins} minutes using the Pomodoro timer today. Focus on Math, Physics, or Chemistry for your IOE preparation.`
      : level === "intermediate"
      ? `Log ${mins} minutes of focused Pomodoro study for IOE preparation. Work on your most difficult subject — timer running, no distractions.`
      : `Complete ${mins} minutes of serious IOE preparation. Full concentration on problem-solving — timer running the whole time, no shortcuts.`;
  } else if (grade === 15) { // Bachelor's
    text = level === "beginner"
      ? `Study for ${mins} minutes using the Pomodoro timer today. Pick your most demanding subject and let the timer track your focus.`
      : level === "intermediate"
      ? `Log ${mins} minutes of focused Pomodoro study for your bachelor's subjects. Deep work — one subject, full focus, no phone.`
      : `Complete ${mins} minutes of serious study using the Pomodoro timer. This is your deep work session — every minute counts.`;
  } else if (level === "beginner") {
    text = isBoardYear
      ? `Study for ${mins} minutes using the Pomodoro timer for your ${examName} prep. Start the timer, stay at your desk, and let it track your focus time automatically.`
      : `Study for ${mins} minutes using the Pomodoro timer today. Start the timer, pick one subject, and stay focused until it finishes.`;
  } else if (level === "intermediate") {
    text = isBoardYear
      ? `Log ${mins} minutes of focused Pomodoro study for ${examName} preparation today. Use the timer to stay on track — no phone, no distractions.`
      : `Study for ${mins} minutes with the Pomodoro timer today. Focus on your hardest subject and let the timer log your progress.`;
  } else {
    text = isBoardYear
      ? `Complete ${mins} minutes of serious Pomodoro study for ${examName} preparation. Full concentration — timer running the whole time, no shortcuts.`
      : `Study for ${mins} minutes using the Pomodoro timer. This is your deep work session — no distractions, full focus, every minute counts.`;
  }

  return {
    id: "pomodoro_cycle",
    text,
    difficulty: level === "beginner" ? "easy" : level === "intermediate" ? "mid" : "hard",
    type: "pomodoro",
    targetMinutes: mins,
    completed: false,
    emoji: "⏱️",
  };
}

// ─── Mission 2: School Assignment + Notes ─────────────────────────────────────
// Each grade has a different school context — no board exam for grades 9 and 11.
function getSchoolTaskMission(grade: number): Mission {
  let text: string;
  if (grade === 9) {
    text = "Finish all your homework for tomorrow. If you are stuck on any topic, open Notes to find help — it is all there for you.";
  } else if (grade === 10) {
    text = "Finish your homework and any pending SEE preparation tasks today. Open the Notes section if you need to revise any chapter quickly.";
  } else if (grade === 11) {
    text = "Complete all your school assignments for today. Open Notes below to review any +2 topic or chapter you are unclear about.";
  } else if (grade === 12) {
    text = "Finish your board revision assignments for today. Use the Notes section to quickly revise any chapter before you write your answers.";
  } else if (grade === 13) { // CEE
    text = "Complete your daily CEE MCQ revision set. Focus on Biology, Chemistry, and Physics topics that frequently appear in entrance exams.";
  } else if (grade === 14) { // IOE
    text = "Finish your daily IOE practice problems in Math, Physics, or Chemistry. Consistent MCQ practice every day separates toppers from the rest.";
  } else if (grade === 15) { // Bachelor's
    text = "Complete your assignments and required readings for today's bachelor's subjects. Staying on top of coursework prevents last-minute cramming.";
  } else {
    text = "Finish all your pending study tasks for today. Open Notes if you need help reviewing any topic.";
  }
  return {
    id: "school_task",
    text,
    difficulty: "easy",
    type: "manual",
    completed: false,
    emoji: "📚",
    actionLink: "/notes",
    actionLabel: "Open Notes",
  };
}

// ─── Mission 3: Subject Study Time ────────────────────────────────────────────
// Tracked by minutes. Grade 9 and 11 do NOT mention board exams.
function getSubjectStudyMission(level: MissionLevel, grade: number): Mission {
  const minsMap: Record<number, Record<MissionLevel, number>> = {
    9:  { beginner: 25, intermediate: 40, advanced: 60  },
    10: { beginner: 30, intermediate: 50, advanced: 75  },
    11: { beginner: 30, intermediate: 50, advanced: 75  },
    12: { beginner: 40, intermediate: 60, advanced: 90  },
    13: { beginner: 40, intermediate: 60, advanced: 90  }, // CEE
    14: { beginner: 40, intermediate: 60, advanced: 90  }, // IOE
    15: { beginner: 30, intermediate: 50, advanced: 75  }, // Bachelor's
  };
  const gradeKey = [9, 10, 11, 12, 13, 14, 15].includes(grade) ? grade : 10;
  const mins = minsMap[gradeKey][level];

  let text: string;
  if (grade === 10) {
    if (level === "beginner")     text = `Pick one SEE subject you find hard and study it for ${mins} minutes — phone away, full focus.`;
    else if (level === "intermediate") text = `Study your most difficult SEE subject for ${mins} minutes using the Pomodoro timer. No distractions.`;
    else                          text = `${mins} minutes of serious SEE preparation on your weakest subject. Exam conditions — no shortcuts.`;
  } else if (grade === 12) {
    if (level === "beginner")     text = `Choose one board subject you have not revised yet and study it for ${mins} minutes — focused and phone-free.`;
    else if (level === "intermediate") text = `${mins} minutes on your hardest board subject. Write key points as you study — do not just read.`;
    else                          text = `${mins} minutes of board exam preparation on the subject you struggle with most. Full concentration.`;
  } else if (grade === 11) {
    if (level === "beginner")     text = `Pick the +2 subject you find most difficult and study it for ${mins} minutes — understand it, do not just memorize.`;
    else if (level === "intermediate") text = `Study your most challenging +2 subject for ${mins} minutes. Focus on understanding concepts, not just reading.`;
    else                          text = `${mins} minutes of deep study on the hardest +2 subject for you. Write your own notes as you go.`;
  } else if (grade === 13) { // CEE
    if (level === "beginner")     text = `Pick your weakest CEE subject — Biology, Chemistry, or Physics — and study it for ${mins} minutes. Phone away, full focus.`;
    else if (level === "intermediate") text = `${mins} minutes on your hardest CEE subject. Solve MCQs and write explanations for any you get wrong.`;
    else                          text = `${mins} minutes of exam-condition CEE practice on your weakest science subject. Timed, no notes — full concentration.`;
  } else if (grade === 14) { // IOE
    if (level === "beginner")     text = `Pick your weakest IOE subject — Math, Physics, or Chemistry — and study it for ${mins} minutes. No phone, just problem-solving.`;
    else if (level === "intermediate") text = `${mins} minutes on your hardest IOE subject. Work through past problems and write out full solutions for every error.`;
    else                          text = `${mins} minutes of timed IOE problem-solving on your weakest subject. No calculator crutch — build exam speed.`;
  } else if (grade === 15) { // Bachelor's
    if (level === "beginner")     text = `Pick your most challenging bachelor's subject and study it for ${mins} minutes — notes open, phone away.`;
    else if (level === "intermediate") text = `${mins} minutes of deep study on your hardest bachelor's subject. Write summaries — do not just re-read.`;
    else                          text = `${mins} minutes of focused study on your most difficult course. Write notes, solve problems, engage actively.`;
  } else {
    if (level === "beginner")     text = `Pick any one subject you find hard and study it for ${mins} minutes — no phone, just the book and your notebook.`;
    else if (level === "intermediate") text = `${mins} minutes on your weakest subject using the Pomodoro timer. Focus completely — no distractions.`;
    else                          text = `${mins} minutes of focused study on the subject you find hardest. Write notes as you go.`;
  }

  return {
    id: "subject_study",
    text,
    difficulty: level === "beginner" ? "easy" : level === "intermediate" ? "mid" : "hard",
    type: "pomodoro",
    targetMinutes: mins,
    completed: false,
    emoji: "📖",
  };
}

// ─── Mission 4: Wellness / Life ───────────────────────────────────────────────
const WELLNESS_MISSIONS: Array<{ text: string; emoji: string }> = [
  { text: "Go for a 10 minute walk outside or around your building. Moving your body makes your brain sharper — this is not optional.", emoji: "🚶" },
  { text: "Do 10 minutes of light exercise right now — jumping jacks, stretching, or simple push-ups. Your body needs to move after sitting for hours.", emoji: "💪" },
  { text: "Spend 20 minutes with your family this evening — eat together or just sit and talk. You study better when you feel settled at home.", emoji: "🏠" },
  { text: "Drink at least 3 full glasses of water today while you study. Put a glass of water on your desk right now and start.", emoji: "💧" },
  { text: "Clean and organize your study table before your next session. A cluttered desk makes your brain work harder than it needs to.", emoji: "🧹" },
  { text: "Put your phone in another room for your next full study session. You can pick it up when you finish — not before.", emoji: "📵" },
  { text: "Eat a proper meal this evening before your study session. Not biscuits or chips — a real meal. Your brain runs on food.", emoji: "🍽️" },
  { text: "Take 10 minutes to tidy your room before you sit down to study. Starting with a small win builds your study momentum.", emoji: "🏡" },
  { text: "Spend 10 minutes outside in daylight between study sessions — even just standing on the balcony. Sunlight resets your energy.", emoji: "☀️" },
  { text: "Plan tomorrow's study schedule right now — write which subjects you will study and for how long. Preparation beats panic every time.", emoji: "📋" },
];

// ─── Mission 5: Grade-specific mission ────────────────────────────────────────
// Grade 10 and 12: board exam year → PYQ / important questions practice.
// Grade 9 and 11: NO board exam → class-based learning, concept mastery.
function getGradeMission(level: MissionLevel, grade: number, rand: () => number): Mission {
  const isBoardYear = grade === 10 || grade === 12;
  const diff: MissionDifficulty = level === "advanced" ? "hard" : level === "intermediate" ? "mid" : "easy";

  // ── CEE (13) — Medical entrance exam ─────────────────────────────────────
  if (grade === 13) {
    const count = level === "beginner" ? 15 : level === "intermediate" ? 30 : 50;
    const text = level === "beginner"
      ? `Open the Important Questions section and answer ${count} Biology or Chemistry MCQs. Check every answer carefully after you finish.`
      : level === "intermediate"
      ? `Solve ${count} mixed CEE MCQs from Biology, Chemistry, and Physics without looking at answers. Grade yourself honestly and review every mistake.`
      : `Attempt a full timed CEE mock set of ${count} questions — exam conditions, no notes, no phone. Analyze every wrong answer after.`;
    return { id: "grade_mission", text, difficulty: diff, type: "manual", completed: false,
      emoji: level === "advanced" ? "🏆" : level === "intermediate" ? "📄" : "📝",
      actionLink: "/pyqs", actionLabel: "Open Practice Questions" };
  }

  // ── IOE (14) — Engineering entrance exam ──────────────────────────────────
  if (grade === 14) {
    const count = level === "beginner" ? 10 : level === "intermediate" ? 20 : 40;
    const text = level === "beginner"
      ? `Solve ${count} IOE-style problems in Math or Physics. Write full solutions — do not skip steps.`
      : level === "intermediate"
      ? `Complete ${count} timed IOE problems in your weakest subject. Review every wrong answer and understand the concept behind it.`
      : `Attempt a full timed IOE mock section — ${count} problems, exam conditions, no shortcuts. Analyze your errors after.`;
    return { id: "grade_mission", text, difficulty: diff, type: "manual", completed: false,
      emoji: level === "advanced" ? "🏆" : level === "intermediate" ? "📐" : "🔢",
      actionLink: "/pyqs", actionLabel: "Open Practice Questions" };
  }

  // ── Bachelor's (15) — University student ──────────────────────────────────
  if (grade === 15) {
    const options: Array<{ text: string; emoji: string }> = [
      { text: "Write a 1-page summary of the most complex topic from your current course — in your own words, without copying from notes.", emoji: "📝" },
      { text: "Solve or attempt all the exercise questions from the chapter you studied today. Do not skip any — check your answers after.", emoji: "📖" },
      { text: "Pick your most difficult subject and create a structured mind map connecting all key concepts from the current unit.", emoji: "🗺️" },
      { text: "Review your lecture notes from this week and mark every concept you are uncertain about. Start studying the first one right now.", emoji: "🔍" },
      { text: "Write out all the key definitions, formulas, and theorems from your current chapter — from memory first, then check accuracy.", emoji: "✏️" },
      { text: "Read ahead in your most challenging subject and prepare a question list for your next class or study session.", emoji: "📋" },
    ];
    const chosen = pick(options, rand);
    return { id: "grade_mission", text: chosen.text, difficulty: diff, type: "manual", completed: false, emoji: chosen.emoji };
  }

  // ── Board year grades (10 = SEE, 12 = NEB) ────────────────────────────────
  if (isBoardYear) {
    const examName      = grade === 10 ? "SEE" : "NEB";
    const questionCount = level === "beginner" ? 5 : level === "intermediate" ? 10 : 15;
    let text: string;

    if (level === "beginner") {
      text = `Open the Important Questions section and solve ${questionCount} questions from your weakest ${examName} subject. Check every answer after you finish.`;
    } else if (level === "intermediate") {
      text = `Solve ${questionCount} important ${examName} questions from the Important Questions section without looking at the answers first. Grade yourself honestly after.`;
    } else {
      text = `Attempt one full set of important ${examName} questions under timed exam conditions — no notes, no phone. Review every mistake after you finish.`;
    }

    return {
      id: "grade_mission",
      text,
      difficulty: diff,
      type: "manual",
      completed: false,
      emoji: level === "advanced" ? "🏆" : level === "intermediate" ? "📄" : "📝",
      actionLink: "/pyqs",
      actionLabel: "Open Important Questions",
    };
  }

  // ── Grade 11 — First year of NEB +2, no board exam ────────────────────────
  // Focus: adapting to college-level content, concept mastery, derivations, lab work
  if (grade === 11) {
    const options: Array<{ text: string; emoji: string }> = [
      { text: "Write a lab report for your most recent Physics or Chemistry practical — proper format: aim, method, result, conclusion. Do it from memory first.", emoji: "🔬" },
      { text: "Pick the hardest derivation from your current Physics or Math chapter and derive it from scratch without looking at the book.", emoji: "📐" },
      { text: "Make a structured mind map for the most complex chapter you are studying right now. Connect all the key concepts — no loose ends.", emoji: "🗺️" },
      { text: "Read ahead in your hardest subject and write bullet notes on the next chapter before your teacher covers it in class.", emoji: "📖" },
      { text: "Go through your current chapter in your weakest subject and write out every definition, law, and formula — in your own words.", emoji: "✏️" },
      { text: "Solve all the exercise questions at the end of the chapter you studied today. Do not skip any — check each answer after.", emoji: "📝" },
    ];
    const chosen = pick(options, rand);
    return {
      id: "grade_mission",
      text: chosen.text,
      difficulty: diff,
      type: "manual",
      completed: false,
      emoji: chosen.emoji,
    };
  }

  // ── Grade 9 — Foundation year, no board exam ──────────────────────────────
  // Focus: building study habits, understanding core concepts, completing exercises
  const options: Array<{ text: string; emoji: string }> = [
    { text: "Write down everything you remember from today's most important lesson — from memory, without opening your notebook. Then check what you missed.", emoji: "✏️" },
    { text: "Complete all the exercise questions at the end of the chapter you studied today. Write full solutions — do not just circle answers.", emoji: "📝" },
    { text: "Read the next chapter in your hardest subject before your teacher covers it. Come to class tomorrow prepared with at least one question to ask.", emoji: "📖" },
    { text: "Write out all the key formulas from today's Math or Science lesson in your formula notebook. Quiz yourself on each one after.", emoji: "🔢" },
    { text: "Go through this week's notes and mark every topic you do not understand. Start studying the first one on your list right now.", emoji: "🔍" },
    { text: "Pick one subject from today's class and write a clear one-page summary of what you learned — in your own words, not copied.", emoji: "🗒️" },
  ];
  const chosen = pick(options, rand);
  return {
    id: "grade_mission",
    text: chosen.text,
    difficulty: diff,
    type: "manual",
    completed: false,
    emoji: chosen.emoji,
  };
}

// ─── Mission builder ──────────────────────────────────────────────────────────
export function buildMissions(
  uid: string,
  date: string,
  level: MissionLevel,
  grade: number,
  isSaturday: boolean,
  studyMinsNow: number = 0,
): Mission[] {
  const rand = seededRand(uid + date);

  if (isSaturday) {
    return [
      {
        id: "school_task",
        text: "It is Saturday — finish any pending homework or assignment from this week. Open Notes if you need help with any topic.",
        difficulty: "easy", type: "manual", completed: false, emoji: "📚",
        actionLink: "/notes", actionLabel: "Open Notes",
      },
      getSubjectStudyMission(level, grade),
    ];
  }

  const wellnessItem = pick(WELLNESS_MISSIONS, rand);

  return [
    // Mission 1 & 3: both require the student to press "Start This Mission" so each
    // tracks independently from the moment they deliberately begin that specific task.
    getPomodoroMission(level, grade),
    getSchoolTaskMission(grade),
    getSubjectStudyMission(level, grade),
    {
      id: "wellness",
      text: wellnessItem.text,
      difficulty: "easy",
      type: "manual",
      completed: false,
      emoji: wellnessItem.emoji,
    },
    getGradeMission(level, grade, rand),
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDailyMissions() {
  const { user, profile } = useAuth();
  const { savedMinutesToday, naturalSessionsCompleted } = useTimer();

  const [date, setDate] = useState(() => getNepaliDate());
  useEffect(() => {
    const id = setInterval(() => {
      const today = getNepaliDate();
      setDate(prev => (prev !== today ? today : prev));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const isSaturday = new Date(Date.now() + NPT_OFFSET_MS).getUTCDay() === 6;
  const uid = (user?.uid ?? (profile as Record<string, unknown> | null)?.["uid"] as string | undefined) ?? null;

  const level = useMemo(() => {
    return getUserLevel(getMissionCompletedDays(uid ?? ""));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Try to read cached state even before Firebase Auth resolves (uid is null
  // on the first render). Scan localStorage for any sh_dm_*_<date> key so the
  // user sees their missions instantly without waiting for Firestore.
  const [missions, setMissions] = useState<Mission[]>(() => {
    if (uid) {
      const c = readCache(uid, date);
      if (c && c.missions.length > 0) return c.missions;
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("sh_dm_") && key.endsWith(`_${date}`)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const p = JSON.parse(raw) as CachedMissionState;
            if (p?.version === MISSION_VERSION && Array.isArray(p.missions) && p.missions.length > 0) return p.missions;
          }
        }
      }
    } catch {}
    return [];
  });
  const _initCache = uid ? readCache(uid, date) : null;
  const [loading,          setLoading]          = useState<boolean>(!_initCache);
  const [allCompleted,     setAllCompleted]     = useState(_initCache?.allCompleted ?? false);
  const [studyMinsAtStart, setStudyMinsAtStart] = useState(_initCache?.studyMinsAtStart ?? 0);
  const [fetchTrigger,     setFetchTrigger]     = useState(0);

  const [blockedUntil, setBlockedUntil] = useState(0);
  const completionLogRef = useRef<number[]>([]);
  const completingRef    = useRef<Set<string>>(new Set());
  const syncedRef        = useRef(false);

  // ── Firestore sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid || syncedRef.current) return;
    syncedRef.current = true;
    let mounted = true;

    // Immediately apply local cache so the user sees their missions right away
    // while Firestore is being fetched in the background.
    const localImmediate = readCache(uid, date);
    if (localImmediate && localImmediate.missions.length > 0) {
      setMissions(localImmediate.missions);
      setAllCompleted(localImmediate.allCompleted);
      setStudyMinsAtStart(localImmediate.studyMinsAtStart);
    } else {
      setLoading(true);
    }
    (async () => {
      try {
        const docId  = `${uid}_${date}`;
        const docRef = doc(db, "daily_missions", docId);
        const snap   = await getDoc(docRef);
        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.data();
          // If missions were generated with an older version, regenerate
          if ((data.version ?? 1) < MISSION_VERSION) {
            await deleteDoc(docRef).catch(() => {});
            const grade       = profile?.grade ?? 10;
            const newMissions = buildMissions(uid, date, level, grade, isSaturday, savedMinutesToday);
            const cacheData: CachedMissionState = {
              missions: newMissions, allCompleted: false,
              studyMinsAtStart: savedMinutesToday, level, version: MISSION_VERSION,
            };
            setMissions(newMissions);
            setAllCompleted(false);
            setStudyMinsAtStart(savedMinutesToday);
            writeCache(uid, date, cacheData);
            setDoc(docRef, {
              uid, date, level, grade, isSaturday, version: MISSION_VERSION,
              missions: newMissions, completedCount: 0, allCompleted: false,
              studyMinutesAtStart: savedMinutesToday,
            }).catch(e => console.error("[DailyMissions] Firestore write:", e));
          } else {
            const sm    = data.missions as Mission[];
            const start = data.studyMinutesAtStart ?? 0;

            // Merge Firestore data with local cache.
            // Firestore can lag behind localStorage (e.g. startMission wrote
            // sessionsAtStart locally then the user navigated away before the
            // Firestore updateDoc confirmed). Always prefer the more-advanced
            // local state so mission progress and completion are never lost.
            const localCached = readCache(uid, date);
            const mergedMissions: Mission[] = sm.map(m => {
              const local = localCached?.missions.find(lm => lm.id === m.id);
              if (!local) return m;
              return {
                ...m,
                completed:      m.completed  || local.completed,
                completedAt:    m.completedAt ?? local.completedAt,
                sessionsAtStart: m.sessionsAtStart ?? local.sessionsAtStart,
                startedAt:      m.startedAt  ?? local.startedAt,
              };
            });
            const done = (data.allCompleted ?? false) || (localCached?.allCompleted ?? false);

            setMissions(mergedMissions);
            setAllCompleted(done);
            setStudyMinsAtStart(start);
            writeCache(uid, date, { missions: mergedMissions, allCompleted: done, studyMinsAtStart: start, level: data.level ?? level, version: MISSION_VERSION });
          }
        } else {
          const grade       = profile?.grade ?? 10;
          const newMissions = buildMissions(uid, date, level, grade, isSaturday, savedMinutesToday);
          const cacheData: CachedMissionState = {
            missions: newMissions, allCompleted: false,
            studyMinsAtStart: savedMinutesToday, level, version: MISSION_VERSION,
          };
          setMissions(newMissions);
          setStudyMinsAtStart(savedMinutesToday);
          writeCache(uid, date, cacheData);
          setDoc(docRef, {
            uid, date, level, grade: profile?.grade ?? 10, isSaturday, version: MISSION_VERSION,
            missions: newMissions, completedCount: 0, allCompleted: false,
            studyMinutesAtStart: savedMinutesToday,
          }).catch(e => console.error("[DailyMissions] Firestore write:", e));
        }
      } catch (e) {
        console.error("[DailyMissions] Firestore sync:", e);
        // On error, prefer local cache over regenerating — prevents overwriting
        // completions that were saved locally but not yet confirmed by Firestore.
        if (uid) {
          const localFallback = readCache(uid, date);
          if (localFallback && localFallback.missions.length > 0) {
            setMissions(localFallback.missions);
            setAllCompleted(localFallback.allCompleted);
          } else {
            const newMissions = buildMissions(uid, date, level, profile?.grade ?? 10, isSaturday, savedMinutesToday);
            setMissions(newMissions);
            writeCache(uid, date, { missions: newMissions, allCompleted: false, studyMinsAtStart: savedMinutesToday, level, version: MISSION_VERSION });
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, fetchTrigger]);

  // ── Auto-complete Pomodoro missions ────────────────────────────────────────
  // All pomodoro missions are tracked by minutes.
  // A mission only tracks progress AFTER the student explicitly presses
  // "Go to Pomodoro" from its card (which sets startedAt). This prevents
  // timer use from accidentally completing a mission the student hasn't started.
  useEffect(() => {
    if (!uid || missions.length === 0) return;
    for (const m of missions) {
      if (m.type !== "pomodoro" || m.completed) continue;
      if (completingRef.current.has(m.id)) continue;
      if (!m.targetMinutes) continue;
      // Mission not started yet — do not track any minutes until the student
      // explicitly starts this mission from its card.
      if (m.startedAt === undefined) continue;
      const minutesDone = Math.max(0, savedMinutesToday - m.startedAt);
      if (minutesDone >= m.targetMinutes) {
        completingRef.current.add(m.id);
        _doComplete(uid, date, missions, m.id, setMissions, setAllCompleted);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMinutesToday, missions, studyMinsAtStart]);

  // ── Level progression: increment mission-completed-days on full completion ──
  // Uses a ref to avoid double-counting within a session. The increment function
  // itself is idempotent (won't count the same calendar day twice).
  const mcdIncrementedRef = useRef(false);
  useEffect(() => {
    if (!uid || !allCompleted || mcdIncrementedRef.current) return;
    mcdIncrementedRef.current = true;
    incrementMissionCompletedDays(uid, date);
  }, [allCompleted, uid, date]);
  // Reset flag when the date rolls over (new day = new missions)
  useEffect(() => { mcdIncrementedRef.current = false; }, [date]);

  // ── Listen for external mission completions (from StudyGuardian) ───────────
  // StudyGuardian runs at app level and completes missions while the user is on
  // the Pomodoro page. When it does, it dispatches this event so the missions
  // list refreshes from cache without a full Firestore round-trip.
  useEffect(() => {
    if (!uid) return;
    const handler = () => {
      const fresh = readCache(uid, date);
      if (fresh) {
        setMissions(fresh.missions);
        setAllCompleted(fresh.allCompleted);
      }
    };
    window.addEventListener("sh:missionCompleted", handler);
    return () => window.removeEventListener("sh:missionCompleted", handler);
  }, [uid, date]);

  // ── Start a Pomodoro mission ───────────────────────────────────────────────
  // Records the current savedMinutesToday on the mission so auto-complete can
  // measure progress from the moment the student clicked "Go to Pomodoro".
  const startMission = useCallback((missionId: string, _missionText: string, _targetMinutes: number) => {
    if (!uid) return;
    const updated = missions.map(m => m.id === missionId ? {
      ...m,
      // Only set startedAt if not already set — preserves auto-tracking from mission creation
      startedAt: m.startedAt ?? savedMinutesToday,
    } : m);

    // Write cache SYNCHRONOUSLY before setMissions (async) so that if the user
    // navigates away before React flushes the state update, the cache already
    // has startedAt persisted.
    const c = readCache(uid, date);
    writeCache(uid, date, { missions: updated, allCompleted: c?.allCompleted ?? false, studyMinsAtStart: c?.studyMinsAtStart ?? 0, level: c?.level ?? level, version: MISSION_VERSION });

    setMissions(() => updated);
    setDoc(doc(db, "daily_missions", `${uid}_${date}`), { missions: updated }, { merge: true }).catch(() => {});
  }, [uid, date, savedMinutesToday, missions, level]);

  // ── Anti-cheat: persist blockedUntil across page refreshes ────────────────
  useEffect(() => {
    if (!uid) return;
    try {
      const raw = localStorage.getItem(`sh_ac_${uid}`);
      if (!raw) return;
      const t = parseInt(raw, 10);
      if (!isNaN(t) && t > Date.now()) setBlockedUntil(t);
    } catch {}
  }, [uid]);

  // ── Manual complete (with anti-cheat) ─────────────────────────────────────
  // pageLoadTime is captured once at module scope so it persists across re-renders
  const completeMission = useCallback((missionId: string) => {
    if (!uid || completingRef.current.has(missionId)) return;

    // Guard 1: Pomodoro missions MUST auto-complete via timer tracking.
    // A manual tap on a pomodoro mission is either a bug or cheating — reject it.
    const mission = missions.find(m => m.id === missionId);
    if (!mission || mission.type === "pomodoro") return;

    const now = Date.now();

    // Guard 2: Respect the block period (set by rapid-tap detection below).
    if (now < blockedUntil) return;

    // Guard 3: Page must have been open for at least 8 seconds.
    // This stops bots or DevTools scripts that call completeMission immediately.
    if (now - _PAGE_LOAD_TIME < 8_000) return;

    // Guard 4: Rapid-tap detection — 2 completions within 4 s triggers a 2-min block.
    const log = [...completionLogRef.current, now].filter(t => now - t < 10_000);
    completionLogRef.current = log;
    if (log.length >= 2 && now - log[0] < 4_000) {
      const blockUntil = now + 120_000;
      setBlockedUntil(blockUntil);
      try { if (uid) localStorage.setItem(`sh_ac_${uid}`, String(blockUntil)); } catch {}
      completionLogRef.current = [];
      return;
    }

    completingRef.current.add(missionId);
    _doComplete(uid, date, missions, missionId, setMissions, setAllCompleted);
  }, [uid, date, missions, blockedUntil]);

  // ── Reset today's missions ─────────────────────────────────────────────────
  const resetMissions = useCallback(async () => {
    if (!uid) return;
    localStorage.removeItem(CACHE_KEY(uid, date));
    try { await deleteDoc(doc(db, "daily_missions", `${uid}_${date}`)); } catch {}
    setMissions([]);
    setAllCompleted(false);
    setStudyMinsAtStart(savedMinutesToday);
    completingRef.current.clear();
    syncedRef.current = false;
    setFetchTrigger(t => t + 1);
  }, [uid, date, savedMinutesToday]);

  const completedCount = missions.filter(m => m.completed).length;
  const progressPct    = missions.length > 0 ? (completedCount / missions.length) * 100 : 0;

  // Returns 0–100 progress for a given mission.
  // Returns 0 until the student explicitly starts the mission from its card.
  // All pomodoro missions use minutes tracked by the timer.
  function missionProgress(m: Mission): number {
    if (m.completed) return 100;
    if (!m.targetMinutes) return 0;
    if (m.startedAt === undefined) return 0;
    const minutesDone = Math.max(0, savedMinutesToday - m.startedAt);
    return Math.min(100, (minutesDone / m.targetMinutes) * 100);
  }

  return {
    missions, loading, completeMission, startMission, missionProgress, resetMissions,
    completedCount, allCompleted, progressPct,
    isSaturday, level, date,
    savedMinutesToday, studyMinsAtStart, blockedUntil,
  };
}

function _doComplete(
  uid: string,
  date: string,
  missions: Mission[],
  missionId: string,
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>,
  setAllCompleted: React.Dispatch<React.SetStateAction<boolean>>,
) {
  setMissions(prev => {
    const updated = prev.map(m =>
      m.id === missionId ? { ...m, completed: true, completedAt: new Date().toISOString() } : m,
    );
    const count  = updated.filter(m => m.completed).length;
    const isDone = count === updated.length && updated.length > 0;
    if (isDone) setAllCompleted(true);

    // Always write cache — even if no prior cache exists — so completions
    // survive a page refresh even if the Firestore write hasn't landed yet.
    const c = readCache(uid, date);
    writeCache(uid, date, {
      missions: updated,
      allCompleted: isDone,
      studyMinsAtStart: c?.studyMinsAtStart ?? 0,
      level: c?.level ?? "beginner",
      version: MISSION_VERSION,
    });

    // Use setDoc+merge so this works whether the Firestore doc exists or not.
    setDoc(doc(db, "daily_missions", `${uid}_${date}`), {
      missions: updated, completedCount: count, allCompleted: isDone,
    }, { merge: true }).catch(() => {});
    if (isDone) {
      updateDoc(doc(db, "users", uid), { lastMissionsCompletedDate: date }).catch(() => {});
    }
    return updated;
  });
}
