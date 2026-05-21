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
const MISSION_VERSION = 3;
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
// Tracked by SESSIONS (work blocks), not by total minutes.
// 1 session  = one 25-min focus block.
// 1 cycle    = 2 sessions  (25 min work → 5 min break → 25 min work).
// The timer auto-switches between phases when this mission is started.
// targetSessions: 2 (beginner/1 cycle) | 4 (intermediate/2 cycles) | 6 (advanced/3 cycles)
function getPomodoroMission(level: MissionLevel, grade: number): Mission {
  const isBoardYear = grade === 10 || grade === 12;
  const examName    = grade === 10 ? "SEE" : "NEB";

  // Each cycle = 2 work sessions. Auto-switch handles breaks.
  const targetSessions = level === "beginner" ? 2 : level === "intermediate" ? 4 : 6;
  const cycles         = targetSessions / 2; // 1, 2, or 3
  const cycleWord      = cycles === 1 ? "1 full cycle" : `${cycles} full cycles`;

  let text: string;
  if (level === "beginner") {
    text = isBoardYear
      ? `Complete 1 full Pomodoro cycle for your ${examName} prep — 25 min study, 5 min break, then 25 min study. Enable auto-switch in the timer and it handles the phases for you.`
      : `Complete 1 full Pomodoro cycle — 25 min focus, 5 min break, then 25 min focus. Start the timer and let it switch phases automatically. Just stay at your desk.`;
  } else if (level === "intermediate") {
    text = isBoardYear
      ? `Complete 2 full Pomodoro cycles for ${examName} preparation — 25 min study → 5 min break → 25 min study, done twice. The timer auto-switches between focus and break for you.`
      : `Complete 2 full Pomodoro cycles today — 25 min focus → 5 min break → 25 min focus, twice in a row. The timer switches phases automatically.`;
  } else {
    text = isBoardYear
      ? `Complete 3 full Pomodoro cycles for serious ${examName} preparation. 25 min study → 5 min break → 25 min study, three times. The timer auto-switches — your only job is to keep studying.`
      : `Complete 3 full Pomodoro cycles today. Each cycle: 25 min focus → 5 min break → 25 min focus. The timer switches automatically. ${cycleWord}, full concentration.`;
  }

  return {
    id: "pomodoro_cycle",
    text,
    difficulty: level === "beginner" ? "easy" : level === "intermediate" ? "mid" : "hard",
    type: "pomodoro",
    targetSessions,
    targetMinutes: targetSessions * 25, // kept for display reference only
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

// ─── Mission 3: Subject Study Time ────────────────────────────────────────────
// Tracked by minutes. Grade 9 and 11 do NOT mention board exams.
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
    if (level === "beginner")     text = `Pick the +2 subject you find most difficult and study it for ${mins} minutes — understand it, do not just memorize.`;
    else if (level === "intermediate") text = `Study your most challenging +2 subject for ${mins} minutes. Focus on understanding concepts, not just reading.`;
    else                          text = `${mins} minutes of deep study on the hardest +2 subject for you. Write your own notes as you go.`;
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
): Mission[] {
  const rand = seededRand(uid + date);

  if (isSaturday) {
    // Saturday = lighter set. 1 cycle for all levels (just 2 sessions).
    return [
      {
        id: "school_task",
        text: "It is Saturday — finish any pending homework or assignment from this week. Open Notes if you need help with any topic.",
        difficulty: "easy", type: "manual", completed: false, emoji: "📚",
        actionLink: "/notes", actionLabel: "Open Notes",
      },
      {
        id: "pomodoro_cycle",
        text: `Complete 1 Pomodoro cycle today — 25 min study, 5 min break, then 25 min study. Even on Saturday, a little focus keeps your momentum going. The timer switches automatically.`,
        difficulty: "easy", type: "pomodoro",
        targetSessions: 2, targetMinutes: 50, completed: false, emoji: "⏱️",
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
          // If missions were generated with an older version, regenerate
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
  // A mission only tracks progress AFTER the student explicitly presses
  // "Start Pomodoro Timer" from its card. Until then startedAt / sessionsAtStart
  // are undefined and we intentionally ignore any timer activity — this prevents
  // one mission's timer use from accidentally completing a different mission.
  useEffect(() => {
    if (!uid || missions.length === 0) return;
    for (const m of missions) {
      if (m.type !== "pomodoro" || m.completed) continue;
      if (completingRef.current.has(m.id)) continue;

      if (m.id === "pomodoro_cycle" && m.targetSessions) {
        // Mission not started yet — student hasn't clicked "Start Pomodoro Timer"
        // for this specific mission card. Do not track anything.
        if (m.sessionsAtStart === undefined) continue;
        // Session-based: count naturally completed work sessions since this mission
        // was started. naturalSessionsCompleted never increments on Skip.
        const sessionsDone = Math.max(0, naturalSessionsCompleted - m.sessionsAtStart);
        if (sessionsDone >= m.targetSessions) {
          completingRef.current.add(m.id);
          _doComplete(uid, date, missions, m.id, setMissions, setAllCompleted);
        }
      } else if (m.targetMinutes) {
        // Mission not started yet — do not track any minutes until the student
        // explicitly starts this mission from its card.
        if (m.startedAt === undefined) continue;
        const minutesDone = Math.max(0, savedMinutesToday - m.startedAt);
        if (minutesDone >= m.targetMinutes) {
          completingRef.current.add(m.id);
          _doComplete(uid, date, missions, m.id, setMissions, setAllCompleted);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMinutesToday, naturalSessionsCompleted, missions, studyMinsAtStart]);

  // ── Start a Pomodoro mission ───────────────────────────────────────────────
  // Records the current savedMinutesToday and sessionsCompleted on the mission
  // so auto-complete can measure progress from the moment it was started.
  const startMission = useCallback((missionId: string, missionText: string, targetMinutes: number, sessionsAtStartOverride?: number) => {
    if (!uid) return;
    const preset: PomodoroMissionPreset = { missionId, missionText, targetMinutes, date };
    try { localStorage.setItem(POMODORO_MISSION_KEY, JSON.stringify(preset)); } catch {}
    setMissions(prev => {
      const updated = prev.map(m => m.id === missionId ? {
        ...m,
        startedAt: savedMinutesToday,
        sessionsAtStart: sessionsAtStartOverride !== undefined ? sessionsAtStartOverride : naturalSessionsCompleted,
      } : m);
      const c = readCache(uid, date);
      if (c) writeCache(uid, date, { ...c, missions: updated });
      updateDoc(doc(db, "daily_missions", `${uid}_${date}`), { missions: updated }).catch(() => {});
      return updated;
    });
  }, [uid, date, savedMinutesToday, naturalSessionsCompleted]);

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

  // Returns 0–100 progress for a given mission.
  // Returns 0 until the student explicitly starts the mission from its card.
  // pomodoro_cycle uses sessions; other pomodoro missions use minutes.
  function missionProgress(m: Mission): number {
    if (m.completed) return 100;

    if (m.id === "pomodoro_cycle" && m.targetSessions) {
      if (m.sessionsAtStart === undefined) return 0;
      const sessionsDone = Math.max(0, naturalSessionsCompleted - m.sessionsAtStart);
      return Math.min(100, (sessionsDone / m.targetSessions) * 100);
    }

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
  // Clear the mission banner from Pomodoro page when the cycle mission completes
  if (missionId === "pomodoro_cycle") {
    try { localStorage.removeItem(POMODORO_MISSION_KEY); } catch {}
  }
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
