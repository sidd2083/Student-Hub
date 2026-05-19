import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useTimer } from "@/context/TimerContext";
import { getNepaliDate, NPT_OFFSET_MS } from "@/lib/nepaliDate";

export type MissionLevel = "beginner" | "intermediate" | "advanced";
export type MissionDifficulty = "easy" | "mid" | "hard";
export type MissionType = "pomodoro" | "manual";

export interface Mission {
  id: string;
  text: string;
  difficulty: MissionDifficulty;
  type: MissionType;
  targetMinutes?: number;
  completed: boolean;
  completedAt?: string;
  emoji: string;
}

// ─── Seeded random (deterministic per uid+date) ───────────────────────────────
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

// ─── User level ───────────────────────────────────────────────────────────────
export function getUserLevel(
  streak: number,
  totalStudyMins: number,
): MissionLevel {
  if (streak >= 30 || totalStudyMins >= 1200) return "advanced";
  if (streak >= 7  || totalStudyMins >= 300)  return "intermediate";
  return "beginner";
}

// ─── Mission pools ────────────────────────────────────────────────────────────
const SUBJECTS_LOWER = ["Mathematics", "Science", "English", "Nepali", "Social Studies", "Optional Maths"];
const SUBJECTS_UPPER = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Accountancy", "Economics", "Computer Science"];

const FUN_CHALLENGES = [
  { text: "Drink at least 8 glasses of water today",            emoji: "💧" },
  { text: "Do 10 jumping jacks or push-ups right now",          emoji: "💪" },
  { text: "Spend 20 minutes with your family this evening",     emoji: "🏠" },
  { text: "Take a 10-minute walk outside",                      emoji: "🚶" },
  { text: "Write down 3 things you learned today",              emoji: "📝" },
  { text: "No social media for 2 hours today",                  emoji: "📵" },
  { text: "Clean and organize your study desk",                 emoji: "🧹" },
  { text: "Sleep before 10:30 PM tonight",                      emoji: "😴" },
  { text: "Eat a proper meal before your study session",        emoji: "🍱" },
  { text: "Do a 5-minute stretch after each study session",     emoji: "🧘" },
  { text: "No phone for 30 minutes while studying",             emoji: "🔕" },
  { text: "Write your study goals for tomorrow before sleeping", emoji: "🎯" },
  { text: "Drink a glass of water right now",                   emoji: "🥤" },
  { text: "Take a 5-minute break after every 25 minutes of study", emoji: "⏸️" },
];

const ACADEMIC_BEGINNER = [
  { text: "Read your textbook for 20 minutes on any subject",       emoji: "📖" },
  { text: "Memorize 5 key definitions or formulas from any subject", emoji: "🧠" },
  { text: "Solve 5 practice problems from any chapter",             emoji: "✏️" },
  { text: "Make short notes on one topic you find difficult",       emoji: "📋" },
  { text: "Re-read today's class notes once, carefully",            emoji: "👀" },
  { text: "Look up and understand 3 new terms from your textbook",  emoji: "🔍" },
];

const ACADEMIC_INTERMEDIATE = [
  { text: "Revise yesterday's lessons and write key points from memory", emoji: "📝" },
  { text: "Solve 10 MCQs from any subject chapter",                      emoji: "✅" },
  { text: "Write answers for 2 long-answer questions from your notes",   emoji: "📄" },
  { text: "Create a summary sheet for one full chapter",                 emoji: "🗂️" },
  { text: "Review your last test and identify 3 weak areas",             emoji: "🔎" },
  { text: "Solve a complete exercise from your Maths or Science textbook", emoji: "📐" },
];

const ACADEMIC_ADVANCED = [
  { text: "Complete a full chapter revision with self-written notes",   emoji: "📚" },
  { text: "Attempt past exam questions from any one subject",           emoji: "🏆" },
  { text: "Explain a concept out loud for 10 minutes (Feynman technique)", emoji: "🗣️" },
  { text: "Write 3 model answers under timed conditions (20 min each)", emoji: "⏱️" },
  { text: "Identify your weakest topic and study it for 45 minutes",   emoji: "💡" },
  { text: "Solve a complete set of MCQs and subjective from one chapter", emoji: "📊" },
];

// ─── Mission generation ───────────────────────────────────────────────────────
function buildMissions(
  uid: string,
  date: string,
  level: MissionLevel,
  grade: number,
  isSaturday: boolean,
): Mission[] {
  const rand = seededRand(uid + date);
  const subjects = grade >= 11 ? SUBJECTS_UPPER : SUBJECTS_LOWER;
  const subject  = pick(subjects, rand);

  if (isSaturday) {
    const shortStudy = level === "beginner" ? 20 : level === "intermediate" ? 30 : 45;
    return [
      {
        id: "school_task",
        text: "It's Saturday! Do any pending school assignment or review the week's lessons",
        difficulty: "easy",
        type: "manual",
        completed: false,
        emoji: "📚",
      },
      {
        id: "study_time",
        text: `Study for ${shortStudy} minutes today — a little goes a long way!`,
        difficulty: "easy",
        type: "pomodoro",
        targetMinutes: shortStudy,
        completed: false,
        emoji: "⏰",
      },
    ];
  }

  const studyTarget  = level === "beginner" ? 30 : level === "intermediate" ? 60 : 90;
  const focusTarget  = level === "beginner" ? 30 : level === "intermediate" ? 45 : 75;
  const studyDiff: MissionDifficulty  = level === "beginner" ? "easy" : "mid";
  const focusDiff: MissionDifficulty  = level === "beginner" ? "mid" : level === "intermediate" ? "mid" : "hard";
  const academicDiff: MissionDifficulty = level === "beginner" ? "mid" : level === "intermediate" ? "mid" : "hard";

  const academicPool =
    level === "beginner"     ? ACADEMIC_BEGINNER     :
    level === "intermediate" ? ACADEMIC_INTERMEDIATE :
    ACADEMIC_ADVANCED;

  const fun      = pick(FUN_CHALLENGES, rand);
  const academic = pick(academicPool, rand);

  return [
    {
      id: "study_time",
      text: `Study for ${studyTarget} minutes using the Pomodoro timer`,
      difficulty: studyDiff,
      type: "pomodoro",
      targetMinutes: studyTarget,
      completed: false,
      emoji: "⏰",
    },
    {
      id: "school_task",
      text: "Complete your school homework or pending assignment",
      difficulty: "easy",
      type: "manual",
      completed: false,
      emoji: "📚",
    },
    {
      id: "focus",
      text: `Study ${subject} for ${focusTarget} minutes without any distractions`,
      difficulty: focusDiff,
      type: "manual",
      targetMinutes: focusTarget,
      completed: false,
      emoji: "🎯",
    },
    {
      id: "fun",
      text: fun.text,
      difficulty: "easy",
      type: "manual",
      completed: false,
      emoji: fun.emoji,
    },
    {
      id: "academic",
      text: academic.text,
      difficulty: academicDiff,
      type: "manual",
      completed: false,
      emoji: academic.emoji,
    },
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDailyMissions() {
  const { user, profile } = useAuth();
  const { savedMinutesToday } = useTimer();

  const date       = getNepaliDate();
  const isSaturday = new Date(Date.now() + NPT_OFFSET_MS).getUTCDay() === 6;
  const uid        = user?.uid ?? null;

  const level = useMemo(() => {
    const streak   = (profile as Record<string, unknown> | null)?.["streak"]         as number | undefined ?? 0;
    const studyMin = (profile as Record<string, unknown> | null)?.["totalStudyTime"] as number | undefined ?? 0;
    return getUserLevel(streak, studyMin);
  }, [profile]);

  const [missions,         setMissions]         = useState<Mission[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [allCompleted,     setAllCompleted]     = useState(false);
  const [studyMinsAtStart, setStudyMinsAtStart] = useState(0);
  const completingRef = useState<Set<string>>(() => new Set())[0];

  // ── Load or generate today's missions ────────────────────────────────────
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      try {
        const docId  = `${uid}_${date}`;
        const docRef = doc(db, "daily_missions", docId);
        const snap   = await getDoc(docRef);

        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.data();
          setMissions(data.missions as Mission[]);
          setAllCompleted(data.allCompleted ?? false);
          setStudyMinsAtStart(data.studyMinutesAtStart ?? 0);
        } else {
          const grade = profile?.grade ?? 10;
          const newMissions = buildMissions(uid, date, level, grade, isSaturday);
          await setDoc(docRef, {
            uid, date, level,
            grade: profile?.grade ?? 10,
            isSaturday,
            missions: newMissions,
            completedCount: 0,
            allCompleted: false,
            studyMinutesAtStart: savedMinutesToday,
          });
          if (!mounted) return;
          setMissions(newMissions);
          setStudyMinsAtStart(savedMinutesToday);
        }
      } catch (e) {
        console.error("[DailyMissions] load failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // Only re-run when uid or date changes (level determined on first gen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, date]);

  // ── Auto-track Pomodoro study mission ────────────────────────────────────
  useEffect(() => {
    const sm = missions.find(m => m.id === "study_time" && !m.completed);
    if (!sm || !sm.targetMinutes || !uid) return;
    const done = Math.max(0, savedMinutesToday - studyMinsAtStart);
    if (done >= sm.targetMinutes && !completingRef.has("study_time")) {
      completingRef.add("study_time");
      doComplete(uid, date, missions, "study_time", setMissions, setAllCompleted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMinutesToday, studyMinsAtStart]);

  // ── Manual complete ───────────────────────────────────────────────────────
  const completeMission = useCallback(async (missionId: string) => {
    if (!uid || completingRef.has(missionId)) return;
    completingRef.add(missionId);
    await doComplete(uid, date, missions, missionId, setMissions, setAllCompleted);
  }, [uid, date, missions, completingRef]);

  const completedCount = missions.filter(m => m.completed).length;
  const progressPct    = missions.length > 0 ? (completedCount / missions.length) * 100 : 0;
  const studyMission   = missions.find(m => m.id === "study_time");
  const studyProgress  = studyMission?.targetMinutes
    ? Math.min(100, (Math.max(0, savedMinutesToday - studyMinsAtStart) / studyMission.targetMinutes) * 100)
    : 0;

  return {
    missions, loading, completeMission,
    completedCount, allCompleted, progressPct,
    isSaturday, level, studyProgress, date,
    savedMinutesToday, studyMinsAtStart,
  };
}

// ─── Shared complete logic (keeps hook body lean) ─────────────────────────────
async function doComplete(
  uid: string,
  date: string,
  missions: Mission[],
  missionId: string,
  setMissions: (m: Mission[]) => void,
  setAllCompleted: (v: boolean) => void,
) {
  const updated = missions.map(m =>
    m.id === missionId ? { ...m, completed: true, completedAt: new Date().toISOString() } : m,
  );
  setMissions(updated);
  const count        = updated.filter(m => m.completed).length;
  const isDone       = count === updated.length;
  if (isDone) setAllCompleted(true);

  try {
    const docRef = doc(db, "daily_missions", `${uid}_${date}`);
    await updateDoc(docRef, { missions: updated, completedCount: count, allCompleted: isDone });
    if (isDone) {
      await updateDoc(doc(db, "users", uid), { lastMissionsCompletedDate: date });
    }
  } catch (e) {
    console.error("[DailyMissions] update failed:", e);
  }
}
