import { StudyPhase } from "@/lib/studyRooms";
import { BookOpen, Coffee, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

interface Props {
  phases: StudyPhase[];
  onChange: (phases: StudyPhase[]) => void;
}

const PRESETS = [
  { label: "Classic Pomodoro", phases: [{ type: "study", label: "Focus", durationMins: 25 }, { type: "break", label: "Short Break", durationMins: 5 }, { type: "study", label: "Focus", durationMins: 25 }, { type: "break", label: "Short Break", durationMins: 5 }, { type: "study", label: "Focus", durationMins: 25 }, { type: "break", label: "Short Break", durationMins: 5 }, { type: "study", label: "Focus", durationMins: 25 }, { type: "break", label: "Long Break", durationMins: 15 }] as StudyPhase[] },
  { label: "Deep Work 2h", phases: [{ type: "study", label: "Deep Focus", durationMins: 120 }, { type: "break", label: "Break", durationMins: 20 }] as StudyPhase[] },
  { label: "NEB Prep", phases: [{ type: "study", label: "Study", durationMins: 50 }, { type: "break", label: "Break", durationMins: 10 }, { type: "study", label: "Study", durationMins: 45 }, { type: "break", label: "Break", durationMins: 15 }, { type: "study", label: "Study", durationMins: 60 }, { type: "break", label: "Long Break", durationMins: 20 }] as StudyPhase[] },
  { label: "Quick Sprint", phases: [{ type: "study", label: "Sprint", durationMins: 15 }, { type: "break", label: "Break", durationMins: 3 }, { type: "study", label: "Sprint", durationMins: 15 }, { type: "break", label: "Break", durationMins: 3 }, { type: "study", label: "Sprint", durationMins: 15 }] as StudyPhase[] },
];

export function StudyFlowBuilder({ phases, onChange }: Props) {
  const addPhase = (type: "study" | "break") => {
    onChange([...phases, {
      type,
      label: type === "study" ? "Focus" : "Break",
      durationMins: type === "study" ? 25 : 5,
    }]);
  };

  const removePhase = (i: number) => {
    onChange(phases.filter((_, idx) => idx !== i));
  };

  const updatePhase = (i: number, updates: Partial<StudyPhase>) => {
    onChange(phases.map((p, idx) => idx === i ? { ...p, ...updates } : p));
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...phases];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };

  const moveDown = (i: number) => {
    if (i === phases.length - 1) return;
    const next = [...phases];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  };

  const totalMins = phases.reduce((s, p) => s + p.durationMins, 0);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const totalLabel = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ""}` : `${m}m`;

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.phases)}
              className="px-3 py-1.5 text-xs rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phase list */}
      <div className="space-y-2">
        {phases.map((phase, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 p-3 rounded-xl border ${
              phase.type === "study"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            }`}
          >
            {phase.type === "study"
              ? <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              : <Coffee className="w-4 h-4 text-green-500 flex-shrink-0" />
            }

            <input
              type="text"
              value={phase.label}
              onChange={(e) => updatePhase(i, { label: e.target.value })}
              className="flex-1 min-w-0 text-sm font-medium bg-transparent border-none outline-none text-gray-800 dark:text-gray-200 placeholder-gray-400"
              placeholder={phase.type === "study" ? "Focus" : "Break"}
              maxLength={30}
            />

            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={480}
                value={phase.durationMins}
                onChange={(e) => updatePhase(i, { durationMins: Math.max(1, Math.min(480, parseInt(e.target.value) || 1)) })}
                className="w-14 text-center text-sm font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-1 py-1 outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">min</span>
            </div>

            <div className="flex items-center gap-0.5 ml-1">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={i === 0}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={i === phases.length - 1}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removePhase(i)}
                className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addPhase("study")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Study Phase
        </button>
        <button
          type="button"
          onClick={() => addPhase("break")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Break Phase
        </button>
      </div>

      {phases.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Total session: <span className="font-semibold text-gray-700 dark:text-gray-300">{totalLabel}</span>
          {" · "}{phases.filter(p => p.type === "study").length} study phase{phases.filter(p => p.type === "study").length !== 1 ? "s" : ""},
          {" "}{phases.filter(p => p.type === "break").length} break{phases.filter(p => p.type === "break").length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
