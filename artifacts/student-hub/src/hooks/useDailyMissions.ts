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
  startedAt?: number; // savedMinutesToday recorded when user clicked "Go to Pomodoro"
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

// ─── Mission pools ────────────────────────────────────────────────────────────
const FUN_CHALLENGES = [
  { text: "Drink at least 8 glasses of water today",                       emoji: "💧" },
  { text: "Do 10 jumping jacks or push-ups right now",                     emoji: "💪" },
  { text: "Spend 20 minutes with your family this evening",                emoji: "🏠" },
  { text: "Take a 10-minute walk outside and clear your head",             emoji: "🚶" },
  { text: "Write down 3 things you learned or are grateful for today",     emoji: "📝" },
  { text: "No social media for 2 hours during study time",                 emoji: "📵" },
  { text: "Clean and organize your study desk right now",                  emoji: "🧹" },
  { text: "Sleep before 10:30 PM tonight",                                 emoji: "😴" },
  { text: "Eat a proper meal before your next study session",              emoji: "🍱" },
  { text: "Do 5 minutes of deep breathing before you start studying",      emoji: "🧘" },
  { text: "No phone during your study session today",                      emoji: "🔕" },
  { text: "Write down your 3 study goals for tomorrow before sleeping",    emoji: "🎯" },
  { text: "Help a classmate understand something you learned today",       emoji: "🤝" },
  { text: "Read something outside your syllabus for 15 minutes",          emoji: "📰" },
  { text: "Take a proper break — step outside for 5 minutes between sessions", emoji: "🌤️" },
];

const ACADEMIC_BEGINNER = [
  { text: "Make flashcards for 5 key terms you struggle to remember",                        emoji: "🃏" },
  { text: "Re-read your class notes from today and circle what you didn't understand",       emoji: "👀" },
  { text: "Write the key points of one chapter from memory, then verify with your notes",    emoji: "🧠" },
  { text: "Watch an educational video (10–15 min) related to your syllabus",                 emoji: "🎥" },
  { text: "Write down all formulas or definitions from one chapter without looking",         emoji: "✏️" },
  { text: "Pick your most confusing topic and read it twice, slowly and carefully",          emoji: "🔍" },
];

const ACADEMIC_INTERMEDIATE = [
  { text: "Write full model answers for 3 past exam questions",                              emoji: "📄" },
  { text: "Summarize an entire chapter in your own words — keep it to 1 page",              emoji: "🗒️" },
  { text: "Solve 15 practice MCQs and carefully review every wrong answer",                 emoji: "✅" },
  { text: "Build a mind map for one topic from memory, then check against your notes",       emoji: "🗺️" },
  { text: "Review your last 2 tests — write down every mistake and why you made it",        emoji: "🔎" },
  { text: "Practice writing a 200-word answer from memory without looking at your notes",   emoji: "🖊️" },
];

const ACADEMIC_ADVANCED = [
  { text: "Attempt a 20-question mock test under strict timed conditions",                   emoji: "🏆" },
  { text: "Feynman technique: explain 3 complex topics out loud as if teaching someone",     emoji: "🗣️" },
  { text: "Write model answers for all likely long questions in one chapter or unit",        emoji: "📚" },
  { text: "Compare your notes with another source and fill every gap you find",             emoji: "🔗" },
  { text: "Create a focused study plan for your 3 weakest topics and start the first one", emoji: "💡" },
  { text: "Attempt a full section of a past board exam paper without any help",             emoji: "📊" },
];

const FOCUS_TEXT: Record<MissionLevel, string> = {
  beginner:     "Pick any subject you find hard and study it with full concentration — no distractions",
  intermediate: "Deep-focus on your most challenging topic — phone away, notes out",
  advanced:     "Intensive study session on your weakest topic — take notes as you go",
};

// ─── Mission builder ──────────────────────────────────────────────────────────
export function buildMissions(
  uid: string,
  date: string,
  level: MissionLevel,
  grade: number,
  isSaturday: boolean,
): Mission[] {
  const rand = seededRand(uid + date);
  void grade; // grade kept in signature for future personalization (stream detection)

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
        text: `Study for ${shortStudy} minutes today — a little still goes a long way`,
        difficulty: "easy", type: "pomodoro",
        targetMinutes: shortStudy, completed: false, emoji: "⏰",
      },
    ];
  }

  // Study time targets by level
  const studyTarget  = level === "beginner" ? 30 : level === "intermediate" ? 60 : 90;
  const focusTarget  = level === "beginner" ? 30 : level === "intermediate" ? 45 : 75;

  const studyDiff: MissionDifficulty    = level === "beginner" ? "easy" : "mid";
  const focusDiff: MissionDifficulty    = level === "advanced" ? "hard" : "mid";
  const academicDiff: MissionDifficulty = level === "advanced" ? "hard" : level === "intermediate" ? "mid" : "easy";

  const academicPool =
    level === "beginner" ? ACADEMIC_BEGINNER :
    level === "intermediate" ? ACADEMIC_INTERMEDIATE : ACADEMIC_ADVANCED;

  const fun      = pick(FUN_CHALLENGES, rand);
  const academic = pick(academicPool, rand);

  return [
    {
      id: "study_time",
      text: `Study for ${studyTarget} minutes using the Pomodoro timer — auto-tracked`,
      difficulty: studyDiff, type: "pomodoro",
      targetMinutes: studyTarget, completed: false, emoji: "⏰",
    },
    {
      id: "school_task",
      text: "Complete your school homework or any pending assignment",
      difficulty: "easy", type: "manual", completed: false, emoji: "📚",
    },
    {
      id: "focus",
      text: FOCUS_TEXT[level],
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

  // profile?.uid is available instantly from localStorage cache
  const uid = (user?.uid ?? (profile as Record<string, unknown> | null)?.["uid"] as string | undefined) ?? null;

  const level = useMemo(() => {
    const d = profile as Record<string, unknown> | null;
    return getUserLevel(
      (d?.["streak"]         as number | undefined) ?? 0,
      (d?.["totalStudyTime"] as number | undefined) ?? 0,
    );
  }, [profile]);

  // Init from localStorage cache for instant load
  const cached = uid ? readCache(uid, date) : null;

  const [missions,         setMissions]         = useState<Mission[]>(cached?.missions ?? []);
  const [loading,          setLoading]          = useState<boolean>(!cached);
  const [allCompleted,     setAllCompleted]     = useState(cached?.allCompleted ?? false);
  const [studyMinsAtStart, setStudyMinsAtStart] = useState(cached?.studyMinsAtStart ?? 0);

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
  useEffect(() => {
    if (!uid || missions.length === 0) return;

    for (const m of missions) {
      if (m.type !== "pomodoro" || m.completed || !m.targetMinutes) continue;
      if (completingRef.current.has(m.id)) continue;

      let minutesDone = 0;
      if (m.id === "study_time") {
        minutesDone = Math.max(0, savedMinutesToday - studyMinsAtStart);
      } else if (m.startedAt !== undefined) {
        minutesDone = Math.max(0, savedMinutesToday - m.startedAt);
      }

      if (minutesDone >= m.targetMinutes) {
        completingRef.current.add(m.id);
        _doComplete(uid, date, missions, m.id, setMissions, setAllCompleted);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMinutesToday, missions, studyMinsAtStart]);

  // ── Start a Pomodoro mission (records start time + sets timer preset) ─────
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

  // ── Manual complete ───────────────────────────────────────────────────────
  const completeMission = useCallback((missionId: string) => {
    if (!uid || completingRef.current.has(missionId)) return;
    completingRef.current.add(missionId);
    _doComplete(uid, date, missions, missionId, setMissions, setAllCompleted);
  }, [uid, date, missions]);

  const completedCount = missions.filter(m => m.completed).length;
  const progressPct    = missions.length > 0 ? (completedCount / missions.length) * 100 : 0;

  // Per-mission Pomodoro progress
  function missionProgress(m: Mission): number {
    if (!m.targetMinutes || m.completed) return m.completed ? 100 : 0;
    if (m.id === "study_time") {
      return Math.min(100, (Math.max(0, savedMinutesToday - studyMinsAtStart) / m.targetMinutes) * 100);
    }
    if (m.startedAt !== undefined) {
      return Math.min(100, (Math.max(0, savedMinutesToday - m.startedAt) / m.targetMinutes) * 100);
    }
    return 0;
  }

  return {
    missions, loading, completeMission, startMission, missionProgress,
    completedCount, allCompleted, progressPct,
    isSaturday, level, date,
    savedMinutesToday, studyMinsAtStart,
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
