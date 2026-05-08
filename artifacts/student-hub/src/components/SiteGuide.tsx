import { useState, useEffect } from "react";
import { X, ArrowRight, ArrowLeft, BookOpen, FileText, Bot, Timer, BarChart2, Trophy, Flame, Bookmark } from "lucide-react";

const GUIDE_KEY = "studenthub_guide_v1_seen";

interface Step {
  emoji: string;
  title: string;
  description: string;
  highlight?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color: string;
}

const steps: Step[] = [
  {
    emoji: "👋",
    title: "Welcome to Student Hub!",
    description: "The ultimate free study platform for Grade 9–12 students across Nepal. Let us show you everything this site can do — you'll be amazed! 🤩",
    color: "from-blue-500 to-indigo-600",
  },
  {
    emoji: "📚",
    title: "Study Notes — Your Best Friend",
    description: "Browse hundreds of notes organized by grade and subject. Science, Maths, English, Nepali, Social Studies — all in one place. Read, zoom, and even go fullscreen!",
    highlight: "Go to Notes →",
    icon: BookOpen,
    color: "from-blue-400 to-blue-600",
  },
  {
    emoji: "📝",
    title: "Previous Year Questions",
    description: "Practice with real exam papers from previous years. View PDFs, zoom into images, and download them. Perfect preparation for SEE and NEB exams!",
    highlight: "Go to PYQ →",
    icon: FileText,
    color: "from-orange-400 to-orange-600",
  },
  {
    emoji: "🤖",
    title: "Nep AI — Your Personal Tutor",
    description: "Stuck on a problem? Nep AI explains concepts, solves problems step-by-step, and gives you personalized study advice based on YOUR progress. It's like having a tutor 24/7 — completely free!",
    highlight: "Try Nep AI →",
    icon: Bot,
    color: "from-indigo-500 to-purple-600",
  },
  {
    emoji: "⏱️",
    title: "Pomodoro Timer — Study Like a Pro",
    description: "The Pomodoro technique is the world's best study method: 25 minutes of focus, then a short break. Your study time is automatically recorded and saved — even if you switch tabs!",
    highlight: "Try Pomodoro →",
    icon: Timer,
    color: "from-red-400 to-red-600",
  },
  {
    emoji: "🔥",
    title: "Streak System",
    description: "Study every day and build your streak! Miss a day and it resets. The longer your streak, the more badges you earn. Top students have streaks of 30, 60, even 100+ days! Can you beat them? 💪",
    icon: Flame,
    color: "from-orange-500 to-red-500",
  },
  {
    emoji: "📊",
    title: "Report Card — See Your Progress",
    description: "Your personal Report Card shows daily study charts, badges you've earned, and deep insights into your study habits. Switch between weekly and monthly views. Knowledge is power!",
    highlight: "View Report Card →",
    icon: BarChart2,
    color: "from-purple-500 to-purple-700",
  },
  {
    emoji: "🏆",
    title: "Leaderboard — Compete With Nepal!",
    description: "You're not just studying alone — you're competing with students from your grade across the entire country! Study more, climb the leaderboard, and show Nepal who's the best student. 🇳🇵",
    highlight: "See Leaderboard →",
    icon: Trophy,
    color: "from-yellow-500 to-orange-500",
  },
  {
    emoji: "🔖",
    title: "Save Notes & PYQs",
    description: "Found an important note or past paper? Save it with one click! All your saved notes and PYQs appear in your Saved section for quick access anytime.",
    icon: Bookmark,
    color: "from-green-500 to-teal-600",
  },
  {
    emoji: "🚀",
    title: "You're Ready to Go!",
    description: "Everything is free. No ads on your study materials. No credit card needed. Just open your books, start the Pomodoro timer, and climb that leaderboard. Nepal's top student is YOU! 🌟",
    color: "from-blue-500 to-indigo-600",
  },
];

export function SiteGuide() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(GUIDE_KEY);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(GUIDE_KEY, "1");
    setVisible(false);
  };

  const next = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else close();
  };

  const prev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  if (!visible) return null;

  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: "guideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}>
        <style>{`@keyframes guideIn { from { opacity:0; transform:translateY(40px) scale(0.95); } to { opacity:1; transform:none; } }`}</style>

        {/* Header gradient */}
        <div className={`bg-gradient-to-r ${s.color} p-6 pb-8 relative`}>
          <button onClick={close}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-all">
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="text-5xl mb-3 leading-none">{s.emoji}</div>
          <h2 className="text-xl font-bold text-white leading-snug">{s.title}</h2>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 text-sm leading-relaxed mb-5">{s.description}</p>

          {/* Step dots */}
          <div className="flex gap-1.5 justify-center mb-5">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step ? "w-5 h-2 bg-blue-500" : "w-2 h-2 bg-gray-200 hover:bg-gray-300"
                }`} />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={prev}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium hover:bg-gray-50 transition-all">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button onClick={next}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all bg-gradient-to-r ${s.color} hover:opacity-90`}>
              {isLast ? "Let's go! 🚀" : (<>Next <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </div>

          <button onClick={close} className="w-full text-center mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}

export function resetGuide() {
  localStorage.removeItem(GUIDE_KEY);
}
