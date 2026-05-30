import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Unlock, Users, Music, ChevronRight, Volume2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { StudyFlowBuilder } from "@/components/study-room/StudyFlowBuilder";
import { createRoom, joinRoom, StudyPhase, SUBJECTS, AMBIENT_SOUNDS, RoomTheme } from "@/lib/studyRooms";
import { useAmbientSound } from "@/hooks/useAmbientSound";

const DEFAULT_FLOW: StudyPhase[] = [
  { type: "study", label: "Focus",       durationMins: 25 },
  { type: "break", label: "Short Break", durationMins: 5  },
  { type: "study", label: "Focus",       durationMins: 25 },
  { type: "break", label: "Short Break", durationMins: 5  },
  { type: "study", label: "Focus",       durationMins: 25 },
  { type: "break", label: "Long Break",  durationMins: 15 },
];

export default function StudyRoomCreate() {
  const { user, profile } = useAuth();
  const [, setLocation] = useLocation();
  const { preview, stopPreview } = useAmbientSound("none", false);

  const [title,           setTitle]           = useState("");
  const [subject,         setSubject]         = useState("Science");
  const [description,     setDescription]     = useState("");
  const [isPrivate,       setIsPrivate]       = useState(false);
  const [password,        setPassword]        = useState("");
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [ambientSound,    setAmbientSound]    = useState("none");
  const [theme,           setTheme]           = useState<RoomTheme>("classic");
  const [studyFlow,       setStudyFlow]       = useState<StudyPhase[]>(DEFAULT_FLOW);
  const [loading,         setLoading]         = useState(false);
  const [step,            setStep]            = useState<"details" | "flow">("details");
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [previewing,      setPreviewing]      = useState<string | null>(null);

  // Stop preview on unmount
  useEffect(() => () => stopPreview(), [stopPreview]);

  function handleSoundSelect(id: string) {
    setAmbientSound(id);
    // Preview the sound for 5 seconds when selected
    if (id !== "none") {
      stopPreview();
      setPreviewing(id);
      preview(id);
      setTimeout(() => setPreviewing(null), 5000);
    } else {
      stopPreview();
      setPreviewing(null);
    }
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Room title is required";
    if (title.trim().length > 60) e.title = "Title too long (max 60 chars)";
    if (isPrivate && !password.trim()) e.password = "Password required for private rooms";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    if (studyFlow.length === 0) {
      setErrors({ flow: "Add at least one study phase" });
      return false;
    }
    setErrors({});
    return true;
  }

  async function handleCreate() {
    if (!user || !profile) return;
    if (!validateStep2()) return;
    stopPreview();
    setLoading(true);
    try {
      const roomId = await createRoom({
        title: title.trim(),
        subject,
        description: description.trim(),
        isPrivate,
        password: isPrivate ? password.trim() : undefined,
        hostUid: user.uid,
        hostName: profile.name,
        hostGrade: profile.grade,
        maxParticipants,
        studyFlow,
        ambientSound,
        theme,
      });

      await joinRoom(roomId, {
        uid: user.uid,
        name: profile.name,
        grade: profile.grade,
        isHost: true,
      });

      setLocation(`/study-rooms/${roomId}`);
    } catch (err: unknown) {
      console.error("createRoom error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrors({ submit: `Failed to create room: ${msg}` });
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 dark:text-gray-400">Please sign in to create a study room.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Create Study Room — StudentHub</title>
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => step === "flow" ? setStep("details") : setLocation("/study-rooms")}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create Study Room</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {step === "details" ? "Step 1 of 2 — Room details" : "Step 2 of 2 — Study flow"}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {["details", "flow"].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                step === "flow" || (step === "details" && i === 0)
                  ? "bg-blue-500"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: step === "flow" ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {step === "details" ? (
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Room Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. SEE Science Prep — Morning Session"
                  maxLength={60}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-shadow"
                />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
              </div>

              {/* Subject */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you focusing on today?"
                  maxLength={200}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>

              {/* Max participants */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Max Participants
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={50}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 w-16">
                    <Users className="w-4 h-4 text-gray-400" />
                    {maxParticipants}
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setIsPrivate(!isPrivate)}
                >
                  <div className="flex items-center gap-2.5">
                    {isPrivate
                      ? <Lock className="w-4 h-4 text-orange-500" />
                      : <Unlock className="w-4 h-4 text-green-500" />
                    }
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {isPrivate ? "Private Room" : "Public Room"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {isPrivate ? "Invite-only via password" : "Anyone can join and search for it"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors ${isPrivate ? "bg-orange-500" : "bg-green-500"} relative`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </div>
                </div>

                {isPrivate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                  >
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Room password"
                      maxLength={20}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                  </motion.div>
                )}
              </div>

              {/* Ambient sound — with live preview */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
                  <Music className="w-4 h-4" /> Ambient Sound
                </label>
                {previewing && previewing !== "none" && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 mb-2"
                  >
                    <Volume2 className="w-3 h-3 animate-pulse" />
                    Previewing {AMBIENT_SOUNDS.find(s => s.id === previewing)?.label}…
                  </motion.p>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {AMBIENT_SOUNDS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSoundSelect(s.id)}
                      className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        ambientSound === s.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <span className="text-xl">{s.emoji}</span>
                      <span className="leading-tight text-center">{s.label}</span>
                      {previewing === s.id && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                  Click a sound to preview it (5s). This plays for all room members automatically.
                </p>
              </div>

              {/* Classroom Theme */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Classroom Theme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "classic", emoji: "🏫", label: "Classic",    desc: "Himalayan daytime classroom" },
                    { id: "night",   emoji: "🌙", label: "Late Night", desc: "Cozy lamp-lit study room" },
                  ] as { id: RoomTheme; emoji: string; label: string; desc: string }[]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        theme === t.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <span className="text-2xl">{t.emoji}</span>
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight text-center">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => validateStep1() && setStep("flow")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm hover:shadow transition-all"
              >
                Next: Study Flow <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Design Your Study Flow</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  All students in the room will follow this sequence together.
                </p>
                <StudyFlowBuilder phases={studyFlow} onChange={setStudyFlow} />
                {errors.flow && <p className="text-red-500 text-xs mt-2">{errors.flow}</p>}
              </div>

              {errors.submit && (
                <p className="text-red-500 text-sm text-center">{errors.submit}</p>
              )}

              <button
                onClick={handleCreate}
                disabled={loading || studyFlow.length === 0}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating room...
                  </>
                ) : (
                  "Create & Enter Room 🚀"
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
