import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PukuFace, type PukuEmotion } from "@/components/study-room/PukuPartner";

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function gradeCtx(grade?: number) {
  if (grade === 10) return "grade10";
  if (grade === 12) return "grade12";
  if (grade === 13) return "cee";
  if (grade === 14) return "ioe";
  if (grade === 15) return "bachelors";
  return "general";
}

// Ambient tips shown at most once every 20–40 min — very low noise
const AMBIENT_TIPS: Record<string, string[]> = {
  general: [
    "Small consistent sessions build more than occasional marathons.",
    "Try the Pomodoro timer if you're struggling to start.",
    "Writing notes by hand helps memory. Just a tip.",
    "If you're tired, a 10-minute break is better than an hour of unfocused reading.",
    "One topic at a time. Not everything at once.",
    "You're here. That already means something.",
    "The best study session is the one you actually do.",
    "Check your to-do list. Cross one thing off.",
  ],
  grade10: [
    "SEE is consistent preparation, not last-minute panic.",
    "Cover one SEE subject today. Just one.",
    "Practice papers matter more than re-reading. Try some.",
  ],
  grade12: [
    "Board exams reward students who study every day. Be that student.",
    "One chapter a day keeps the panic away.",
    "Mock tests now → real confidence on exam day.",
  ],
  cee: [
    "CEE is won in the months before, not the days before.",
    "Biology MCQs today? Consistent practice is what separates toppers.",
    "Every focused session is an investment in your medical future.",
  ],
  ioe: [
    "Engineering entrance rewards consistency over cramming.",
    "Physics + Math daily. That's the IOE formula.",
    "Solve one past question set today. Make it count.",
  ],
  bachelors: [
    "Small daily progress beats weekend study binges.",
    "Bachelor's is a marathon. Pace yourself.",
    "Assignments are easier when you start early. Start today.",
  ],
};

function getTip(grade?: number): string {
  const ctx = gradeCtx(grade);
  const specific = AMBIENT_TIPS[ctx] ?? [];
  const pool = [...AMBIENT_TIPS.general, ...specific];
  return pick(pool);
}

const SESSION_DISMISSED_KEY = "sh_puku_floating_dismissed";

export function PukuFloating() {
  const { profile, user } = useAuth();
  const [emotion, setEmotion]   = useState<PukuEmotion>("happy");
  const [tip, setTip]           = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered]   = useState(false);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dismiss for this session
  const dismiss = useCallback(() => {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_DISMISSED_KEY, "1"); } catch {}
  }, []);

  // Check if dismissed this session
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1") setDismissed(true);
    } catch {}
  }, []);

  // Cycle through subtle emotion changes to feel alive
  useEffect(() => {
    const emotions: PukuEmotion[] = ["happy", "relaxed", "focused", "happy", "relaxed"];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % emotions.length;
      setEmotion(emotions[i]);
    }, 45_000); // change every 45 seconds — very subtle
    return () => clearInterval(t);
  }, []);

  // Show ambient tip once every 20–40 minutes
  useEffect(() => {
    if (!user || dismissed) return;

    const scheduleNext = (): ReturnType<typeof setTimeout> => {
      const delay = (20 + Math.random() * 20) * 60_000; // 20–40 min
      return setTimeout(() => {
        setTip(getTip(profile?.grade));
        // Auto-clear tip after 12 seconds
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setTip(null), 12_000);
        tipTimer.current = scheduleNext();
      }, delay);
    };

    // Show first tip after 3–8 min of being on the app
    const firstDelay = (3 + Math.random() * 5) * 60_000;
    tipTimer.current = setTimeout(() => {
      setTip(getTip(profile?.grade));
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setTip(null), 12_000);
      tipTimer.current = scheduleNext();
    }, firstDelay);

    return () => {
      if (tipTimer.current)  clearTimeout(tipTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, [user, profile?.grade, dismissed]);

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
            className="pointer-events-auto max-w-[180px] relative"
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
              {/* Tail pointing right-down toward Puku avatar */}
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
        {/* Dismiss button — only visible on hover */}
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

        {/* Puku avatar */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative"
          onClick={() => {
            setTip(getTip(profile?.grade));
            if (clearTimer.current) clearTimeout(clearTimer.current);
            clearTimer.current = setTimeout(() => setTip(null), 12_000);
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
          {/* Subtle pulse ring to feel alive */}
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
