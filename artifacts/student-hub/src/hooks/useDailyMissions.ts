import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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
}

interface CachedMissionState {
  missions: Mission[];
  allCompleted: boolean;
  studyMinsAtStart: number;
  level: MissionLevel;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
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
    return raw ? (JSON.parse(raw) as CachedMissionState) : null;
  } catch { return null; }
}
function writeCache(uid: string, date: string, s: CachedMissionState) {
  try { localStorage.setItem(CACHE_KEY(uid, date), JSON.stringify(s)); } catch {}
}

// ─── Seeded random ────────────────────────────────────────────────────────────
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

// ─── Level detection ──────────────────────────────────────────────────────────
export function getUserLevel(streak: number, totalStudyMins: number): MissionLevel {
  if (streak >= 30 || totalStudyMins >= 1200) return "advanced";
  if (streak >= 7  || totalStudyMins >= 300)  return "intermediate";
  return "beginner";
}

// ─── Fun challenges — all doable at home, no school-dependent tasks ───────────
const FUN_CHALLENGES = [
  { text: "Drink 8 glasses of water today — start with one glass right now before you study",        emoji: "💧" },
  { text: "Do 15 jumping jacks or push-ups right now before you open your books",                    emoji: "💪" },
  { text: "Put your phone in another room for your entire study session today — no exceptions",       emoji: "🔕" },
  { text: "Take a 10-minute walk outside, clear your head, then come back fresh",                    emoji: "🚶" },
  { text: "Write down 3 specific things you learned today and 1 thing you want to understand better", emoji: "📝" },
  { text: "Clean and organize your study desk completely — a clean desk = a clear mind",              emoji: "🧹" },
  { text: "Commit to sleeping before 10:30 PM tonight — rest is half of studying",                   emoji: "😴" },
  { text: "Eat a proper meal or healthy snack before your next study session — fuel your brain",      emoji: "🍱" },
  { text: "Do 5 minutes of slow deep breathing before you open your books — in through nose, out through mouth", emoji: "🧘" },
  { text: "Write your top 3 study goals for tomorrow before you sleep tonight",                       emoji: "🎯" },
  { text: "No social media at all during your study time today — close every app",                    emoji: "📵" },
  { text: "Stretch your neck, shoulders and back right now — 3 minutes only",                        emoji: "🤸" },
  { text: "Write a 5-sentence summary of everything you studied today — in your own words",           emoji: "📓" },
  { text: "Step outside for 5 minutes between sessions — fresh air resets your focus",               emoji: "🌤️" },
  { text: "Set a specific time to stop studying tonight and actually stick to it",                    emoji: "⏰" },
  { text: "Read one page of anything you enjoy — fiction, news, manga — to reward yourself",         emoji: "📰" },
  { text: "Spend 15 minutes with your family this evening — real conversation, no phones",            emoji: "🏠" },
  { text: "Close your eyes for 5 minutes and do nothing — your brain needs micro-breaks too",        emoji: "🌙" },
];

// ─── Academic: Grade 9-10 / SEE preparation ──────────────────────────────────
const ACADEMIC_BEGINNER_SEE = [
  { text: "Write all formulas and definitions from one Math or Science chapter — no looking",        emoji: "🔬" },
  { text: "Solve 10 SEE model questions from any subject and check every answer carefully",          emoji: "📝" },
  { text: "Re-read your Social Studies chapter and write the 5 most important points from memory",  emoji: "📖" },
  { text: "Write 10 important terms and their definitions in your own words from any subject",       emoji: "✏️" },
  { text: "Pick your weakest SEE subject and read one chapter slowly, twice",                       emoji: "🔍" },
  { text: "List every chapter you haven't revised yet for SEE — then study the first one on the list", emoji: "📋" },
];

const ACADEMIC_INTERMEDIATE_SEE = [
  { text: "Attempt a full section of a SEE model paper under time pressure — no peeking at notes", emoji: "⏱️" },
  { text: "Write complete model answers for 5 long-answer SEE questions from memory",               emoji: "📄" },
  { text: "Summarize one full SEE chapter in your own words — maximum 1 page",                      emoji: "🗒️" },
  { text: "Solve 20 MCQs from your SEE prep book and carefully analyze every wrong answer",         emoji: "✅" },
  { text: "Build a topic map for one SEE chapter from memory, then verify it against your notes",   emoji: "🗺️" },
  { text: "Review your last mock test result — write every mistake and the correct approach",       emoji: "🔎" },
];

const ACADEMIC_ADVANCED_SEE = [
  { text: "Attempt one complete SEE subject paper start-to-finish under strict exam conditions",    emoji: "🏆" },
  { text: "Write model answers for every 5-mark question in one SEE chapter — no notes allowed",   emoji: "📚" },
  { text: "Cover your notes and recite an entire SEE chapter from memory — find every gap",         emoji: "🧠" },
  { text: "Check your SEE answers against mark schemes — grade yourself with zero mercy",           emoji: "🎯" },
  { text: "Pick your 3 weakest SEE topics, make a 3-day plan, and complete Day 1 right now",        emoji: "💡" },
  { text: "Write full answers for all probable long questions in one SEE subject — timed",          emoji: "📊" },
];

// ─── Academic: Grade 11-12 / NEB board exam preparation ──────────────────────
const ACADEMIC_BEGINNER_BOARD = [
  { text: "Write all key formulas, laws and definitions from one Physics or Chemistry chapter",     emoji: "⚗️" },
  { text: "Solve 10 board-level questions from any subject and review every mistake you made",      emoji: "📝" },
  { text: "Read your hardest board subject chapter with full focus — phone in another room",        emoji: "🔍" },
  { text: "Write the derivation of one important formula step-by-step without looking",             emoji: "🔬" },
  { text: "List all board topics you feel uncertain about — then start studying the first one",     emoji: "📋" },
  { text: "Write 8 important definitions in any subject completely in your own words",              emoji: "✏️" },
];

const ACADEMIC_INTERMEDIATE_BOARD = [
  { text: "Attempt a full section of a past NEB board paper under timed exam conditions",           emoji: "⏱️" },
  { text: "Write complete long-answer responses for 3 probable NEB board questions from memory",    emoji: "📄" },
  { text: "Summarize one full board chapter in your own words — maximum 2 pages",                   emoji: "🗒️" },
  { text: "Solve 20 board-level MCQs from your prep guide and audit every single wrong answer",     emoji: "✅" },
  { text: "Review your weakest chapter — list every concept you cannot fully explain yet",          emoji: "🔎" },
  { text: "Write a structured 10-mark NEB answer for a high-weightage topic — from memory",         emoji: "🖊️" },
];

const ACADEMIC_ADVANCED_BOARD = [
  { text: "Attempt one complete NEB board past paper from start to finish — time yourself strictly", emoji: "🏆" },
  { text: "Write model answers for all high-weightage questions in one board subject chapter",       emoji: "📚" },
  { text: "Cover your notes and explain one full board topic out loud to yourself — find the gaps",  emoji: "🗣️" },
  { text: "Check your board answers against official NEB mark schemes — be completely honest",        emoji: "🎯" },
  { text: "Identify your 3 riskiest board topics, create a focused plan, and start it today",        emoji: "💡" },
  { text: "Complete your most feared board chapter: full read, summary notes, 5 practice questions", emoji: "📊" },
];

// ─── Academic: General (Grade 9, 11, and others) ─────────────────────────────
const ACADEMIC_BEGINNER_GENERAL = [
  { text: "Make flashcards for 5 key terms from a chapter you find difficult",                       emoji: "🃏" },
  { text: "Re-read your class notes from today and highlight what you didn't fully understand",      emoji: "👀" },
  { text: "Write the key points of one chapter from memory, then check against your notes",          emoji: "🧠" },
  { text: "Write all formulas or definitions from one chapter without looking at your notes",        emoji: "✏️" },
  { text: "Pick your most confusing topic and read it twice, slowly and carefully",                  emoji: "🔍" },
  { text: "List all chapters in your syllabus and mark which ones need the most revision",           emoji: "📋" },
];

const ACADEMIC_INTERMEDIATE_GENERAL = [
  { text: "Write full model answers for 3 past exam questions — no notes, no shortcuts",             emoji: "📄" },
  { text: "Summarize an entire chapter in your own words — keep it to 1 page",                       emoji: "🗒️" },
  { text: "Solve 15 practice MCQs and carefully review every single wrong answer",                   emoji: "✅" },
  { text: "Build a mind map for one topic from memory, then check it against your notes",             emoji: "🗺️" },
  { text: "Review your last 2 tests — write down every mistake and exactly why you made it",         emoji: "🔎" },
  { text: "Write a structured answer from memory for a likely exam question — time yourself",         emoji: "🖊️" },
];

const ACADEMIC_ADVANCED_GENERAL = [
  { text: "Attempt a 20-question mock test under strict timed conditions",                            emoji: "🏆" },
  { text: "Explain 3 complex topics out loud from scratch — catch every gap in your knowledge",       emoji: "🗣️" },
  { text: "Write model answers for all likely long questions in one full chapter",                    emoji: "📚" },
  { text: "Compare your notes with another source and fill every single gap you find",               emoji: "🔗" },
  { text: "Create a focused study plan for your 3 weakest topics and complete Day 1 right now",       emoji: "💡" },
  { text: "Attempt a full section of a past exam paper with no help — check answers after",           emoji: "📊" },
];

// ─── Focus mission text by grade + level ─────────────────────────────────────
function getFocusText(level: MissionLevel, grade: number, mins: number): string {
  const isSEE   = grade === 10;
  const isBoard = grade === 12;

  if (isSEE) {
    if (level === "beginner")     return `Study your hardest SEE subject for ${mins} minutes — no phone, full focus`;
    if (level === "intermediate") return `Deep-focus on your weakest SEE topic for ${mins} min — notes out, distractions off`;
    return `Intensive ${mins}-min revision of your most uncertain SEE topic — take notes as you go`;
  }
  if (isBoard) {
    if (level === "beginner")     return `Spend ${mins} minutes on the board subject you feel least confident about`;
    if (level === "intermediate") return `${mins}-minute focused study on your most challenging board exam topic`;
    return `${mins}-min exam-condition study on your weakest board chapter — no breaks, no distractions`;
  }
  if (level === "beginner")     return `Study the subject you find hardest for ${mins} minutes — phone away, notes out`;
  if (level === "intermediate") return `Deep-focus on your most challenging topic for ${mins} min — zero distractions`;
  return `Intensive ${mins}-min session on your weakest topic — take detailed notes as you go`;
}

// ─── School task text by grade ────────────────────────────────────────────────
function getSchoolTaskText(grade: number): string {
  if (grade === 10) return "Complete your school homework and review today's class notes for SEE preparation";
  if (grade === 12) return "Complete your college assignments and review today's lecture notes for board prep";
  if (grade === 11) return "Complete your college/school assignments and review today's class notes";
  return "Complete your school homework or any pending assignment";
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
    const shortStudy = level === "beginner" ? 20 : level === "intermediate" ? 30 : 45;
    return [
      {
        id: "school_task",
        text: "It's Saturday! Finish any pending assignment or review this week's lessons",
        difficulty: "easy", type: "manual", completed: false, emoji: "📚",
      },
      {
        id: "study_time",
        text: `Study for ${shortStudy} minutes today — a little effort still goes a long way`,
        difficulty: "easy", type: "pomodoro",
        targetMinutes: shortStudy, completed: false, emoji: "⏰",
      },
    ];
  }

  // Study time and focus targets by level
  const studyTarget = level === "beginner" ? 30 : level === "intermediate" ? 60 : 90;
  const focusTarget = level === "beginner" ? 25 : level === "intermediate" ? 40 : 60;

  const studyDiff: MissionDifficulty    = level === "beginner" ? "easy" : "mid";
  const focusDiff: MissionDifficulty    = level === "advanced" ? "hard" : "mid";
  const academicDiff: MissionDifficulty = level === "advanced" ? "hard" : level === "intermediate" ? "mid" : "easy";

  // Pick grade-appropriate academic pool
  const isSEE   = grade === 10;
  const isBoard = grade === 12;

  const academicPool = isSEE
    ? (level === "beginner" ? ACADEMIC_BEGINNER_SEE : level === "intermediate" ? ACADEMIC_INTERMEDIATE_SEE : ACADEMIC_ADVANCED_SEE)
    : isBoard
    ? (level === "beginner" ? ACADEMIC_BEGINNER_BOARD : level === "intermediate" ? ACADEMIC_INTERMEDIATE_BOARD : ACADEMIC_ADVANCED_BOARD)
    : (level === "beginner" ? ACADEMIC_BEGINNER_GENERAL : level === "intermediate" ? ACADEMIC_INTERMEDIATE_GENERAL : ACADEMIC_ADVANCED_GENERAL);

  const fun      = pick(FUN_CHALLENGES, rand);
  const academic = pick(academicPool, rand);

  return [
    {
      id: "study_time",
      text: `Study for ${studyTarget} minutes with the Pomodoro timer — tracked automatically`,
      difficulty: studyDiff, type: "pomodoro",
      targetMinutes: studyTarget, completed: false, emoji: "⏰",
    },
    {
      id: "school_task",
      text: getSchoolTaskText(grade),
      difficulty: "easy", type: "manual", completed: false, emoji: "📚",
    },
    {
      id: "focus",
      text: getFocusText(level, grade, focusTarget),
      difficulty: focusDiff, type: "pomodoro",
      targetMinutes: focusTarget, completed: false, emoji: "🎯",
    },
    {
      id: "fun",
      text: fun.text,
      difficulty: "easy", type: "manual", completed: false, emoji: fun.emoji,
    },
    {
      id: "academic",
      text: academic.text,
      difficulty: academicDiff, type: "manual", completed: false, emoji: academic.emoji,
    },
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDailyMissions() {
  const { user, profile } = useAuth();
  const { savedMinutesToday } = useTimer();

  const date       = getNepaliDate();
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

  // ── Anti-cheat state ──────────────────────────────────────────────────────
  const [blockedUntil, setBlockedUntil] = useState(0);
  const completionLogRef = useRef<number[]>([]);

  const completingRef = useRef<Set<string>>(new Set());
  const syncedRef     = useRef(false);

  // ── Firestore background sync ─────────────────────────────────────────────
  useEffect(() => {
    if (!uid || syncedRef.current) return;
    syncedRef.current = true;
    let mounted = true;
    (async () => {
      try {
        const docId  = `${uid}_${date}`;
        const docRef = doc(db, "daily_missions", docId);
        const snap   = await getDoc(docRef);
        if (!mounted) return;

        if (snap.exists()) {
          const data = snap.data();
          const sm   = data.missions as Mission[];
          const done = data.allCompleted ?? false;
          const start = data.studyMinutesAtStart ?? 0;
          setMissions(sm);
          setAllCompleted(done);
          setStudyMinsAtStart(start);
          writeCache(uid, date, { missions: sm, allCompleted: done, studyMinsAtStart: start, level: data.level ?? level });
        } else {
          const grade       = profile?.grade ?? 10;
          const newMissions = buildMissions(uid, date, level, grade, isSaturday);
          const cacheData: CachedMissionState = {
            missions: newMissions, allCompleted: false,
            studyMinsAtStart: savedMinutesToday, level,
          };
          setMissions(newMissions);
          setStudyMinsAtStart(savedMinutesToday);
          writeCache(uid, date, cacheData);
          setDoc(docRef, {
            uid, date, level, grade: profile?.grade ?? 10, isSaturday,
            missions: newMissions, completedCount: 0, allCompleted: false,
            studyMinutesAtStart: savedMinutesToday,
          }).catch(e => console.error("[DailyMissions] Firestore write:", e));
        }
      } catch (e) {
        console.error("[DailyMissions] Firestore sync:", e);
        if (!cached && uid) {
          const newMissions = buildMissions(uid, date, level, profile?.grade ?? 10, isSaturday);
          setMissions(newMissions);
          writeCache(uid, date, { missions: newMissions, allCompleted: false, studyMinsAtStart: savedMinutesToday, level });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // ── Auto-track Pomodoro missions ──────────────────────────────────────────
  // OVERLAP FIX: "focus" mission uses studyMinsAtStart as fallback baseline
  // so it auto-completes with "study_time" when both have overlapping time goals.
  useEffect(() => {
    if (!uid || missions.length === 0) return;

    for (const m of missions) {
      if (m.type !== "pomodoro" || m.completed || !m.targetMinutes) continue;
      if (completingRef.current.has(m.id)) continue;

      let minutesDone = 0;
      if (m.id === "study_time") {
        // Tracks total daily study from when missions were generated
        minutesDone = Math.max(0, savedMinutesToday - studyMinsAtStart);
      } else if (m.startedAt !== undefined) {
        // Explicitly started — track from that point
        minutesDone = Math.max(0, savedMinutesToday - m.startedAt);
      } else {
        // Not explicitly started — use the same baseline as study_time
        // This ensures overlapping pomodoro missions (e.g., both 30 min) complete together
        minutesDone = Math.max(0, savedMinutesToday - studyMinsAtStart);
      }

      if (minutesDone >= m.targetMinutes) {
        completingRef.current.add(m.id);
        _doComplete(uid, date, missions, m.id, setMissions, setAllCompleted);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMinutesToday, missions, studyMinsAtStart]);

  // ── Start a Pomodoro mission ───────────────────────────────────────────────
  const startMission = useCallback((
    missionId: string,
    missionText: string,
    targetMinutes: number,
  ) => {
    if (!uid) return;
    const preset: PomodoroMissionPreset = { missionId, missionText, targetMinutes, date };
    try { localStorage.setItem(POMODORO_MISSION_KEY, JSON.stringify(preset)); } catch {}

    setMissions(prev => {
      const updated = prev.map(m =>
        m.id === missionId ? { ...m, startedAt: savedMinutesToday } : m,
      );
      const cached2 = readCache(uid, date);
      if (cached2) writeCache(uid, date, { ...cached2, missions: updated });
      updateDoc(doc(db, "daily_missions", `${uid}_${date}`), { missions: updated }).catch(() => {});
      return updated;
    });
  }, [uid, date, savedMinutesToday]);

  // ── Manual complete (with anti-cheat) ─────────────────────────────────────
  const completeMission = useCallback((missionId: string) => {
    if (!uid || completingRef.current.has(missionId)) return;

    const now = Date.now();

    // Check if currently blocked
    if (now < blockedUntil) return;

    // Record this completion time
    const log = [...completionLogRef.current, now].filter(t => now - t < 10_000);
    completionLogRef.current = log;

    // Anti-cheat: if 2 completions within 4 seconds, block for 45 seconds
    if (log.length >= 2) {
      const oldest = log[0];
      if (now - oldest < 4_000) {
        setBlockedUntil(now + 45_000);
        completionLogRef.current = [];
        return;
      }
    }

    completingRef.current.add(missionId);
    _doComplete(uid, date, missions, missionId, setMissions, setAllCompleted);
  }, [uid, date, missions, blockedUntil]);

  const completedCount = missions.filter(m => m.completed).length;
  const progressPct    = missions.length > 0 ? (completedCount / missions.length) * 100 : 0;

  // Per-mission Pomodoro progress
  // OVERLAP FIX: fallback to studyMinsAtStart when startedAt is not set
  function missionProgress(m: Mission): number {
    if (!m.targetMinutes || m.completed) return m.completed ? 100 : 0;
    let minutesDone = 0;
    if (m.id === "study_time") {
      minutesDone = Math.max(0, savedMinutesToday - studyMinsAtStart);
    } else if (m.startedAt !== undefined) {
      minutesDone = Math.max(0, savedMinutesToday - m.startedAt);
    } else {
      minutesDone = Math.max(0, savedMinutesToday - studyMinsAtStart);
    }
    return Math.min(100, (minutesDone / m.targetMinutes) * 100);
  }

  return {
    missions, loading, completeMission, startMission, missionProgress,
    completedCount, allCompleted, progressPct,
    isSaturday, level, date,
    savedMinutesToday, studyMinsAtStart,
    blockedUntil,
  };
}

// ─── Complete helper ──────────────────────────────────────────────────────────
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

    const cached = readCache(uid, date);
    if (cached) writeCache(uid, date, { ...cached, missions: updated, allCompleted: isDone });

    updateDoc(doc(db, "daily_missions", `${uid}_${date}`), {
      missions: updated, completedCount: count, allCompleted: isDone,
    }).catch(() => {});

    if (isDone) {
      updateDoc(doc(db, "users", uid), { lastMissionsCompletedDate: date }).catch(() => {});
    }
    return updated;
  });
}
