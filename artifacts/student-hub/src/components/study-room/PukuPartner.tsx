import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minimize2, Maximize2, Send, Volume2, VolumeX } from "lucide-react";

interface Props {
  firstName: string;
  isStudying: boolean;
  isBreak: boolean;
  studyMins: number;
  onLeave?: () => void;
  visible: boolean;
}

function getHour() { return new Date().getHours(); }
function timeLabel() {
  const h = getHour();
  if (h < 5)  return "late night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildMessage(
  type: "greet" | "study" | "break" | "milestone" | "water" | "random" | "task" | "bye",
  name: string,
  mins: number,
  task: string
): string {
  const fn = name.split(" ")[0];
  switch (type) {
    case "greet":
      return pick([
        `Hey ${fn}! I'm Puku, your study bestie 🐾 I'll be right here keeping you company. Let's crush it today!`,
        `${fn}! You showed up, and that already makes you awesome 💪 I'm Puku — your personal hype squad of one. Let's go!`,
        `Ayyy ${fn}! Puku is in the building 🎉 We're gonna have such a productive session, I can feel it!`,
      ]);
    case "study":
      if (mins < 5) return pick([
        `Deep breaths ${fn}, you're just getting started 🌱 The first few minutes are always the hardest — push through!`,
        `Lock in ${fn}! 🔒 Your future self is already thanking you for sitting down right now.`,
        `Okay ${fn}, phone down, focus up 📵 Let's see what you're made of!`,
      ]);
      if (mins < 20) return pick([
        `Look at you go ${fn}! ${mins} minutes in and you're still here 🔥 I'm so proud!`,
        `${fn} you're in the zone right now 🎯 Don't stop — this is where the magic happens!`,
        `${fn}, ${mins} mins deep already? You're literally unstoppable today 💥`,
        `Bro ${fn} is LOCKED IN 🔒 ${mins} minutes of pure focus. Respect.`,
      ]);
      if (mins < 60) return pick([
        `${fn}, ${mins} minutes already?! You're a MACHINE 🤖 Keep that energy!`,
        `Okay ${fn} I see you — ${mins} solid minutes 💎 Most people would've quit by now. You're not most people.`,
        `${fn}! Half an hour of focus? That's NEB exam energy right there 📚 Keep going!`,
        `${fn} I was getting worried you'd stop, but nope — still grinding at ${mins} mins 🙌`,
      ]);
      return pick([
        `${fn} ONE HOUR?! 🏆 That is elite-level dedication. The board exam toppers study like this. That's YOU!`,
        `${fn} you've been at it for ${mins} minutes. Absolute legend. Drink some water and keep going 💧`,
        `${fn} ${mins} minutes in — you're literally building your future right now. I'm not crying you're crying 🥺`,
      ]);
    case "break":
      return pick([
        `Break time ${fn}! 🌿 Step away from the books for a second. Stretch, walk around a bit.`,
        `${fn} you EARNED this break! Take a proper rest — it'll make your next study session even better 😤`,
        `Rest mode activated ${fn} 💤 Close your eyes for a sec, breathe deep. Your brain needs this!`,
        `${fn} this break is mandatory 🛑 Don't peek at your notes. Let your brain process what you learned!`,
      ]);
    case "water":
      return pick([
        `${fn} hey — have you had water recently? Dehydration kills focus 💧 Go grab a glass real quick!`,
        `Psst ${fn} 🤫 When did you last drink water? Don't make me ask again. Go. Now. I'll wait.`,
        `${fn} your brain is 73% water. Are you watering it? 💧 Go get a drink!`,
      ]);
    case "milestone":
      if (mins >= 60) return `${fn} you hit ONE HOUR of studying!! 🏆🎉 That is genuinely incredible — you should feel amazing right now!`;
      if (mins >= 30) return `${fn} THIRTY MINUTES! 🎯 You just proved to yourself that you can do this. Half-hour down!`;
      return `${fn} five minutes done! 🌱 The hardest step is always starting. You did it — now just keep going!`;
    case "task":
      if (!task) return pick([
        `${fn} what are you working on today? Tell me your task and I'll remind you! Just type it 👇`,
        `Hey ${fn} — what's the mission today? Type your study goal and I've got you! 🎯`,
      ]);
      return pick([
        `${fn} remember: "${task}" — that's why you're here! You've got this 💪`,
        `Still working on "${task}" ${fn}? You're doing great, keep pushing 🔥`,
        `"${task}" — ${fn} one step at a time. You're making progress even if it doesn't feel like it!`,
      ]);
    case "random":
      return pick([
        `Fun fact ${fn}: The Pomodoro Technique was invented by a university student. Students built the systems — and you're following them! 🍅`,
        `${fn} did you know that explaining a concept to someone (even me!) helps you remember it 40% better? Try explaining what you just learned 🧠`,
        `${fn} random reminder: every expert was once a beginner. You're building something real here 📖`,
        `${fn} the students who make it to the top aren't smarter — they just don't quit. Guess what category you're in right now 😤`,
        `${fn} NEB ke toppers bhi yahi bata se shuru garne thiyo 📚 Don't compare your journey to others!`,
        `${fn} I've been here with you this whole time and I've noticed — you're more focused than you think! Keep trusting the process 🌟`,
      ]);
    case "bye":
      return `${fn}! Looks like someone else joined — I'll give you your space! You've been amazing today 🌟 Come back anytime!`;
    default:
      return `Hey ${fn} — you good? 😊`;
  }
}

function PukuAvatar({ isSpeaking, size = "lg" }: { isSpeaking: boolean; size?: "sm" | "lg" }) {
  const s = size === "sm" ? 40 : 72;
  return (
    <motion.div
      animate={isSpeaking ? { scale: [1, 1.06, 1, 1.06, 1] } : { scale: 1 }}
      transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.6 }}
      className="relative shrink-0"
      style={{ width: s, height: s }}
    >
      <div
        className="rounded-full flex items-center justify-center text-white font-bold shadow-lg relative overflow-hidden"
        style={{
          width: s, height: s,
          background: "linear-gradient(135deg, #a855f7, #ec4899)",
        }}
      >
        {/* face */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0" style={{ paddingBottom: size === "sm" ? 2 : 4 }}>
          {/* eyes */}
          <div className="flex gap-2 mb-0.5" style={{ gap: size === "sm" ? 5 : 10, marginBottom: size === "sm" ? 1 : 3 }}>
            <motion.div
              animate={isSpeaking ? {} : { scaleY: [1, 0.1, 1] }}
              transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.15 }}
              className="bg-white rounded-full"
              style={{ width: size === "sm" ? 5 : 9, height: size === "sm" ? 5 : 9 }}
            />
            <motion.div
              animate={isSpeaking ? {} : { scaleY: [1, 0.1, 1] }}
              transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.15, delay: 0.05 }}
              className="bg-white rounded-full"
              style={{ width: size === "sm" ? 5 : 9, height: size === "sm" ? 5 : 9 }}
            />
          </div>
          {/* mouth */}
          <motion.div
            animate={isSpeaking ? { scaleX: [1, 1.3, 0.8, 1.2, 1] } : {}}
            transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.4 }}
            className="bg-white rounded-full"
            style={{
              width: size === "sm" ? 8 : 14,
              height: size === "sm" ? 4 : 7,
              borderRadius: "0 0 50% 50%",
            }}
          />
        </div>
        {/* rosy cheeks */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pb-1 pointer-events-none" style={{ paddingBottom: size === "sm" ? 1 : 3, paddingLeft: size === "sm" ? 2 : 4, paddingRight: size === "sm" ? 2 : 4 }}>
          <div className="rounded-full bg-pink-300/50" style={{ width: size === "sm" ? 6 : 11, height: size === "sm" ? 4 : 7 }} />
          <div className="rounded-full bg-pink-300/50" style={{ width: size === "sm" ? 6 : 11, height: size === "sm" ? 4 : 7 }} />
        </div>
        {/* ears */}
        <div className="absolute -top-1 left-2 w-3 h-3 rounded-full bg-purple-400" style={{ width: size === "sm" ? 7 : 12, height: size === "sm" ? 7 : 12, top: size === "sm" ? -3 : -5, left: size === "sm" ? 4 : 7 }} />
        <div className="absolute -top-1 right-2 w-3 h-3 rounded-full bg-purple-400" style={{ width: size === "sm" ? 7 : 12, height: size === "sm" ? 7 : 12, top: size === "sm" ? -3 : -5, right: size === "sm" ? 4 : 7 }} />
      </div>
      {isSpeaking && (
        <motion.div
          className="absolute -right-1 -bottom-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
        >
          🎙
        </motion.div>
      )}
    </motion.div>
  );
}

export function PukuPartner({ firstName, isStudying, isBreak, studyMins, onLeave, visible }: Props) {
  const [minimized,     setMinimized]     = useState(false);
  const [message,       setMessage]       = useState("");
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [muted,         setMuted]         = useState(false);
  const [task,          setTask]          = useState("");
  const [taskInput,     setTaskInput]     = useState("");
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [messages,      setMessages]      = useState<{ text: string; from: "puku" | "user" }[]>([]);
  const [chatInput,     setChatInput]     = useState("");
  const chatEndRef                         = useRef<HTMLDivElement>(null);

  const prevStudying = useRef(false);
  const prevBreak    = useRef(false);
  const milestones   = useRef<Set<number>>(new Set());
  const waterTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasGreeted   = useRef(false);

  const speak = useCallback((text: string) => {
    setMessage(text);
    setMessages(prev => [...prev.slice(-30), { text, from: "puku" }]);
    if (muted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    utt.pitch = 1.3;
    utt.volume = 0.85;
    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find(v =>
        v.name.toLowerCase().includes("female") ||
        v.name.includes("Samantha") ||
        v.name.includes("Google US English")
      );
      if (pref) utt.voice = pref;
      setIsSpeaking(true);
      utt.onend = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utt);
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", trySpeak, { once: true });
    }
  }, [muted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!visible) return;
    if (!hasGreeted.current) {
      hasGreeted.current = true;
      const t = setTimeout(() => {
        speak(buildMessage("greet", firstName, 0, task));
      }, 800);
      return () => clearTimeout(t);
    }
  }, [visible, firstName]);

  useEffect(() => {
    if (!visible) return;
    const nowStudying = isStudying;
    const nowBreak    = isBreak;
    if (nowStudying && !prevStudying.current) {
      speak(buildMessage("study", firstName, studyMins, task));
    } else if (nowBreak && !prevBreak.current) {
      speak(buildMessage("break", firstName, studyMins, task));
    }
    prevStudying.current = nowStudying;
    prevBreak.current    = nowBreak;
  }, [isStudying, isBreak]);

  useEffect(() => {
    if (!visible) return;
    const checkpoints = [5, 30, 60, 90, 120];
    for (const cp of checkpoints) {
      if (studyMins >= cp && !milestones.current.has(cp)) {
        milestones.current.add(cp);
        speak(buildMessage("milestone", firstName, studyMins, task));
        return;
      }
    }
  }, [studyMins]);

  useEffect(() => {
    if (!visible) return;
    const water = setInterval(() => {
      speak(buildMessage("water", firstName, studyMins, task));
    }, 20 * 60 * 1000);
    waterTimer.current = water;
    return () => clearInterval(water);
  }, [visible, firstName]);

  useEffect(() => {
    if (!visible) return;
    const idle = setInterval(() => {
      const types: Array<"study" | "random" | "task"> = ["study", "random", ...(task ? ["task" as const] : [])];
      speak(buildMessage(pick(types), firstName, studyMins, task));
    }, (2.5 + Math.random() * 2) * 60 * 1000);
    idleTimer.current = idle;
    return () => clearInterval(idle);
  }, [visible, firstName, studyMins, task]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (waterTimer.current) clearInterval(waterTimer.current);
      if (idleTimer.current)  clearInterval(idleTimer.current);
    };
  }, []);

  function handleSendTask() {
    if (!taskInput.trim()) return;
    const t = taskInput.trim();
    setTask(t);
    setTaskInput("");
    setShowTaskInput(false);
    speak(`Got it ${firstName.split(" ")[0]}! I'll keep reminding you about "${t}". Now focus! 💪`);
  }

  function handleChatSend() {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev.slice(-30), { text: msg, from: "user" }]);
    const lower = msg.toLowerCase();
    let reply = "";
    if (lower.includes("tired") || lower.includes("thak")) {
      reply = pick([
        `${firstName.split(" ")[0]} I hear you 💙 Take a 2 minute walk, splash water on your face. You'll feel better!`,
        `Tired is just your body catching up to how hard your brain is working! 5 more minutes then a proper break deal? 🤝`,
      ]);
    } else if (lower.includes("help") || lower.includes("stuck") || lower.includes("samjhena")) {
      reply = pick([
        `${firstName.split(" ")[0]} when you're stuck — try explaining the concept out loud (even to me!). It really helps 🧠`,
        `Get stuck means get growth! Try reading the question from scratch, or skip and come back. You've got this 💡`,
      ]);
    } else if (lower.includes("water") || lower.includes("paani")) {
      reply = `Yes! Go drink water RIGHT NOW ${firstName.split(" ")[0]} 💧 I'll be here when you get back!`;
    } else if (lower.includes("good") || lower.includes("great") || lower.includes("ramro")) {
      reply = pick([
        `${firstName.split(" ")[0]} that's what I want to hear!! 🎉 Keep that energy!`,
        `YES! ${firstName.split(" ")[0]} is THRIVING! Love to see it 🌟`,
      ]);
    } else if (lower.includes("puku")) {
      reply = `That's me! 🐾 Your study bestie Puku, always in your corner ${firstName.split(" ")[0]}!`;
    } else {
      reply = pick([
        `${firstName.split(" ")[0]}, I hear you! Now get back to studying, I'll be cheering you on 🔥`,
        `haha ${firstName.split(" ")[0]} 😄 but seriously... books open? Let's go! 📚`,
        `${firstName.split(" ")[0]}! Focus mode activate! 🎯 You can do this!`,
      ]);
    }
    setTimeout(() => speak(reply), 400);
  }

  if (!visible) return null;

  if (minimized) {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6 cursor-pointer"
        onClick={() => setMinimized(false)}
        title="Open Puku"
      >
        <div className="relative">
          <PukuAvatar isSpeaking={isSpeaking} size="sm" />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </div>
        <p className="text-[9px] text-center mt-0.5 font-bold text-purple-600 dark:text-purple-400">PUKU</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.9 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
      className="fixed bottom-20 right-2 z-40 w-72 lg:bottom-6 lg:right-6 lg:w-80 flex flex-col shadow-2xl rounded-3xl overflow-hidden border border-purple-200 dark:border-purple-800/40 bg-white dark:bg-gray-900"
      style={{ maxHeight: "min(520px, 80vh)" }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-2.5 flex items-center gap-2.5">
        <PukuAvatar isSpeaking={isSpeaking} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-bold text-sm">PUKU</p>
            <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
            <span className="text-white/60 text-[10px]">your study bestie</span>
          </div>
          <p className="text-white/70 text-[10px] truncate">
            {isSpeaking ? "speaking…" : isStudying ? "📚 studying with you" : isBreak ? "☕ break time!" : "waiting for session"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMuted(m => !m)} className="p-1 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors" title={muted ? "Unmute Puku" : "Mute Puku"}>
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setMinimized(true)} className="p-1 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          {onLeave && (
            <button onClick={() => { window.speechSynthesis?.cancel(); onLeave(); }} className="p-1 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Task bar */}
      <div className="px-3 py-2 border-b border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20">
        {showTaskInput ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              type="text"
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendTask()}
              placeholder="What are you studying today?"
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button onClick={handleSendTask} className="px-2 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors">
              <Send className="w-3 h-3" />
            </button>
            <button onClick={() => setShowTaskInput(false)} className="px-1.5 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={() => setShowTaskInput(true)} className="w-full text-left text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center gap-1.5">
            <span>🎯</span>
            <span className="truncate">{task ? `Task: "${task}"` : "Tell Puku what you're studying →"}</span>
          </button>
        )}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0" style={{ maxHeight: 200 }}>
        {messages.length === 0 && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-3">Puku is warming up… 🐾</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "puku" ? "items-start gap-1.5" : "justify-end"}`}>
            {m.from === "puku" && (
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px]" style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}>
                🐾
              </div>
            )}
            <div className={`max-w-[80%] px-2.5 py-1.5 rounded-2xl text-xs leading-relaxed ${
              m.from === "puku"
                ? "bg-purple-50 dark:bg-purple-950/40 text-gray-800 dark:text-gray-200 rounded-tl-sm"
                : "bg-blue-500 text-white rounded-tr-sm"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleChatSend()}
            placeholder="Talk to Puku…"
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700"
          />
          <button
            onClick={handleChatSend}
            disabled={!chatInput.trim()}
            className="p-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-40 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
