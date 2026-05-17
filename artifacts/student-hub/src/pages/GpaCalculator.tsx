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

// ── NEB subject types ──────────────────────────────────────────────────────────
// Each subject carries 100 marks: Theory (75) + Practical/Internal (25)
// Subject GPA = (theory_gp × 75 + practical_gp × 25) / 100

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
    { name: s.optional === "biology" ? "Biology" : "Computer Science", gpa: subjectGpa(s.optionalGrade) },
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
        <div className="flex gap-3">
          <GradeSelect label="Theory" sublabel="75 marks" grades={THEORY_GRADES}
            value={s.optionalGrade.theory} onChange={t => setS(p => ({ ...p, optionalGrade: { ...p.optionalGrade, theory: t } }))} />
          <GradeSelect label="Practical" sublabel="25 marks" grades={PRACTICAL_GRADES}
            value={s.optionalGrade.practical} onChange={pr => setS(p => ({ ...p, optionalGrade: { ...p.optionalGrade, practical: pr } }))} />
        </div>
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
    { "@type": "Question", name: "How is NEB Class 12 GPA calculated?", acceptedAnswer: { "@type": "Answer", text: "NEB Class 12 GPA is calculated by averaging the grade points of all subjects. Each subject has two components: Theory (75 marks) and Practical/Internal (25 marks). The subject GPA = (Theory GPA × 75 + Practical GPA × 25) ÷ 100. Your final GPA = average of all subject GPAs." } },
    { "@type": "Question", name: "What subjects does NEB Science stream have?", acceptedAnswer: { "@type": "Answer", text: "NEB Class 12 Science compulsory subjects are: English, Nepali, Physics, Chemistry, and Mathematics. Students must choose one optional subject: Biology or Computer Science. All subjects carry 100 marks — 75 for Theory and 25 for Practical." } },
    { "@type": "Question", name: "What subjects does NEB Management stream have?", acceptedAnswer: { "@type": "Answer", text: "NEB Class 12 Management compulsory subjects are: English, Nepali, and either Mathematics or Social Studies & Life Skills (student's choice). Students then choose 3 optional subjects from: Accountancy, Economics, Business Studies, Computer Science, Tourism & Mountaineering, Business Mathematics, or Hotel Management." } },
    { "@type": "Question", name: "What is the NEB grading system 2082?", acceptedAnswer: { "@type": "Answer", text: "The NEB grading system uses letter grades: A+ (4.0 GPA, 90–100%), A (3.6, 80–89%), B+ (3.2, 70–79%), B (2.8, 60–69%), C+ (2.4, 50–59%), C (2.0, 40–49%), D (1.6, 35–39%), NG (0, below 35%). The minimum pass grade is D in all subjects." } },
    { "@type": "Question", name: "What GPA is needed for MBBS in Nepal?", acceptedAnswer: { "@type": "Answer", text: "For MBBS in Nepal, you typically need a minimum GPA of 3.2 (B+) in NEB Class 12 Science, with strong grades in Physics, Chemistry, and Biology. Top government medical colleges and scholarships require 3.6 (A) or above." } },
    { "@type": "Question", name: "Is the practical/internal grade important for NEB GPA?", acceptedAnswer: { "@type": "Answer", text: "Yes. Practical/Internal marks contribute 25% of the total subject marks (25 out of 100). Scoring high in practicals can meaningfully improve your subject GPA. For example, a student with theory grade B+ (3.2) and practical grade A+ (4.0) gets a subject GPA of (3.2×75 + 4.0×25)/100 = 3.4 — between B+ and A." } },
  ],
};

const HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Calculate NEB Class 12 GPA",
  description: "Step-by-step guide to calculate your NEB Grade 12 GPA using the official grading system.",
  step: [
    { "@type": "HowToStep", name: "Select Your Stream", text: "Choose Science or Management faculty based on your NEB enrollment." },
    { "@type": "HowToStep", name: "Enter Theory Grades", text: "Select the letter grade you received in the Theory paper (75 marks) for each subject." },
    { "@type": "HowToStep", name: "Enter Practical/Internal Grades", text: "Select the grade from your Practical exam or Internal assessment (25 marks) for each subject." },
    { "@type": "HowToStep", name: "Read Your GPA", text: "Your GPA appears instantly along with a subject-wise breakdown. No button to press." },
  ],
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function GpaCalculator() {
  const [stream, setStream] = useState<"science" | "management">("science");

  return (
    <>
      <Helmet>
        <title>NEB GPA Calculator Nepal 2082 — Class 12 Science &amp; Management | Student Hub</title>
        <meta name="description" content="Free NEB GPA Calculator for Class 12 Nepal 2082. Accurate theory + practical grade calculation for Science (Physics, Chemistry, Biology, Computer) and Management (Accountancy, Economics, Business Studies) streams." />
        <meta name="keywords" content="NEB GPA calculator, Class 12 GPA calculator Nepal, NEB grading system 2082, NEB GPA calculator science management, SEE GPA Nepal" />
        <meta property="og:title" content="NEB GPA Calculator Nepal 2082 — Class 12 | Student Hub" />
        <meta property="og:description" content="Accurate NEB Class 12 GPA calculator with theory + practical split. Science and Management streams. Official NEB grading system 2082." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="NEB GPA Calculator Nepal 2082 | Student Hub" />
        <meta name="twitter:description" content="Calculate your NEB Class 12 GPA instantly — Science and Management streams with theory + practical breakdown." />
        <link rel="canonical" href="https://studenthubnp.com/tools/gpa-calculator" />
        <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(HOWTO_SCHEMA)}</script>
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
          <h2 className="text-xl font-bold text-gray-900">NEB GPA Calculator Nepal 2082 — Complete Guide</h2>
          <p>
            This <strong>NEB GPA Calculator</strong> is built specifically for Class 12 students in Nepal following the <strong>National Examinations Board (NEB)</strong> curriculum. It accurately computes your GPA using the official weighted formula — 75% Theory + 25% Practical per subject — for both <strong>Science</strong> and <strong>Management</strong> streams.
          </p>

          <h3 className="text-lg font-bold text-gray-900">NEB Science Stream — Subjects and GPA Calculation</h3>
          <p>
            The NEB Class 12 Science stream has five compulsory subjects: <strong>English, Nepali, Physics, Chemistry,</strong> and <strong>Mathematics</strong>. Students must additionally choose one optional subject — <strong>Biology</strong> or <strong>Computer Science</strong>.
          </p>
          <p>
            Every subject carries a total of 100 marks: <strong>75 for Theory</strong> and <strong>25 for Practical</strong>. To calculate your GPA for any subject, the formula is:
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-mono text-xs text-gray-700">
            Subject GPA = (Theory Grade Points × 75 + Practical Grade Points × 25) ÷ 100
          </div>
          <p>
            For example, a student scoring <strong>A (3.6)</strong> in Physics theory and <strong>A+ (4.0)</strong> in Physics practical gets: (3.6 × 75 + 4.0 × 25) ÷ 100 = <strong>3.7 GPA</strong> — which rounds to an A+ overall.
          </p>

          <h3 className="text-lg font-bold text-gray-900">NEB Management Stream — Subjects and Optional Selection</h3>
          <p>
            The NEB Class 12 Management stream has three compulsory subjects: <strong>English, Nepali,</strong> and either <strong>Mathematics</strong> or <strong>Social Studies &amp; Life Skills</strong> (the student's choice based on their school's offering). Students then select <strong>3 optional subjects</strong> from: Accountancy, Economics, Business Studies, Computer Science, Tourism &amp; Mountaineering, Business Mathematics, or Hotel Management.
          </p>
          <p>
            Each subject still follows the 75 Theory + 25 Internal/Practical structure. This means a student who scores well in their Internal assessments can meaningfully boost their overall GPA even if their Theory performance was slightly lower.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How is the Final NEB GPA Calculated?</h3>
          <p>
            Your final NEB GPA is the simple average of all six subject GPAs:
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 font-mono text-xs text-gray-700">
            Final GPA = Sum of all subject GPAs ÷ Number of subjects (6)
          </div>
          <p>
            <strong>Example (Science):</strong> English 3.7, Nepali 3.5, Physics 3.2, Chemistry 3.0, Mathematics 3.4, Biology 3.6 → Total = 20.4 → <strong>Final GPA = 3.40</strong> (Grade A, Excellent).
          </p>

          <h3 className="text-lg font-bold text-gray-900">What Does Your NEB GPA Mean?</h3>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>3.6–4.0 (A+, Outstanding):</strong> Eligible for top scholarships, MBBS, engineering — best colleges in Nepal and abroad.</li>
            <li><strong>3.2–3.59 (A, Excellent):</strong> Eligible for most government scholarships and competitive courses.</li>
            <li><strong>2.8–3.19 (B+, Very Good):</strong> Good for BBS, BBA, and most bachelor's programmes.</li>
            <li><strong>2.4–2.79 (B, Good):</strong> Qualifies for most colleges. Limited scholarship options.</li>
            <li><strong>2.0–2.39 (C+, Satisfactory):</strong> Passes NEB. Most general bachelor's programmes still open.</li>
            <li><strong>1.6–1.99 (C, Acceptable):</strong> Marginal pass. Important to retake weak subjects.</li>
            <li><strong>Below 1.6 (D or NG):</strong> Failed or insufficient. NEB Grade Improvement Exam available.</li>
          </ul>

          <h3 className="text-lg font-bold text-gray-900">Tips to Improve Your NEB GPA</h3>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Practicals count — getting an A+ in practical (easy to score) can lift a B+ theory to an A overall.</li>
            <li>Practice from <Link href="/pyqs" className="text-blue-600 hover:underline">previous year NEB question papers (PYQs)</Link> — pattern familiarity directly improves theory marks.</li>
            <li>Use <Link href="/notes" className="text-blue-600 hover:underline">subject-wise study notes</Link> for chapter-level revision instead of reading full textbooks repeatedly.</li>
            <li>Ask <Link href="/ai" className="text-blue-600 hover:underline">Nep AI</Link> to explain NEB-syllabus concepts in simple Nepali or English.</li>
            <li>Track your daily study sessions with the <Link href="/pomodoro" className="text-blue-600 hover:underline">Pomodoro Timer</Link> — 4 focused 25-minute sessions daily is more effective than marathon studying.</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 pt-2">Frequently Asked Questions</h2>
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
