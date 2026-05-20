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
}

interface CachedMissionState {
  missions: Mission[];
  allCompleted: boolean;
  studyMinsAtStart: number;
  level: MissionLevel;
}

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

// ─── Fun challenges ───────────────────────────────────────────────────────────
// Mix of physical + academic. All short, clear, actionable.
const FUN_CHALLENGES = [
  { text: "Do 20 push-ups right now before you open your books",                                      emoji: "💪" },
  { text: "Walk outside for 10 minutes between sessions — it clears your head better than scrolling", emoji: "🚶" },
  { text: "Stretch your neck and shoulders for 5 minutes before your first Pomodoro today",           emoji: "🤸" },
  { text: "Put your phone in another room for your whole study session. Pick it up when done",         emoji: "📵" },
  { text: "Drink a glass of cold water right now, then open your hardest subject",                    emoji: "💧" },
  { text: "Take 10 slow deep breaths before starting — it actually sharpens your focus",              emoji: "🧘" },
  { text: "Without looking at your notes, write everything you know about one topic on paper",         emoji: "📝" },
  { text: "Do 3 Pomodoro sessions in a row today with no phone between them",                         emoji: "⏱️" },
  { text: "Write a one-page summary of everything you studied this week — from memory only",           emoji: "🧠" },
  { text: "Pick the topic you have been avoiding and study it for 30 minutes today",                  emoji: "🔍" },
  { text: "Make 10 questions about a chapter and try to answer all of them without notes",             emoji: "📋" },
  { text: "Open your hardest subject first today — not social media, not the easy stuff. Hardest first", emoji: "⚡" },
  { text: "Before sleeping tonight, write 5 things you learned today without looking at your notes",   emoji: "🌙" },
  { text: "Rewrite your messy notes for one subject in a neat and organized way",                     emoji: "🗒️" },
  { text: "Time yourself solving 5 past questions — then do 5 more and try to beat your own time",    emoji: "⏰" },
  { text: "Close your book and say one full chapter out loud to yourself — notice what you forgot",   emoji: "🗣️" },
  { text: "Write all formulas and key facts for one subject on a single sheet — from memory",         emoji: "📊" },
  { text: "Start studying 30 minutes earlier than usual today",                                       emoji: "🚀" },
  { text: "Look at your last test mistakes and write exactly what went wrong and the right answer",    emoji: "🔎" },
  { text: "Close your notes and answer 10 questions about today's topic from memory",                 emoji: "✅" },
];

// ─── Academic: Grade 9-10 SEE ─────────────────────────────────────────────────
const ACADEMIC_BEGINNER_SEE = [
  { text: "Write every formula from one Math or Science chapter — no peeking at your book",           emoji: "🔬" },
  { text: "Pick any subject and solve 10 practice questions — check every answer after",              emoji: "📝" },
  { text: "Re-read one Social Studies or English chapter and write 5 key points from memory",         emoji: "📖" },
  { text: "Write the meaning of 10 important terms in your own words — no dictionary",               emoji: "✏️" },
  { text: "Open your weakest SEE subject and read one chapter slowly, all the way through, twice",    emoji: "🔍" },
  { text: "List every chapter you have not studied yet for SEE — then study the first one on the list", emoji: "📋" },
];
const ACADEMIC_INTERMEDIATE_SEE = [
  { text: "Solve one full section of a SEE model paper — no notes, no looking at answers",            emoji: "⏱️" },
  { text: "Write full answers for 5 long questions from a SEE chapter — from memory",                 emoji: "📄" },
  { text: "Summarize one full chapter in your own words — keep it to one page",                      emoji: "🗒️" },
  { text: "Answer 20 practice MCQs and explain why each wrong answer was wrong",                      emoji: "✅" },
  { text: "Draw a topic map for one chapter from memory, then check it against your notes",           emoji: "🗺️" },
  { text: "Look at your last practice test — write down every mistake and the correct answer",        emoji: "🔎" },
];
const ACADEMIC_ADVANCED_SEE = [
  { text: "Attempt one full SEE subject paper from start to finish — treat it like the real exam",    emoji: "🏆" },
  { text: "Write complete answers for every 5-mark question in one SEE chapter — no notes",           emoji: "📚" },
  { text: "Cover your notes and say one full SEE chapter from memory — spot every gap",               emoji: "🧠" },
  { text: "Check your answers against an official SEE mark scheme — be completely honest",            emoji: "🎯" },
  { text: "Pick your 3 weakest SEE topics, make a 3-day plan, and start Day 1 today",                emoji: "💡" },
  { text: "Write full answers for all likely long questions in one SEE subject — time yourself",      emoji: "📊" },
];

// ─── Academic: Grade 11-12 Board ─────────────────────────────────────────────
const ACADEMIC_BEGINNER_BOARD = [
  { text: "Write all key formulas and laws from one Physics or Chemistry chapter",                    emoji: "⚗️" },
  { text: "Solve 10 board-level questions from any subject and check every mistake",                  emoji: "📝" },
  { text: "Read your hardest board subject chapter from start to finish — no distractions",           emoji: "🔍" },
  { text: "Write the full derivation of one important formula step by step — no looking",             emoji: "🔬" },
  { text: "List all board topics you feel unsure about — then start studying the first one",          emoji: "📋" },
  { text: "Write 8 important definitions in your own words — not copied from the textbook",           emoji: "✏️" },
];
const ACADEMIC_INTERMEDIATE_BOARD = [
  { text: "Solve one full section of a past NEB board paper — no notes, time yourself",              emoji: "⏱️" },
  { text: "Write complete long answers for 3 probable board questions — from memory",                 emoji: "📄" },
  { text: "Summarize one full board chapter in your own words — keep it to two pages",               emoji: "🗒️" },
  { text: "Answer 20 board-level MCQs and explain why each wrong answer was wrong",                  emoji: "✅" },
  { text: "List every concept in your weakest chapter that you cannot fully explain yet",             emoji: "🔎" },
  { text: "Write a full 10-mark answer for a high-weightage topic — from memory",                    emoji: "🖊️" },
];
const ACADEMIC_ADVANCED_BOARD = [
  { text: "Attempt one full NEB board past paper from start to finish — time yourself strictly",     emoji: "🏆" },
  { text: "Write model answers for all high-weightage questions in one board chapter",               emoji: "📚" },
  { text: "Cover your notes and explain one full topic out loud to yourself — find every gap",        emoji: "🗣️" },
  { text: "Check your answers against official NEB mark schemes — grade yourself honestly",           emoji: "🎯" },
  { text: "Identify your 3 riskiest board topics, make a focused plan, and start today",             emoji: "💡" },
  { text: "Finish your most feared board chapter: full read, notes, and 5 practice questions",       emoji: "📊" },
];

// ─── Academic: General ───────────────────────────────────────────────────────
const ACADEMIC_BEGINNER_GENERAL = [
  { text: "Make flashcards for 5 key terms from a chapter you find difficult",                        emoji: "🃏" },
  { text: "Re-read your class notes from today and mark everything you did not understand",           emoji: "👀" },
  { text: "Write the key points of one chapter from memory — then check against your notes",          emoji: "🧠" },
  { text: "Write all formulas or definitions from one chapter — no looking at your notes",            emoji: "✏️" },
  { text: "Pick your most confusing topic and read it twice, slowly",                                emoji: "🔍" },
  { text: "List all chapters in your syllabus and mark which ones need the most work",               emoji: "📋" },
];
const ACADEMIC_INTERMEDIATE_GENERAL = [
  { text: "Write full model answers for 3 past exam questions — no notes, no shortcuts",              emoji: "📄" },
  { text: "Summarize a full chapter in your own words — keep it to one page",                        emoji: "🗒️" },
  { text: "Solve 15 practice MCQs and explain why each wrong answer was wrong",                      emoji: "✅" },
  { text: "Draw a mind map for one topic from memory — then check against your notes",               emoji: "🗺️" },
  { text: "Look at your last 2 tests and write every mistake — explain why you made each one",        emoji: "🔎" },
  { text: "Write a complete answer from memory for a topic likely to appear in your next exam",       emoji: "🖊️" },
];
const ACADEMIC_ADVANCED_GENERAL = [
  { text: "Attempt 20 practice questions under strict timed conditions — no stopping",               emoji: "🏆" },
  { text: "Explain 3 complex topics out loud from memory — catch every gap",                         emoji: "🗣️" },
  { text: "Write complete answers for all likely long questions in one full chapter",                emoji: "📚" },
  { text: "Compare your notes with your textbook and fill every gap you find",                       emoji: "🔗" },
  { text: "Pick your 3 weakest topics, make a focused study plan, and do Day 1 today",              emoji: "💡" },
  { text: "Attempt a full past exam section with no help — check answers after",                     emoji: "📊" },
];

// ─── Mission text by grade + level ───────────────────────────────────────────
function getFocusText(level: MissionLevel, grade: number, mins: number): string {
  const isSEE   = grade === 10;
  const isBoard = grade === 12;
  if (isSEE) {
    if (level === "beginner")     return `Study your hardest SEE subject for ${mins} minutes — phone away, full focus`;
    if (level === "intermediate") return `${mins} minutes on your weakest SEE topic — notes out, no distractions`;
    return `${mins}-min deep study on the SEE topic you are least confident about`;
  }
  if (isBoard) {
    if (level === "beginner")     return `Spend ${mins} minutes on the board subject you feel least confident about`;
    if (level === "intermediate") return `${mins} minutes focused on your hardest board exam topic`;
    return `${mins}-min study on your weakest board chapter — exam conditions`;
  }
  if (level === "beginner")     return `Study the subject you find hardest for ${mins} minutes — phone away`;
  if (level === "intermediate") return `${mins} minutes on your most difficult topic — zero distractions`;
  return `${mins}-min focused study on the topic you struggle with most`;
}

function getSchoolTaskText(grade: number): string {
  if (grade === 10) return "Finish your homework and review today's class notes for SEE prep";
  if (grade === 12) return "Finish your assignments and review today's lecture notes for boards";
  if (grade === 11) return "Finish your assignments and review what you learned in class today";
  return "Finish your homework or any pending assignment";
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
        text: "It's Saturday — finish any pending assignment or review this week's lessons",
        difficulty: "easy", type: "manual", completed: false, emoji: "📚",
      },
      {
        id: "study_time",
        text: `Study for ${shortStudy} minutes today — even a little keeps your momentum going`,
        difficulty: "easy", type: "pomodoro",
        targetMinutes: shortStudy, completed: false, emoji: "⏰",
      },
    ];
  }

  const studyTarget = level === "beginner" ? 30 : level === "intermediate" ? 60 : 90;
  const focusTarget = level === "beginner" ? 25 : level === "intermediate" ? 40 : 60;

  const isSEE   = grade === 10;
  const isBoard = grade === 12;

  const academicPool = isSEE
    ? (level === "beginner" ? ACADEMIC_BEGINNER_SEE : level === "intermediate" ? ACADEMIC_INTERMEDIATE_SEE : ACADEMIC_ADVANCED_SEE)
    : isBoard
    ? (level === "beginner" ? ACADEMIC_BEGINNER_BOARD : level === "intermediate" ? ACADEMIC_INTERMEDIATE_BOARD : ACADEMIC_ADVANCED_BOARD)
    : (level === "beginner" ? ACADEMIC_BEGINNER_GENERAL : level === "intermediate" ? ACADEMIC_INTERMEDIATE_GENERAL : ACADEMIC_ADVANCED_GENERAL);

  const fun      = pick(FUN_CHALLENGES, rand);
  const academic = pick(academicPool, rand);
  const studyDiff: MissionDifficulty = level === "beginner" ? "easy" : "mid";
  const focusDiff: MissionDifficulty = level === "advanced" ? "hard" : "mid";
  const acadDiff: MissionDifficulty  = level === "advanced" ? "hard" : level === "intermediate" ? "mid" : "easy";

  return [
    {
      id: "study_time",
      text: `Study for ${studyTarget} minutes using the Pomodoro timer — tracked automatically`,
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
      difficulty: acadDiff, type: "manual", completed: false, emoji: academic.emoji,
    },
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDailyMissions() {
  const { user, profile } = useAuth();
  const { savedMinutesToday } = useTimer();

  // Recompute date every second so midnight NPT triggers a refresh
  const [date, setDate] = useState(() => getNepaliDate());
  useEffect(() => {
    const id = setInterval(() => {
      const today = getNepaliDate();
      setDate(prev => (prev !== today ? today : prev));
    }, 30_000); // check every 30s
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
          const data  = snap.data();
          const sm    = data.missions as Mission[];
          const done  = data.allCompleted ?? false;
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
        if (uid) {
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
  }, [uid, fetchTrigger]);

  // ── Auto-complete Pomodoro missions ────────────────────────────────────────
  // OVERLAP FIX: "focus" uses studyMinsAtStart fallback so it auto-completes
  // together with "study_time" when both have overlapping targets.
  useEffect(() => {
    if (!uid || missions.length === 0) return;
    for (const m of missions) {
      if (m.type !== "pomodoro" || m.completed || !m.targetMinutes) continue;
      if (completingRef.current.has(m.id)) continue;
      const minutesDone = m.id === "study_time" || m.startedAt === undefined
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
    const minutesDone = m.id === "study_time" || m.startedAt === undefined
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
