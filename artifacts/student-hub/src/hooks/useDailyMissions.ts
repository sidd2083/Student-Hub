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
  targetMinutes?: number;
  completed: boolean;
  completedAt?: string;
  emoji: string;
  startedAt?: number;
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

const MISSION_VERSION = 2;
const CACHE_KEY  = (uid: string, date: string) => `sh_dm_${uid}_${date}`;
export const POMODORO_MISSION_KEY = "sh_mission_timer";

export interface PomodoroMissionPreset {
  missionId: string;
  missionText: string;
  targetMinutes: number;
  date: string;
}

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

export function getUserLevel(streak: number, totalStudyMins: number): MissionLevel {
  if (streak >= 30 || totalStudyMins >= 1200) return "advanced";
  if (streak >= 7  || totalStudyMins >= 300)  return "intermediate";
  return "beginner";
}

// ─── Mission 1: Pomodoro Cycle ────────────────────────────────────────────────
// One cycle = 25 min focus + 5 min break + 25 min focus + 10 min long break
// targetMinutes tracks actual study/focus minutes (not break time)
function getPomodoroMission(level: MissionLevel, grade: number): Mission {
  const isBoard = grade === 10 || grade === 12;
  const targetMinutes =
    level === "beginner"     ? 50  :   // 1 full cycle (25+25)
    level === "intermediate" ? 100 :   // 2 full cycles
                               150;    // 3 full cycles (advanced)

  const cycles = level === "beginner" ? 1 : level === "intermediate" ? 2 : 3;
  const cycleWord = cycles === 1 ? "one full cycle" : `${cycles} full cycles`;

  let text: string;
  if (level === "beginner") {
    text = isBoard
      ? `Complete one full Pomodoro cycle — 25 min study, 5 min break, 25 min study, then 10 min rest. This is your most important mission today.`
      : `Complete one full Pomodoro cycle — 25 min focus, 5 min break, 25 min focus, then 10 min rest. Start the timer and do it now.`;
  } else if (level === "intermediate") {
    text = isBoard
      ? `Complete two full Pomodoro cycles for your board prep — 25 min study, 5 min break, 25 min study, 10 min rest. Repeat twice.`
      : `Complete two full Pomodoro cycles today — 25 min focus, 5 min break, 25 min focus, 10 min rest. Then repeat the whole thing.`;
  } else {
    text = isBoard
      ? `Complete three full Pomodoro cycles — 25 min study, 5 min break, 25 min study, 10 min rest. Do this three times for serious board prep.`
      : `Complete three full Pomodoro cycles today. Each cycle: 25 min focus → 5 min break → 25 min focus → 10 min rest. Do all ${cycleWord}.`;
  }

  return {
    id: "pomodoro_cycle",
    text,
    difficulty: level === "beginner" ? "easy" : level === "intermediate" ? "mid" : "hard",
    type: "pomodoro",
    targetMinutes,
    completed: false,
    emoji: "⏱️",
  };
}

// ─── Mission 2: School Assignment + Notes ─────────────────────────────────────
function getSchoolTaskMission(grade: number): Mission {
  let text: string;
  if (grade === 9) {
    text = "Finish all your homework for tomorrow. If you are stuck on any topic, open Notes to find help — it is all there for you.";
  } else if (grade === 10) {
    text = "Finish your homework and any pending SEE preparation tasks today. Open the Notes section if you need to revise any chapter quickly.";
  } else if (grade === 11) {
    text = "Complete all your school assignments for today. Open Notes below to review any topic or chapter you are unclear about.";
  } else {
    text = "Finish your board revision assignments for today. Use the Notes section to quickly revise any chapter before you write your answers.";
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

// ─── Mission 3: Subject Study Time ───────────────────────────────────────────
function getSubjectStudyMission(level: MissionLevel, grade: number): Mission {
  const minsMap: Record<number, Record<MissionLevel, number>> = {
    9:  { beginner: 25, intermediate: 40, advanced: 60  },
    10: { beginner: 30, intermediate: 50, advanced: 75  },
    11: { beginner: 30, intermediate: 50, advanced: 75  },
    12: { beginner: 40, intermediate: 60, advanced: 90  },
  };
  const gradeKey = [9, 10, 11, 12].includes(grade) ? grade : 10;
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
    if (level === "beginner")     text = `Pick the subject you find most difficult and study it for ${mins} minutes — understand it, do not just memorize.`;
    else if (level === "intermediate") text = `Study your most challenging subject for ${mins} minutes. Focus on understanding concepts, not just reading.`;
    else                          text = `${mins} minutes of deep study on the subject you struggle with most. Write notes as you go.`;
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
// Real, home-related, logical, not weird. Nothing study-related.
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

// ─── Mission 5: Grade-specific mission ───────────────────────────────────────
function getGradeMission(level: MissionLevel, grade: number, rand: () => number): Mission {
  const isBoardYear = grade === 10 || grade === 12;

  if (isBoardYear) {
    const examName = grade === 10 ? "SEE" : "NEB";
    const questionCount = level === "beginner" ? 5 : level === "intermediate" ? 10 : 15;
    let text: string;
    let diff: MissionDifficulty;

    if (level === "beginner") {
      text = `Open the Important Questions section and solve ${questionCount} questions from your weakest ${examName} subject. Check every answer after you finish.`;
      diff = "easy";
    } else if (level === "intermediate") {
      text = `Solve ${questionCount} important ${examName} questions from the PYQ section without looking at the answers first. Grade yourself honestly after.`;
      diff = "mid";
    } else {
      text = `Attempt one full set of important ${examName} questions under exam conditions — no notes, time yourself. Review your mistakes after.`;
      diff = "hard";
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

  // Grades 9 and 11 — class-based revision missions
  const grade11 = grade === 11;
  const gradeLabel = grade11 ? "Grade 11" : "Grade 9";

  const options: Array<{ text: string; emoji: string }> = grade11
    ? [
        { text: "Write down everything you remember from today's school lessons — from memory, without looking at your notebook. Then check what you missed.", emoji: "✏️" },
        { text: "Revise your class notes from the last 3 days across all subjects. Write the key points for each subject from memory.", emoji: "📝" },
        { text: "Read ahead in your hardest subject for tomorrow's class. Come to school prepared with at least one question to ask your teacher.", emoji: "📖" },
        { text: "Go through your notes from this week and mark every topic you do not fully understand. Start studying the first one on your list.", emoji: "🔍" },
        { text: "Pick any one subject from today's class and write a one-page summary of what you learned — in your own words, not copied.", emoji: "🗒️" },
      ]
    : [
        { text: "Write down everything you remember from today's school lessons — from memory, without opening your notebook. Then check what you missed.", emoji: "✏️" },
        { text: "Revise your class notes from the last 3 days. Write the key points for each subject from memory without peeking.", emoji: "📝" },
        { text: "Read the next chapter in your hardest subject before your teacher covers it. Come to class tomorrow prepared.", emoji: "📖" },
        { text: "Go through this week's notes and mark every topic you do not understand. Start studying the first one on your list right now.", emoji: "🔍" },
        { text: "Pick one subject from today's class and write a summary of what you learned — in your own words, not copied from the book.", emoji: "🗒️" },
      ];

  const chosen = pick(options, rand);
  const diff: MissionDifficulty = level === "advanced" ? "hard" : level === "intermediate" ? "mid" : "easy";

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
): Mission[] {
  const rand = seededRand(uid + date);

  if (isSaturday) {
    const shortMins = level === "beginner" ? 25 : level === "intermediate" ? 50 : 75;
    return [
      {
        id: "school_task",
        text: "It is Saturday — finish any pending homework or assignment from this week. Open Notes if you need help with any topic.",
        difficulty: "easy", type: "manual", completed: false, emoji: "📚",
        actionLink: "/notes", actionLabel: "Open Notes",
      },
      {
        id: "pomodoro_cycle",
        text: `Complete ${level === "beginner" ? "one" : "two"} Pomodoro cycle${level === "beginner" ? "" : "s"} today — 25 min study, 5 min break, 25 min study. Even on Saturday, a little focus keeps your momentum going.`,
        difficulty: "easy", type: "pomodoro",
        targetMinutes: shortMins, completed: false, emoji: "⏱️",
      },
    ];
  }

  const wellnessItem = pick(WELLNESS_MISSIONS, rand);

  return [
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
  const { savedMinutesToday } = useTimer();

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
    const d = profile as Record<string, unknown> | null;
    return getUserLevel(
      (d?.["streak"]         as number | undefined) ?? 0,
      (d?.["totalStudyTime"] as number | undefined) ?? 0,
    );
  }, [profile]);

  const cached = uid ? readCache(uid, date) : null;

  const [missions,         setMissions]         = useState<Mission[]>(cached?.missions ?? []);
  const [loading,          setLoading]          = useState<boolean>(!cached);
  const [allCompleted,     setAllCompleted]     = useState(cached?.allCompleted ?? false);
  const [studyMinsAtStart, setStudyMinsAtStart] = useState(cached?.studyMinsAtStart ?? 0);
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
    setLoading(true);
    (async () => {
      try {
        const docId  = `${uid}_${date}`;
        const docRef = doc(db, "daily_missions", docId);
        const snap   = await getDoc(docRef);
        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.data();
          // If missions were generated with an older version, regenerate them
          if ((data.version ?? 1) < MISSION_VERSION) {
            await deleteDoc(docRef).catch(() => {});
            const grade       = profile?.grade ?? 10;
            const newMissions = buildMissions(uid, date, level, grade, isSaturday);
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
            const done  = data.allCompleted ?? false;
            const start = data.studyMinutesAtStart ?? 0;
            setMissions(sm);
            setAllCompleted(done);
            setStudyMinsAtStart(start);
            writeCache(uid, date, { missions: sm, allCompleted: done, studyMinsAtStart: start, level: data.level ?? level, version: MISSION_VERSION });
          }
        } else {
          const grade       = profile?.grade ?? 10;
          const newMissions = buildMissions(uid, date, level, grade, isSaturday);
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
        if (uid) {
          const newMissions = buildMissions(uid, date, level, profile?.grade ?? 10, isSaturday);
          setMissions(newMissions);
          writeCache(uid, date, { missions: newMissions, allCompleted: false, studyMinsAtStart: savedMinutesToday, level, version: MISSION_VERSION });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, fetchTrigger]);

  // ── Auto-complete Pomodoro missions ────────────────────────────────────────
  useEffect(() => {
    if (!uid || missions.length === 0) return;
    for (const m of missions) {
      if (m.type !== "pomodoro" || m.completed || !m.targetMinutes) continue;
      if (completingRef.current.has(m.id)) continue;
      const minutesDone = m.id === "pomodoro_cycle" || m.id === "study_time" || m.startedAt === undefined
        ? Math.max(0, savedMinutesToday - studyMinsAtStart)
        : Math.max(0, savedMinutesToday - m.startedAt);
      if (minutesDone >= m.targetMinutes) {
        completingRef.current.add(m.id);
        _doComplete(uid, date, missions, m.id, setMissions, setAllCompleted);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMinutesToday, missions, studyMinsAtStart]);

  // ── Start a Pomodoro mission ───────────────────────────────────────────────
  const startMission = useCallback((missionId: string, missionText: string, targetMinutes: number) => {
    if (!uid) return;
    const preset: PomodoroMissionPreset = { missionId, missionText, targetMinutes, date };
    try { localStorage.setItem(POMODORO_MISSION_KEY, JSON.stringify(preset)); } catch {}
    setMissions(prev => {
      const updated = prev.map(m => m.id === missionId ? { ...m, startedAt: savedMinutesToday } : m);
      const c = readCache(uid, date);
      if (c) writeCache(uid, date, { ...c, missions: updated });
      updateDoc(doc(db, "daily_missions", `${uid}_${date}`), { missions: updated }).catch(() => {});
      return updated;
    });
  }, [uid, date, savedMinutesToday]);

  // ── Manual complete (with anti-cheat) ─────────────────────────────────────
  const completeMission = useCallback((missionId: string) => {
    if (!uid || completingRef.current.has(missionId)) return;
    const now = Date.now();
    if (now < blockedUntil) return;
    const log = [...completionLogRef.current, now].filter(t => now - t < 10_000);
    completionLogRef.current = log;
    if (log.length >= 2 && now - log[0] < 4_000) {
      setBlockedUntil(now + 45_000);
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

  function missionProgress(m: Mission): number {
    if (!m.targetMinutes || m.completed) return m.completed ? 100 : 0;
    const minutesDone = m.id === "pomodoro_cycle" || m.id === "study_time" || m.startedAt === undefined
      ? Math.max(0, savedMinutesToday - studyMinsAtStart)
      : Math.max(0, savedMinutesToday - m.startedAt);
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
    const c = readCache(uid, date);
    if (c) writeCache(uid, date, { ...c, missions: updated, allCompleted: isDone });
    updateDoc(doc(db, "daily_missions", `${uid}_${date}`), {
      missions: updated, completedCount: count, allCompleted: isDone,
    }).catch(() => {});
    if (isDone) {
      updateDoc(doc(db, "users", uid), { lastMissionsCompletedDate: date }).catch(() => {});
    }
    return updated;
  });
}
