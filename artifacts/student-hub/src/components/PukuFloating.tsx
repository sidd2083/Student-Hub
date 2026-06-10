import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PukuFace, type PukuEmotion } from "@/components/study-room/PukuPartner";

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// Anti-repeat: keeps last 10 shown tips, never re-picks them from a pool if avoidable
function makePickFresh() {
  const recent: string[] = [];
  return function pickFresh(pool: string[]): string {
    const fresh = pool.filter(m => !recent.includes(m));
    const chosen = fresh.length > 0 ? pick(fresh) : pick(pool);
    if (recent.length >= 10) recent.shift();
    recent.push(chosen);
    return chosen;
  };
}

function gradeCtx(grade?: number) {
  if (grade === 10) return "grade10";
  if (grade === 12) return "grade12";
  if (grade === 13) return "cee";
  if (grade === 14) return "ioe";
  if (grade === 15) return "bachelors";
  return "general";
}

const AMBIENT_TIPS: Record<string, string[]> = {
  general: [
    "Small consistent sessions build more than occasional marathons.",
    "Try the Pomodoro timer if you're struggling to start.",
    "Writing notes by hand helps memory. Just a tip.",
    "If you're tired, a 10-minute break beats an hour of unfocused reading.",
    "One topic at a time. Not everything at once.",
    "You're here. That already means something.",
    "The best study session is the one you actually do.",
    "Check your to-do list. Cross one thing off.",
    "Explaining concepts out loud is one of the most underrated study tricks.",
    "Your brain consolidates memory while you sleep — study, then rest.",
    "The hardest part of studying is starting. Once you're in, it's easier.",
    "Short daily sessions compound. Don't skip days if you can help it.",
    "If you're confused, that's good — it means you're actually engaging.",
    "Write summaries after each topic. Forces your brain to process it.",
    "The goal isn't to finish the book. It's to understand what you read.",
    "Consistency over intensity, always.",
    "Past papers are more valuable than notes. Practice them.",
    "Tired? Try studying standing up for 10 minutes. Helps more than you'd think.",
    "If you can teach it to someone else, you understand it.",
    "A quick 5-minute walk can reset your focus better than scrolling.",
    "Don't multitask while studying. Music without lyrics if you need sound.",
    "Review what you studied yesterday before starting something new today.",
    "Start with the hardest topic when your energy is highest.",
    "Study sessions under 25 minutes are still valuable. Don't skip short ones.",
    "Taking notes in your own words is worth more than copying.",
    "Your phone is the biggest study killer. Put it in another room.",
    "Progress feels slow until suddenly it doesn't. Keep going.",
    "The students who do well aren't necessarily smarter — they're more consistent.",
    "Set a specific end time when you study. Boundaries help focus.",
    "One hard topic per session, plus one easier one. Balance it.",
  ],
  grade10: [
    "SEE is consistent preparation, not last-minute panic.",
    "Cover one SEE subject today. Just one.",
    "Practice papers matter more than re-reading. Try some.",
    "SEE toppers aren't the smartest — they're the most consistent.",
    "One chapter of SEE prep a day beats cramming the night before.",
    "SEE board exams test understanding, not memorization. Practice applying concepts.",
    "Mock tests now → real confidence on SEE day.",
  ],
  grade12: [
    "Board exams reward students who study every day. Be that student.",
    "One chapter a day keeps the panic away.",
    "Mock tests now → real confidence on exam day.",
    "Board toppers start consistent practice months before — not days.",
    "The board paper won't surprise you if you've practiced past papers.",
    "Grade 12 is the year that shapes what comes next. Use it well.",
    "+2 final exams reward students who built habits early. Build them now.",
  ],
  cee: [
    "CEE is won in the months before, not the days before.",
    "Biology MCQs today? Consistent practice is what separates toppers.",
    "Every focused session is an investment in your medical future.",
    "CEE is competitive — the margin between getting in and not is tiny. Study daily.",
    "MCQ practice > re-reading. Solve questions, not just theory.",
    "CEE Biology + Chemistry + Physics every day, even just 30 minutes.",
    "The students who get CEE seats studied like this — consistently, daily.",
  ],
  ioe: [
    "Engineering entrance rewards consistency over cramming.",
    "Physics + Math daily. That's the IOE formula.",
    "Solve one past question set today. Make it count.",
    "IOE is about understanding, not memorization. Work through problems.",
    "Math fluency comes from practice, not reading. Solve more problems.",
    "Engineering students who make it through IOE study physics daily. Be one.",
    "Derivations matter in IOE. Don't skip them for shortcuts.",
  ],
  bachelors: [
    "Small daily progress beats weekend study binges.",
    "Bachelor's is a marathon. Pace yourself.",
    "Assignments are easier when you start early. Start today.",
    "Bachelor's students who do well read ahead. Try it once.",
    "Consistent attendance + daily review = the formula for bachelor's success.",
    "Semester exams feel far away until they don't. Study now.",
  ],
};

const SESSION_DISMISSED_KEY = "sh_puku_floating_dismissed";

export function PukuFloating() {
  const { profile, user } = useAuth();
  const [emotion, setEmotion]     = useState<PukuEmotion>("happy");
  const [tip, setTip]             = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered]     = useState(false);
  const tipTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickFresh  = useRef(makePickFresh()).current;

  const getTip = useCallback((grade?: number): string => {
    const ctx = gradeCtx(grade);
    const specific = AMBIENT_TIPS[ctx] ?? [];
    const pool = [...AMBIENT_TIPS.general, ...specific];
    return pickFresh(pool);
  }, [pickFresh]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch {}
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") setDismissed(true);
    } catch {}
  }, []);

  // Subtle emotion cycling — feels alive
  useEffect(() => {
    const emotions: PukuEmotion[] = ["happy", "relaxed", "focused", "happy", "relaxed"];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % emotions.length;
      setEmotion(emotions[i]);
    }, 40_000);
    return () => clearInterval(t);
  }, []);

  // Show ambient tip — first at 1–3 min, then every 12–25 min
  useEffect(() => {
    if (!user || dismissed) return;

    const showTip = (grade?: number) => {
      setTip(getTip(grade));
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setTip(null), 14_000);
    };

    const scheduleNext = (grade?: number): ReturnType<typeof setTimeout> => {
      const delay = (12 + Math.random() * 13) * 60_000; // 12–25 min
      return setTimeout(() => {
        showTip(grade);
        tipTimer.current = scheduleNext(grade);
      }, delay);
    };

    // First tip: 1–3 min in
    const firstDelay = (1 + Math.random() * 2) * 60_000;
    tipTimer.current = setTimeout(() => {
      showTip(profile?.grade);
      tipTimer.current = scheduleNext(profile?.grade);
    }, firstDelay);

    return () => {
      if (tipTimer.current)  clearTimeout(tipTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, [user, profile?.grade, dismissed, getTip]);

  if (!user || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 1.5, type: "spring", damping: 18 }}
      className="fixed bottom-[4.5rem] right-3 md:bottom-5 md:right-4 z-30 flex flex-col items-end gap-1.5 pointer-events-none"
    >
      {/* Tip bubble */}
      <AnimatePresence>
        {tip && (
          <motion.div
            key="puku-tip"
            initial={{ opacity: 0, scale: 0.88, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 4 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="pointer-events-auto max-w-[190px] relative"
          >
            <div
              className="px-3 py-2 rounded-2xl text-[11px] leading-snug font-medium text-gray-700 shadow-lg"
              style={{
                background: "rgba(255,255,255,0.96)",
                border: "1.5px solid rgba(139,92,246,0.18)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 2px 8px rgba(139,92,246,0.12)",
              }}
            >
              {tip}
              <div
                className="absolute right-2 bottom-0 translate-y-full"
                style={{
                  width: 0, height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid rgba(255,255,255,0.96)",
                  filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.05))",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar pill */}
      <div
        className="pointer-events-auto flex items-center gap-1.5 relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <AnimatePresence>
          {hovered && (
            <motion.button
              key="dismiss"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              onClick={dismiss}
              className="w-5 h-5 rounded-full bg-gray-200/80 hover:bg-gray-300 flex items-center justify-center transition-colors"
              title="Hide Puku"
            >
              <X className="w-3 h-3 text-gray-500" />
            </motion.button>
          )}
        </AnimatePresence>

        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative"
          onClick={() => {
            setTip(getTip(profile?.grade));
            if (clearTimer.current) clearTimeout(clearTimer.current);
            clearTimer.current = setTimeout(() => setTip(null), 14_000);
          }}
          style={{ cursor: "pointer" }}
        >
          <div
            className="w-9 h-9 rounded-full shadow-md overflow-hidden flex-shrink-0"
            style={{
              background: "linear-gradient(135deg,#8b5cf6,#ec4899)",
              boxShadow: "0 3px 12px rgba(139,92,246,0.35), 0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            <PukuFace emotion={emotion} size={36} speaking={false} />
          </div>
          <motion.div
            className="absolute inset-0 rounded-full border border-purple-400/40"
            animate={{ scale: [1, 1.25], opacity: [0.4, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut" }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
