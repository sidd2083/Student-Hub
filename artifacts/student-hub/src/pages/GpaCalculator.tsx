import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Calculator, ChevronDown, Info, CheckCircle } from "lucide-react";

// ── Grade point scale ──────────────────────────────────────────────────────────
const THEORY_GRADES = [
  { label: "A+  (90–100%  /  67.5–75)",  value: 4.0 },
  { label: "A   (80–89%   /  60–67.5)",  value: 3.6 },
  { label: "B+  (70–79%   /  52.5–60)",  value: 3.2 },
  { label: "B   (60–69%   /  45–52.5)",  value: 2.8 },
  { label: "C+  (50–59%   /  37.5–45)",  value: 2.4 },
  { label: "C   (40–49%   /  30–37.5)",  value: 2.0 },
  { label: "D   (35–39%   /  26.25–30)", value: 1.6 },
  { label: "NG  (Below 35%)",             value: 0.0 },
];
const PRACTICAL_GRADES = [
  { label: "A+  (22.5–25)",  value: 4.0 },
  { label: "A   (20–22.5)",  value: 3.6 },
  { label: "B+  (17.5–20)",  value: 3.2 },
  { label: "B   (15–17.5)",  value: 2.8 },
  { label: "C+  (12.5–15)",  value: 2.4 },
  { label: "C   (10–12.5)",  value: 2.0 },
  { label: "D   (8.75–10)",  value: 1.6 },
  { label: "NG  (Below 8.75)", value: 0.0 },
];

// Computer Science — Science stream ONLY: Theory 50 marks + Practical 50 marks
const CS50_GRADES = [
  { label: "A+  (90–100%  /  45–50)",   value: 4.0 },
  { label: "A   (80–89%   /  40–45)",   value: 3.6 },
  { label: "B+  (70–79%   /  35–40)",   value: 3.2 },
  { label: "B   (60–69%   /  30–35)",   value: 2.8 },
  { label: "C+  (50–59%   /  25–30)",   value: 2.4 },
  { label: "C   (40–49%   /  20–25)",   value: 2.0 },
  { label: "D   (35–39%   /  17.5–20)", value: 1.6 },
  { label: "NG  (Below 35%)",            value: 0.0 },
];

// ── NEB subject types ──────────────────────────────────────────────────────────
// Most subjects: Theory (75) + Practical/Internal (25) = 100 marks
// Computer Science (Science stream only): Theory (50) + Practical (50) = 100 marks

const MANAGEMENT_OPTIONALS = [
  { value: "accountancy",  label: "Accountancy" },
  { value: "economics",    label: "Economics" },
  { value: "business",     label: "Business Studies" },
  { value: "computer",     label: "Computer Science" },
  { value: "tourism",      label: "Tourism & Mountaineering" },
  { value: "businessMath", label: "Business Mathematics" },
  { value: "hotel",        label: "Hotel Management" },
];

type GradeInput = { theory: number | null; practical: number | null };
const EMPTY: GradeInput = { theory: null, practical: null };

function subjectGpa(g: GradeInput): number | null {
  if (g.theory === null || g.practical === null) return null;
  return (g.theory * 75 + g.practical * 25) / 100;
}

// Computer Science (Science stream): Theory 50 + Practical 50
function subjectGpaCS(g: GradeInput): number | null {
  if (g.theory === null || g.practical === null) return null;
  return (g.theory * 50 + g.practical * 50) / 100;
}

function gpaBadge(gpa: number): { letter: string; label: string; color: string; bg: string } {
  if (gpa >= 3.6) return { letter: "A+", label: "Outstanding",  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (gpa >= 3.2) return { letter: "A",  label: "Excellent",    color: "text-green-700",   bg: "bg-green-50 border-green-200"   };
  if (gpa >= 2.8) return { letter: "B+", label: "Very Good",    color: "text-blue-700",    bg: "bg-blue-50 border-blue-200"     };
  if (gpa >= 2.4) return { letter: "B",  label: "Good",         color: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-200" };
  if (gpa >= 2.0) return { letter: "C+", label: "Satisfactory", color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-200" };
  if (gpa >= 1.6) return { letter: "C",  label: "Acceptable",   color: "text-orange-700",  bg: "bg-orange-50 border-orange-200" };
  return              { letter: "D",  label: "Insufficient",  color: "text-red-700",     bg: "bg-red-50 border-red-200"       };
}

function GradeSelect({
  label, sublabel, grades, value, onChange, placeholder = "Select grade",
}: {
  label: string; sublabel: string; grades: typeof THEORY_GRADES;
  value: number | null; onChange: (v: number | null) => void; placeholder?: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-gray-500 mb-1">{label} <span className="font-normal text-gray-400">({sublabel})</span></div>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={e => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
          className="w-full appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {grades.map(g => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

function SubjectCard({
  name, value, onChange, theoryLabel = "Theory", practicalLabel = "Practical / Internal",
}: {
  name: string; value: GradeInput; onChange: (v: GradeInput) => void;
  theoryLabel?: string; practicalLabel?: string;
}) {
  const gpa = subjectGpa(value);
  const badge = gpa !== null ? gpaBadge(gpa) : null;
  return (
    <div className={`rounded-xl border p-4 transition-all ${badge ? badge.bg : "bg-white border-gray-100"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">{name}</span>
        {badge && (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badge.color} ${badge.bg}`}>
            {badge.letter} · {gpa!.toFixed(2)}
          </span>
        )}
      </div>
      <div className="flex gap-3">
        <GradeSelect
          label={theoryLabel} sublabel="75 marks"
          grades={THEORY_GRADES}
          value={value.theory}
          onChange={t => onChange({ ...value, theory: t })}
        />
        <GradeSelect
          label={practicalLabel} sublabel="25 marks"
          grades={PRACTICAL_GRADES}
          value={value.practical}
          onChange={p => onChange({ ...value, practical: p })}
        />
      </div>
    </div>
  );
}

// ── SCIENCE STREAM ─────────────────────────────────────────────────────────────
type ScienceState = {
  english: GradeInput; nepali: GradeInput; physics: GradeInput;
  chemistry: GradeInput; math: GradeInput;
  optional: "computer" | "biology";
  optionalGrade: GradeInput;
};
const initScience = (): ScienceState => ({
  english: EMPTY, nepali: EMPTY, physics: EMPTY,
  chemistry: EMPTY, math: EMPTY,
  optional: "biology", optionalGrade: EMPTY,
});

function ScienceCalculator() {
  const [s, setS] = useState<ScienceState>(initScience);

  const subjectResults = useMemo(() => [
    { name: "English",  gpa: subjectGpa(s.english)  },
    { name: "Nepali",   gpa: subjectGpa(s.nepali)   },
    { name: "Physics",  gpa: subjectGpa(s.physics)  },
    { name: "Chemistry",gpa: subjectGpa(s.chemistry)},
    { name: "Mathematics", gpa: subjectGpa(s.math)  },
    { name: s.optional === "biology" ? "Biology" : "Computer Science",
      gpa: s.optional === "computer" ? subjectGpaCS(s.optionalGrade) : subjectGpa(s.optionalGrade) },
  ], [s]);

  const result = useMemo(() => {
    const filled = subjectResults.filter(r => r.gpa !== null);
    if (filled.length === 0) return null;
    const total = filled.reduce((a, r) => a + r.gpa!, 0);
    return { gpa: total / filled.length, filled: filled.length, total: 6 };
  }, [subjectResults]);

  return (
    <div className="space-y-3">
      <SubjectCard name="English"   value={s.english}   onChange={v => setS(p => ({ ...p, english: v }))} />
      <SubjectCard name="Nepali"    value={s.nepali}    onChange={v => setS(p => ({ ...p, nepali: v }))}  theoryLabel="Theory" practicalLabel="Internal" />
      <SubjectCard name="Physics"   value={s.physics}   onChange={v => setS(p => ({ ...p, physics: v }))} />
      <SubjectCard name="Chemistry" value={s.chemistry} onChange={v => setS(p => ({ ...p, chemistry: v }))} />
      <SubjectCard name="Mathematics" value={s.math}    onChange={v => setS(p => ({ ...p, math: v }))} theoryLabel="Theory" practicalLabel="Internal" />

      {/* Optional subject */}
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800">Optional Subject</span>
          <div className="flex gap-2">
            {(["biology", "computer"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setS(p => ({ ...p, optional: opt, optionalGrade: EMPTY }))}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  s.optional === opt ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt === "biology" ? "Biology" : "Computer Science"}
              </button>
            ))}
          </div>
        </div>
        {s.optional === "computer" && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 mb-3">
            Computer Science (NEB Science): Theory <strong>50 marks</strong> + Practical <strong>50 marks</strong> · GPA = (Theory GP × 50 + Practical GP × 50) ÷ 100
          </div>
        )}
        {s.optional === "computer" ? (
          <div className="flex gap-3">
            <GradeSelect label="Theory" sublabel="50 marks" grades={CS50_GRADES}
              value={s.optionalGrade.theory} onChange={t => setS(p => ({ ...p, optionalGrade: { ...p.optionalGrade, theory: t } }))} />
            <GradeSelect label="Practical" sublabel="50 marks" grades={CS50_GRADES}
              value={s.optionalGrade.practical} onChange={pr => setS(p => ({ ...p, optionalGrade: { ...p.optionalGrade, practical: pr } }))} />
          </div>
        ) : (
          <div className="flex gap-3">
            <GradeSelect label="Theory" sublabel="75 marks" grades={THEORY_GRADES}
              value={s.optionalGrade.theory} onChange={t => setS(p => ({ ...p, optionalGrade: { ...p.optionalGrade, theory: t } }))} />
            <GradeSelect label="Practical" sublabel="25 marks" grades={PRACTICAL_GRADES}
              value={s.optionalGrade.practical} onChange={pr => setS(p => ({ ...p, optionalGrade: { ...p.optionalGrade, practical: pr } }))} />
          </div>
        )}
      </div>

      <ResultPanel result={result} subjectResults={subjectResults} />
    </div>
  );
}

// ── MANAGEMENT STREAM ──────────────────────────────────────────────────────────
type MgmtOptional = { subject: string; grade: GradeInput };
type MgmtState = {
  english: GradeInput; nepali: GradeInput;
  mathSocialChoice: "math" | "social"; mathSocial: GradeInput;
  optionals: [MgmtOptional, MgmtOptional, MgmtOptional];
};
const initMgmt = (): MgmtState => ({
  english: EMPTY, nepali: EMPTY,
  mathSocialChoice: "math", mathSocial: EMPTY,
  optionals: [
    { subject: "", grade: EMPTY },
    { subject: "", grade: EMPTY },
    { subject: "", grade: EMPTY },
  ],
});

function ManagementCalculator() {
  const [s, setS] = useState<MgmtState>(initMgmt);

  function updateOptional(idx: number, patch: Partial<MgmtOptional>) {
    setS(prev => {
      const next = [...prev.optionals] as MgmtState["optionals"];
      next[idx] = { ...next[idx], ...patch };
      if (patch.subject !== undefined) next[idx].grade = EMPTY;
      return { ...prev, optionals: next };
    });
  }

  const usedSubjects = s.optionals.map(o => o.subject).filter(Boolean);

  const subjectResults = useMemo(() => {
    const rows = [
      { name: "English", gpa: subjectGpa(s.english) },
      { name: "Nepali",  gpa: subjectGpa(s.nepali)  },
      { name: s.mathSocialChoice === "math" ? "Mathematics" : "Social Studies & Life Skills", gpa: subjectGpa(s.mathSocial) },
      ...s.optionals.map(o => ({
        name: MANAGEMENT_OPTIONALS.find(m => m.value === o.subject)?.label ?? (o.subject ? o.subject : ""),
        gpa:  o.subject ? subjectGpa(o.grade) : null,
      })).filter(r => r.name),
    ];
    return rows;
  }, [s]);

  const result = useMemo(() => {
    const filled = subjectResults.filter(r => r.gpa !== null);
    if (filled.length === 0) return null;
    return { gpa: filled.reduce((a, r) => a + r.gpa!, 0) / filled.length, filled: filled.length, total: 6 };
  }, [subjectResults]);

  return (
    <div className="space-y-3">
      <SubjectCard name="English" value={s.english} onChange={v => setS(p => ({ ...p, english: v }))} />
      <SubjectCard name="Nepali"  value={s.nepali}  onChange={v => setS(p => ({ ...p, nepali: v }))} theoryLabel="Theory" practicalLabel="Internal" />

      {/* Math or Social Studies */}
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800">
            {s.mathSocialChoice === "math" ? "Mathematics" : "Social Studies & Life Skills"}
          </span>
          <div className="flex gap-2">
            {(["math", "social"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setS(p => ({ ...p, mathSocialChoice: opt, mathSocial: EMPTY }))}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  s.mathSocialChoice === opt ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt === "math" ? "Mathematics" : "Social Studies"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <GradeSelect label="Theory" sublabel="75 marks" grades={THEORY_GRADES}
            value={s.mathSocial.theory} onChange={t => setS(p => ({ ...p, mathSocial: { ...p.mathSocial, theory: t } }))} />
          <GradeSelect label="Internal" sublabel="25 marks" grades={PRACTICAL_GRADES}
            value={s.mathSocial.practical} onChange={pr => setS(p => ({ ...p, mathSocial: { ...p.mathSocial, practical: pr } }))} />
        </div>
      </div>

      {/* Optional subjects × 3 */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">Optional Subjects</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Choose 3</span>
        </div>
        {([0, 1, 2] as const).map(idx => {
          const opt = s.optionals[idx];
          const available = MANAGEMENT_OPTIONALS.filter(
            m => !usedSubjects.includes(m.value) || m.value === opt.subject
          );
          const gpa = opt.subject ? subjectGpa(opt.grade) : null;
          const badge = gpa !== null ? gpaBadge(gpa) : null;
          return (
            <div key={idx} className={`rounded-xl p-3 border transition-all ${badge ? badge.bg : "bg-gray-50 border-gray-100"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Optional {idx + 1}</span>
                {badge && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge.color} ${badge.bg}`}>{badge.letter} · {gpa!.toFixed(2)}</span>}
              </div>
              <div className="relative mb-2">
                <select
                  value={opt.subject}
                  onChange={e => updateOptional(idx, { subject: e.target.value })}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select subject...</option>
                  {available.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              {opt.subject && (
                <div className="flex gap-3">
                  <GradeSelect label="Theory" sublabel="75 marks" grades={THEORY_GRADES}
                    value={opt.grade.theory} onChange={t => updateOptional(idx, { grade: { ...opt.grade, theory: t } })} />
                  <GradeSelect label="Practical/Internal" sublabel="25 marks" grades={PRACTICAL_GRADES}
                    value={opt.grade.practical} onChange={pr => updateOptional(idx, { grade: { ...opt.grade, practical: pr } })} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ResultPanel result={result} subjectResults={subjectResults} />
    </div>
  );
}

// ── Result panel (shared) ──────────────────────────────────────────────────────
function ResultPanel({
  result, subjectResults,
}: {
  result: { gpa: number; filled: number; total: number } | null;
  subjectResults: { name: string; gpa: number | null }[];
}) {
  if (!result) {
    return (
      <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
        <Calculator className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Fill in grades to see your GPA instantly.</p>
      </div>
    );
  }
  const badge = gpaBadge(result.gpa);
  const performance =
    result.gpa >= 3.6 ? "Outstanding! You are in the top tier of NEB students. 🎉" :
    result.gpa >= 3.2 ? "Excellent work! A little more push and you'll reach A+." :
    result.gpa >= 2.8 ? "Very Good! Focus on weaker subjects to hit B+ or above." :
    result.gpa >= 2.4 ? "Good performance. Consistent effort will take you higher." :
    result.gpa >= 2.0 ? "Satisfactory. Set higher goals and study more systematically." :
    result.gpa >= 1.6 ? "Acceptable, but you need to improve significantly." :
                        "Below standard. Seek help and revise thoroughly.";

  return (
    <div className={`rounded-2xl border p-5 ${badge.bg}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Your GPA ({result.filled}/{result.total} subjects entered)
        </span>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border bg-white ${badge.color}`}>
          Grade {badge.letter} — {badge.label}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-1">
        <span className={`text-6xl font-black leading-none ${badge.color}`}>{result.gpa.toFixed(2)}</span>
        <span className="text-lg text-gray-400 mb-1">/ 4.00</span>
      </div>
      <p className={`text-sm font-medium mt-2 ${badge.color}`}>{performance}</p>

      {/* Subject-wise breakdown */}
      {subjectResults.some(r => r.gpa !== null) && (
        <div className="mt-4 pt-4 border-t border-white/60 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Subject Breakdown</p>
          {subjectResults.filter(r => r.name && r.gpa !== null).map(r => {
            const b = gpaBadge(r.gpa!);
            const pct = (r.gpa! / 4.0) * 100;
            return (
              <div key={r.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{r.name}</span>
                  <span className={`font-bold ${b.color}`}>{b.letter} · {r.gpa!.toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.gpa! >= 3.2 ? "bg-green-400" : r.gpa! >= 2.4 ? "bg-blue-400" : "bg-orange-400"}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FAQ & SEO schema ───────────────────────────────────────────────────────────
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "How is NEB Class 12 GPA calculated in Nepal?", acceptedAnswer: { "@type": "Answer", text: "NEB Class 12 GPA is calculated by averaging the grade points of all subjects. Each subject has two components: Theory (75 marks) and Practical/Internal (25 marks). Subject GPA = (Theory GPA × 75 + Practical GPA × 25) ÷ 100. Final GPA = sum of all subject GPAs ÷ number of subjects (6). This NEB GPA calculator applies the official formula automatically." } },
    { "@type": "Question", name: "What subjects does NEB Science stream have in 2082/2083?", acceptedAnswer: { "@type": "Answer", text: "NEB Class 12 Science compulsory subjects are: English, Nepali, Physics, Chemistry, and Mathematics. Students must choose one optional subject: Biology or Computer Science. All subjects carry 100 marks — 75 for Theory and 25 for Practical. This structure applies for NEB exams 2082 and 2083 BS." } },
    { "@type": "Question", name: "What subjects does NEB Management stream have in 2082/2083?", acceptedAnswer: { "@type": "Answer", text: "NEB Class 12 Management compulsory subjects are: English, Nepali, and either Mathematics or Social Studies & Life Skills. Students then choose 3 optional subjects from: Accountancy, Economics, Business Studies, Computer Science, Tourism & Mountaineering, Business Mathematics, or Hotel Management." } },
    { "@type": "Question", name: "What is the NEB grading system 2082 2083?", acceptedAnswer: { "@type": "Answer", text: "The NEB grading system: A+ (4.0, 90–100%), A (3.6, 80–89%), B+ (3.2, 70–79%), B (2.8, 60–69%), C+ (2.4, 50–59%), C (2.0, 40–49%), D (1.6, 35–39%), NG (0, below 35%). Minimum pass is grade D. This grading scale is unchanged for NEB 2082 and 2083." } },
    { "@type": "Question", name: "What GPA is needed for MBBS in Nepal 2082?", acceptedAnswer: { "@type": "Answer", text: "For MBBS in Nepal (government colleges), you typically need a minimum GPA of 3.2 (B+) in NEB Class 12 Science with Biology. Government scholarships and top private medical colleges usually require 3.6 (A) or above in Biology, Chemistry, and Physics. CEE (Common Entrance Examination) scores also matter alongside GPA." } },
    { "@type": "Question", name: "What GPA is needed for IOE (Engineering) entrance in Nepal?", acceptedAnswer: { "@type": "Answer", text: "For IOE entrance examination (Tribhuvan University Engineering), the minimum eligibility is usually a GPA of 2.4 (B) or above in NEB Class 12 Science with Physics and Mathematics. However, to be competitive for popular programs like Computer Engineering or Civil Engineering, students typically need a GPA of 3.2 (A) or higher along with a strong IOE entrance score." } },
    { "@type": "Question", name: "What GPA is required for government scholarship in Nepal 2082?", acceptedAnswer: { "@type": "Answer", text: "For Nepal government scholarships (Prime Minister Scholarship, NEB Merit Scholarship), a GPA of 3.6 (A) or above is typically required. The Gandaki Province and Bagmati Province scholarship programs have similar cutoffs. Merit-based scholarships at top colleges like St. Xavier's, Budhanilkantha, or KMC require 3.6–4.0 GPA." } },
    { "@type": "Question", name: "Is the practical/internal grade important for NEB GPA?", acceptedAnswer: { "@type": "Answer", text: "Yes, critically. Practical/Internal marks are 25% of total (25 out of 100 marks). A student with theory B+ (3.2) and practical A+ (4.0) gets subject GPA = (3.2×75 + 4.0×25)/100 = 3.4. Scoring well in practicals is often easier and can lift your overall GPA significantly. Never neglect practicals and internals." } },
    { "@type": "Question", name: "What is the NEB Grade Improvement Exam?", acceptedAnswer: { "@type": "Answer", text: "NEB offers a Grade Improvement Exam for Class 12 students who want to improve their grades in specific subjects. Students can appear in up to all subjects to improve their GPA. The improved grades replace the previous ones on the marksheet. It is available within a year of the original result. This is useful for students who missed MBBS, Engineering, or scholarship cutoffs by a small margin." } },
    { "@type": "Question", name: "How do I convert NEB percentage to GPA?", acceptedAnswer: { "@type": "Answer", text: "NEB uses a direct grade-band system, not a percentage-to-GPA conversion. Your percentage in each subject determines the grade band: 90%+ → A+ (4.0), 80–89% → A (3.6), 70–79% → B+ (3.2), 60–69% → B (2.8), 50–59% → C+ (2.4), 40–49% → C (2.0), 35–39% → D (1.6), below 35% → NG (0). Final GPA = average of all subject GPAs." } },
  ],
};

const HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Calculate NEB Class 12 GPA Nepal 2082",
  description: "Free step-by-step guide to calculate your NEB Grade 12 GPA using the official NEB grading formula for Science and Management streams.",
  step: [
    { "@type": "HowToStep", name: "Select Your Stream", text: "Choose Science or Management faculty based on your NEB Class 12 enrollment." },
    { "@type": "HowToStep", name: "Enter Theory Grades", text: "For each subject, select the letter grade you received in the Theory paper (75 marks) — A+, A, B+, B, C+, C, D, or NG." },
    { "@type": "HowToStep", name: "Enter Practical/Internal Grades", text: "Select the grade from your Practical exam or Internal assessment (25 marks) for each subject." },
    { "@type": "HowToStep", name: "Read Your Instant GPA", text: "Your NEB GPA appears instantly with subject-wise breakdown and performance label. No button needed." },
  ],
};

const WEBAPP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "NEB GPA Calculator Nepal 2082 2083 — Class 12 Science & Management",
  applicationCategory: "EducationApplication",
  operatingSystem: "Web Browser",
  url: "https://studenthubnp.com/tools/gpa-calculator",
  description: "Free NEB GPA Calculator for Class 12 Nepal 2082 and 2083. Calculate your GPA using the official NEB grading formula — weighted 75% Theory + 25% Practical — for Science and Management streams instantly.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "NEB Class 12 Science GPA calculator (Physics, Chemistry, Maths, Biology/Computer)",
    "NEB Class 12 Management GPA calculator (Accountancy, Economics, Business Studies)",
    "Official NEB formula: 75% Theory + 25% Practical per subject",
    "Subject-wise GPA breakdown with grade labels",
    "Free, instant, no sign-up required",
  ],
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://studenthubnp.com" },
    { "@type": "ListItem", position: 2, name: "Tools", item: "https://studenthubnp.com/tools" },
    { "@type": "ListItem", position: 3, name: "NEB GPA Calculator", item: "https://studenthubnp.com/tools/gpa-calculator" },
  ],
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function GpaCalculator() {
  const [stream, setStream] = useState<"science" | "management">("science");

  return (
    <>
      <Helmet>
        <title>NEB GPA Calculator Nepal 2082/2083 — Class 12 Science &amp; Management (Official Formula) | Student Hub</title>
        <meta name="description" content="Free NEB GPA Calculator for Class 12 Nepal 2082 and 2083. Accurate theory + practical grade calculation using official NEB formula for Science (Physics, Chemistry, Biology/Computer) and Management (Accountancy, Economics, Business Studies) streams. Instant results — no sign-up." />
        <meta name="keywords" content="NEB GPA calculator, NEB GPA calculator Nepal, class 12 GPA calculator Nepal, NEB grading system 2082, NEB GPA calculator 2082, NEB GPA 2083, NEB class 12 result calculator, NEB grading system Nepal, grade 12 nepal GPA, NEB GPA calculation formula, NEB science GPA calculator, NEB management GPA calculator, कक्षा १२ GPA calculator, NEB result calculator 2082, NEB grade point scale, NEB class 12 grading 2082, NEB GPA calculator online free Nepal, class 12 result GPA nepal, NEB 2082 result calculator, NEB grade calculator Nepal 2082 2083" />
        <meta name="author" content="Student Hub Nepal" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="geo.region" content="NP" />
        <meta name="geo.placename" content="Nepal" />

        <meta property="og:title" content="NEB GPA Calculator Nepal 2082/2083 — Class 12 Science &amp; Management | Student Hub" />
        <meta property="og:description" content="Free NEB GPA Calculator for Class 12 Nepal. Official formula: 75% Theory + 25% Practical. Science and Management streams. Instant subject-wise breakdown. Works for 2082 and 2083 exams." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://studenthubnp.com/tools/gpa-calculator" />
        <meta property="og:image" content="https://studenthubnp.com/opengraph.jpg" />
        <meta property="og:image:alt" content="NEB GPA Calculator Nepal 2082 — Class 12 Science and Management" />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <meta property="og:locale" content="en_NP" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NEB GPA Calculator Nepal 2082/2083 — Class 12 | Student Hub" />
        <meta name="twitter:description" content="Free NEB Class 12 GPA calculator. Official formula — 75% Theory + 25% Practical. Science and Management streams. Instant results." />
        <meta name="twitter:image" content="https://studenthubnp.com/opengraph.jpg" />

        <link rel="canonical" href="https://studenthubnp.com/tools/gpa-calculator" />
        <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(HOWTO_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(WEBAPP_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(BREADCRUMB_SCHEMA)}</script>
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <Link href="/tools" className="hover:text-blue-600 transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-gray-600">NEB GPA Calculator</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Calculator className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Nepal · NEB Class 12 · 2082</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">NEB GPA Calculator</h1>
          <p className="text-gray-500 mt-1.5 text-sm leading-relaxed">
            Enter your Theory and Practical grades for each subject. GPA is calculated using the official NEB grading formula — weighted 75% Theory + 25% Practical per subject.
          </p>
        </div>

        {/* How it works notice */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 text-xs text-blue-700">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Subject GPA = (Theory grade × 75 + Practical grade × 25) ÷ 100 &nbsp;|&nbsp; Final GPA = average of all subjects</span>
        </div>

        {/* Stream selector */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-1.5 flex gap-1 mb-5">
          {(["science", "management"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStream(s)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                stream === s ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {s === "science" ? "⚗️ Science" : "📊 Management"}
            </button>
          ))}
        </div>

        {/* Calculator */}
        {stream === "science" ? <ScienceCalculator /> : <ManagementCalculator />}

        {/* Grade reference */}
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" /> NEB Grade Point Reference Scale
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-semibold">Grade</th>
                  <th className="text-left pb-2 font-semibold">% Range</th>
                  <th className="text-left pb-2 font-semibold">Theory (75)</th>
                  <th className="text-left pb-2 font-semibold">Practical (25)</th>
                  <th className="text-left pb-2 font-semibold">GPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { g: "A+", p: "90–100%", t: "67.5–75",   pr: "22.5–25",  gp: "4.0", c: "text-emerald-600" },
                  { g: "A",  p: "80–89%",  t: "60–67.5",   pr: "20–22.5",  gp: "3.6", c: "text-green-600"   },
                  { g: "B+", p: "70–79%",  t: "52.5–60",   pr: "17.5–20",  gp: "3.2", c: "text-blue-600"    },
                  { g: "B",  p: "60–69%",  t: "45–52.5",   pr: "15–17.5",  gp: "2.8", c: "text-indigo-600"  },
                  { g: "C+", p: "50–59%",  t: "37.5–45",   pr: "12.5–15",  gp: "2.4", c: "text-yellow-600"  },
                  { g: "C",  p: "40–49%",  t: "30–37.5",   pr: "10–12.5",  gp: "2.0", c: "text-orange-600"  },
                  { g: "D",  p: "35–39%",  t: "26.25–30",  pr: "8.75–10",  gp: "1.6", c: "text-red-500"     },
                  { g: "NG", p: "< 35%",   t: "< 26.25",   pr: "< 8.75",   gp: "0.0", c: "text-gray-400"    },
                ].map(row => (
                  <tr key={row.g}>
                    <td className={`py-2 font-bold ${row.c}`}>{row.g}</td>
                    <td className="py-2 text-gray-600">{row.p}</td>
                    <td className="py-2 text-gray-500">{row.t}</td>
                    <td className="py-2 text-gray-500">{row.pr}</td>
                    <td className={`py-2 font-bold ${row.c}`}>{row.gp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SEO content */}
        <article className="mt-8 space-y-5 text-gray-600 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-gray-900">NEB GPA Calculator Nepal 2082/2083 — Complete Guide</h2>
          <p>
            This free <strong>NEB GPA Calculator</strong> is built specifically for <strong>Class 12 students in Nepal</strong> following the <strong>National Examinations Board (NEB)</strong> curriculum for 2082 and 2083 BS. It calculates your GPA using the <strong>official NEB weighted formula</strong> — 75% Theory + 25% Practical per subject — for both <strong>Science</strong> and <strong>Management</strong> streams. No manual calculation, no spreadsheet — just instant, accurate results.
          </p>

          <h3 className="text-lg font-bold text-gray-900">NEB Science Stream — Subjects and GPA Calculation (2082/2083)</h3>
          <p>
            NEB Class 12 Science stream compulsory subjects: <strong>English, Nepali, Physics, Chemistry,</strong> and <strong>Mathematics</strong>. One optional subject: <strong>Biology</strong> or <strong>Computer Science</strong>.
          </p>
          <p>
            Every subject carries 100 marks — <strong>75 Theory + 25 Practical</strong>. Subject GPA formula:
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-mono text-xs text-gray-700">
            Subject GPA = (Theory Grade Points × 75 + Practical Grade Points × 25) ÷ 100
          </div>
          <p>
            <strong>Example:</strong> A (3.6) in Physics Theory + A+ (4.0) in Physics Practical → (3.6 × 75 + 4.0 × 25) ÷ 100 = <strong>3.70 GPA</strong>.
          </p>

          <h3 className="text-lg font-bold text-gray-900">NEB Management Stream — Subjects (2082/2083)</h3>
          <p>
            NEB Class 12 Management compulsory subjects: <strong>English, Nepali,</strong> and either <strong>Mathematics</strong> or <strong>Social Studies &amp; Life Skills</strong>. Students choose <strong>3 optional subjects</strong> from: Accountancy, Economics, Business Studies, Computer Science, Tourism &amp; Mountaineering, Business Mathematics, or Hotel Management.
          </p>
          <p>
            All subjects follow 75 Theory + 25 Internal/Practical structure. Strong Internal scores can significantly boost your overall GPA.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How is the Final NEB GPA Calculated?</h3>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-mono text-xs text-gray-700">
            Final GPA = Sum of all 6 Subject GPAs ÷ 6
          </div>
          <p>
            <strong>Example (Science):</strong> English 3.7, Nepali 3.5, Physics 3.2, Chemistry 3.0, Maths 3.4, Biology 3.6 → Total 20.4 → <strong>Final GPA = 3.40</strong> (Grade A, Excellent).
          </p>

          <h3 className="text-lg font-bold text-gray-900">NEB GPA Requirements for Top Courses in Nepal 2082</h3>
          <p>
            Your NEB GPA directly determines which courses and scholarships you qualify for after Class 12:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr className="text-gray-500">
                  <th className="text-left px-3 py-2 font-semibold">Course / Program</th>
                  <th className="text-left px-3 py-2 font-semibold">Minimum GPA</th>
                  <th className="text-left px-3 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ["MBBS (Government colleges)", "3.2 (B+) in PCB", "CEE entrance score also required"],
                  ["MBBS (Top private / scholarship)", "3.6 (A) or above", "KU, PAHS, BPKIHS scholarships"],
                  ["IOE Engineering (TU)", "2.4 (B) eligibility", "IOE entrance score is key; 3.2+ competitive"],
                  ["BIT / BCA / B.Sc. CSIT", "2.0 (C+) minimum", "Entrance exams may apply at some colleges"],
                  ["BBS / BBA / BHM", "2.0 (C+) minimum", "Most management colleges"],
                  ["Government Merit Scholarship", "3.6 (A+) preferred", "PM Scholarship, NEB Scholarship"],
                  ["Foreign University (India, Australia)", "3.2 (A) or above", "Varies by institution and country"],
                  ["Grade Improvement Exam eligibility", "All grades", "Can retake to improve any subject GPA"],
                ].map(([course, gpa, notes]) => (
                  <tr key={course} className="text-xs">
                    <td className="px-3 py-2 text-gray-700 font-medium">{course}</td>
                    <td className="px-3 py-2 font-bold text-blue-600">{gpa}</td>
                    <td className="px-3 py-2 text-gray-500">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold text-gray-900">What Does Your NEB GPA Mean?</h3>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>3.6–4.0 (A+, Outstanding):</strong> Top scholarships, MBBS, Engineering — best colleges in Nepal and abroad.</li>
            <li><strong>3.2–3.59 (A, Excellent):</strong> Government scholarships, medical and engineering colleges.</li>
            <li><strong>2.8–3.19 (B+, Very Good):</strong> BBS, BBA, BCA, most bachelor's programs.</li>
            <li><strong>2.4–2.79 (B, Good):</strong> Qualifies for most colleges. Limited scholarship options.</li>
            <li><strong>2.0–2.39 (C+, Satisfactory):</strong> Passes NEB. General bachelor's programs open.</li>
            <li><strong>1.6–1.99 (C, Acceptable):</strong> Marginal pass. Retake weak subjects via Grade Improvement Exam.</li>
            <li><strong>Below 1.6 (D or NG):</strong> Failed or insufficient. NEB Grade Improvement Exam available within 1 year.</li>
          </ul>

          <h3 className="text-lg font-bold text-gray-900">NEB Grade Improvement Exam 2082/2083</h3>
          <p>
            NEB offers a <strong>Grade Improvement Examination</strong> for Class 12 students who want to improve their GPA in one or more subjects. The improved grade replaces the original on your marksheet. It is typically held within a year of the original result. This is especially useful for students who narrowly missed the MBBS, IOE entrance GPA cutoff, or a scholarship threshold. Use this calculator to estimate what grade you need in which subject to reach your target GPA.
          </p>

          <h3 className="text-lg font-bold text-gray-900">Tips to Improve Your NEB GPA</h3>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>Practicals are easy marks</strong> — getting A+ in Practical (22.5/25) when you scored B+ in Theory can push your subject GPA from 3.2 to 3.4.</li>
            <li>Practise from <Link href="/pyqs" className="text-blue-600 hover:underline">previous year NEB question papers (PYQs)</Link> — understanding the exam pattern directly improves theory marks.</li>
            <li>Use <Link href="/notes" className="text-blue-600 hover:underline">subject-wise chapter notes</Link> for targeted revision rather than reading full textbooks.</li>
            <li>Ask <Link href="/ai" className="text-blue-600 hover:underline">Nep AI</Link> to explain NEB syllabus concepts in simple Nepali or English.</li>
            <li>Track daily study with the <Link href="/pomodoro" className="text-blue-600 hover:underline">Pomodoro Timer</Link> — 4 focused 25-minute sessions beats marathon cramming.</li>
            <li>Keep your attendance above 75% — use the <Link href="/tools/attendance-calculator" className="text-blue-600 hover:underline">Attendance Calculator</Link> to track how many classes you can safely miss.</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 pt-2">Frequently Asked Questions — NEB GPA Calculator Nepal</h2>
          {FAQ_SCHEMA.mainEntity.map((faq, i) => (
            <details key={i} className="border border-gray-100 rounded-xl p-4 group">
              <summary className="font-semibold text-gray-900 cursor-pointer text-sm list-none flex items-center justify-between">
                {faq.name}
                <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg leading-none select-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.acceptedAnswer.text}</p>
            </details>
          ))}
        </article>
      </div>
    </>
  );
}
