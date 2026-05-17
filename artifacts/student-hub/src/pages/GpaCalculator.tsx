import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Calculator, ChevronDown, BookOpen } from "lucide-react";

const GRADES = [
  { label: "A+ (90–100)", value: "A+", points: 4.0 },
  { label: "A  (80–89)",  value: "A",  points: 3.6 },
  { label: "B+ (70–79)", value: "B+", points: 3.2 },
  { label: "B  (60–69)",  value: "B",  points: 2.8 },
  { label: "C+ (50–59)", value: "C+", points: 2.4 },
  { label: "C  (40–49)",  value: "C",  points: 2.0 },
  { label: "D+ (35–39)", value: "D+", points: 1.6 },
  { label: "D  (20–34)",  value: "D",  points: 1.2 },
  { label: "NG (Below 20)", value: "NG", points: 0.0 },
];

const FACULTIES: Record<string, string[]> = {
  Science: ["English", "Nepali", "Physics", "Chemistry", "Mathematics", "Biology / Computer Science"],
  Management: ["English", "Nepali", "Accountancy", "Economics", "Business Studies", "Mathematics / Additional Math"],
  Humanities: ["English", "Nepali", "Social Studies", "Economics", "Optional Subject I", "Optional Subject II"],
};

function gradePoints(v: string) {
  return GRADES.find(g => g.value === v)?.points ?? null;
}

function gpaLabel(gpa: number): { grade: string; msg: string; color: string } {
  if (gpa >= 3.6) return { grade: "A+",  msg: "Outstanding! You are in the top tier. 🎉", color: "text-green-600" };
  if (gpa >= 3.2) return { grade: "A",   msg: "Excellent work! Keep it up.",              color: "text-green-500" };
  if (gpa >= 2.8) return { grade: "B+",  msg: "Very Good! A little more effort and you can reach A.", color: "text-blue-600" };
  if (gpa >= 2.4) return { grade: "B",   msg: "Good performance. Focus on weaker subjects.", color: "text-blue-500" };
  if (gpa >= 2.0) return { grade: "C+",  msg: "Satisfactory. Set higher targets next time.", color: "text-yellow-600" };
  if (gpa >= 1.6) return { grade: "C",   msg: "Acceptable. Consistent study is key.",        color: "text-orange-500" };
  if (gpa >= 1.2) return { grade: "D+",  msg: "You need to significantly improve your study habits.", color: "text-red-500" };
  return              { grade: "D",   msg: "Please seek extra help and revise thoroughly.",  color: "text-red-600" };
}

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is the NEB grading system?", acceptedAnswer: { "@type": "Answer", text: "The NEB (National Examinations Board) Nepal uses a grade point system from 0 to 4.0. The highest grade A+ corresponds to 4.0 GPA (90–100 marks) and the lowest passing grade D corresponds to 1.2 GPA (20–34 marks)." } },
    { "@type": "Question", name: "How is GPA calculated in NEB Class 12?", acceptedAnswer: { "@type": "Answer", text: "Your GPA is the average of grade points across all your subjects. Add up all subject grade points and divide by the number of subjects. For example, if you score A+(4.0), A(3.6), B+(3.2), B(2.8), C+(2.4), C(2.0) — total = 18.0, GPA = 18.0/6 = 3.0." } },
    { "@type": "Question", name: "What GPA is needed for a scholarship in Nepal?", acceptedAnswer: { "@type": "Answer", text: "Most government scholarships and top colleges in Nepal require a minimum GPA of 3.6 (Grade A) in NEB Class 12. Medical colleges typically require at least 3.2 (B+) in Science subjects." } },
    { "@type": "Question", name: "What is the passing GPA in NEB?", acceptedAnswer: { "@type": "Answer", text: "To pass NEB Class 12, you must score at least Grade D (1.2 GPA, 20–34 marks) in each subject and must not have a NG (Not Graded) grade in any subject." } },
    { "@type": "Question", name: "Is this GPA calculator official?", acceptedAnswer: { "@type": "Answer", text: "This calculator uses the official NEB grading scale published by the National Examinations Board Nepal. However, always verify your final GPA with your official mark sheet from NEB." } },
  ],
};

export default function GpaCalculator() {
  const [faculty, setFaculty] = useState<string>("Science");
  const [grades, setGrades] = useState<Record<string, string>>({});

  const subjects = FACULTIES[faculty];

  const result = useMemo(() => {
    const points = subjects.map(s => gradePoints(grades[s] ?? "")).filter((p): p is number => p !== null);
    if (points.length === 0) return null;
    const gpa = points.reduce((a, b) => a + b, 0) / points.length;
    return { gpa: Math.round(gpa * 100) / 100, filled: points.length, total: subjects.length };
  }, [grades, subjects]);

  const handleFacultyChange = (f: string) => { setFaculty(f); setGrades({}); };

  const label = result ? gpaLabel(result.gpa) : null;

  return (
    <>
      <Helmet>
        <title>NEB GPA Calculator Nepal — Class 12 GPA Calculator 2025 | Student Hub</title>
        <meta name="description" content="Free NEB GPA Calculator for Class 12 Nepal. Calculate your GPA using the official NEB grading system for Science and Management faculty. Instant results." />
        <meta name="keywords" content="NEB GPA calculator, Class 12 GPA calculator Nepal, SEE GPA calculator Nepal, NEB grading system Nepal, NEB Class 12 result GPA" />
        <meta property="og:title" content="NEB GPA Calculator Nepal — Class 12 | Student Hub" />
        <meta property="og:description" content="Calculate your NEB Class 12 GPA instantly using the official Nepal grading system. Free tool for Science and Management students." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://studenthubnp.com/tools/gpa-calculator" />
        <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <Link href="/tools" className="hover:text-blue-600 transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-gray-600">NEB GPA Calculator</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Calculator className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">Nepal · NEB Class 12</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">NEB GPA Calculator</h1>
          <p className="text-gray-500 mt-1 text-sm">Enter your grades below to instantly calculate your Class 12 GPA using the official NEB grading scale.</p>
        </div>

        {/* Calculator Card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 mb-6">
          {/* Faculty selector */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Faculty</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(FACULTIES).map(f => (
                <button
                  key={f}
                  onClick={() => handleFacultyChange(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    faculty === f
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Subject grades */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Subject Grades</label>
            <div className="space-y-3">
              {subjects.map(subj => (
                <div key={subj} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 font-medium min-w-0 truncate">{subj}</span>
                  <div className="relative flex-shrink-0">
                    <select
                      value={grades[subj] ?? ""}
                      onChange={e => setGrades(g => ({ ...g, [subj]: e.target.value }))}
                      className="appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Select grade</option>
                      {GRADES.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          {result && label && (
            <div className={`rounded-2xl p-5 border ${result.gpa >= 3.2 ? "bg-green-50 border-green-100" : result.gpa >= 2.4 ? "bg-blue-50 border-blue-100" : result.gpa >= 1.6 ? "bg-yellow-50 border-yellow-100" : "bg-red-50 border-red-100"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your GPA ({result.filled}/{result.total} subjects)</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white border ${label.color}`}>{label.grade}</span>
              </div>
              <div className={`text-5xl font-black mb-1 ${label.color}`}>{result.gpa.toFixed(2)}</div>
              <div className="text-sm text-gray-600 font-medium">out of 4.00</div>
              <p className={`mt-3 text-sm font-medium ${label.color}`}>{label.msg}</p>
              {result.filled < result.total && (
                <p className="text-xs text-gray-400 mt-2">Add grades for all {result.total} subjects for your final GPA.</p>
              )}
            </div>
          )}

          {!result && (
            <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-400">Select at least one subject grade to see your GPA.</p>
            </div>
          )}
        </div>

        {/* NEB Grade Scale Reference */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4">NEB Grade Point Scale</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left pb-2 font-semibold">Grade</th>
                  <th className="text-left pb-2 font-semibold">Marks Range</th>
                  <th className="text-left pb-2 font-semibold">Grade Points</th>
                  <th className="text-left pb-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { g: "A+", r: "90–100", p: "4.0", d: "Outstanding" },
                  { g: "A",  r: "80–89",  p: "3.6", d: "Excellent" },
                  { g: "B+", r: "70–79",  p: "3.2", d: "Very Good" },
                  { g: "B",  r: "60–69",  p: "2.8", d: "Good" },
                  { g: "C+", r: "50–59",  p: "2.4", d: "Satisfactory" },
                  { g: "C",  r: "40–49",  p: "2.0", d: "Acceptable" },
                  { g: "D+", r: "35–39",  p: "1.6", d: "Partially Acceptable" },
                  { g: "D",  r: "20–34",  p: "1.2", d: "Insufficient" },
                  { g: "NG", r: "Below 20", p: "0.0", d: "Not Graded" },
                ].map(row => (
                  <tr key={row.g} className="text-gray-700">
                    <td className="py-2 font-bold text-blue-600">{row.g}</td>
                    <td className="py-2">{row.r}</td>
                    <td className="py-2 font-semibold">{row.p}</td>
                    <td className="py-2 text-gray-500">{row.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SEO Content */}
        <article className="prose prose-sm max-w-none text-gray-600 space-y-6">
          <h2 className="text-xl font-bold text-gray-900">NEB GPA Calculator Nepal — Everything You Need to Know</h2>
          <p>
            The <strong>NEB GPA Calculator</strong> on Student Hub is designed specifically for Class 12 students in Nepal. Whether you are studying Science, Management, or Humanities, this tool gives you an accurate GPA based on the official <strong>National Examinations Board (NEB) grading system</strong>.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How to Use This NEB GPA Calculator</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Select your faculty — Science, Management, or Humanities.</li>
            <li>Choose the grade (A+, A, B+, etc.) you received or expect in each subject.</li>
            <li>Your GPA appears instantly — no need to press any button.</li>
            <li>Compare your GPA with the NEB grade scale shown above.</li>
          </ol>

          <h3 className="text-lg font-bold text-gray-900">How is NEB Class 12 GPA Calculated?</h3>
          <p>
            The NEB GPA is calculated using a simple formula: <strong>GPA = Sum of all subject grade points ÷ Number of subjects</strong>. For example, if a Science student scores A+ in Physics (4.0), A in Chemistry (3.6), B+ in Mathematics (3.2), A in English (3.6), B in Nepali (2.8), and A in Biology (3.6), the total grade points = 20.8, and the GPA = 20.8 ÷ 6 = <strong>3.47 GPA</strong>.
          </p>

          <h3 className="text-lg font-bold text-gray-900">NEB Grading System Explained</h3>
          <p>
            The <strong>NEB grading system Nepal</strong> was introduced to replace the traditional percentage-based evaluation with a standardised letter-grade system. The scale ranges from A+ (the highest, 4.0 grade points) to NG (Not Graded, 0 grade points). Students must score at least Grade D (20–34 marks) in every subject to pass the NEB examination.
          </p>
          <p>
            For NEB Class 12 (Grade 12), the exams are conducted in the areas of Science, Management, Humanities, and Education streams. The final GPA appears on your official NEB mark sheet and is used by colleges, universities, and scholarship bodies for admissions.
          </p>

          <h3 className="text-lg font-bold text-gray-900">What GPA Do You Need for Different Courses?</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Medicine (MBBS) in Nepal:</strong> Minimum 3.2 GPA (B+) in Science, plus CMAT entrance.</li>
            <li><strong>Engineering (BE) in Nepal:</strong> Minimum 2.8 GPA (B) in Science with strong Mathematics and Physics scores.</li>
            <li><strong>Government Scholarships:</strong> Typically 3.6+ GPA (A grade) for full scholarships.</li>
            <li><strong>BBA / BBS (Management):</strong> Usually 2.4+ GPA (C+) from Management or Science faculty.</li>
            <li><strong>Foreign Universities:</strong> 3.2+ GPA preferred; many countries convert NEB GPA to their own scale.</li>
          </ul>

          <h3 className="text-lg font-bold text-gray-900">Tips to Improve Your NEB GPA</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Focus on your weakest subjects first — one D can pull your entire GPA down significantly.</li>
            <li>Practice with <Link href="/pyqs" className="text-blue-600 hover:underline">previous year NEB question papers (PYQs)</Link> to understand the exam pattern.</li>
            <li>Use the <Link href="/notes" className="text-blue-600 hover:underline">Study Notes</Link> on Student Hub for chapter-wise revision.</li>
            <li>Set daily study targets using the Pomodoro timer — 25 minutes focused study beats 2 hours of distracted reading.</li>
            <li>Ask <Link href="/ai" className="text-blue-600 hover:underline">Nep AI</Link> to explain any concept you find difficult — it knows the NEB curriculum inside out.</li>
          </ul>

          <h3 className="text-lg font-bold text-gray-900">SEE vs NEB GPA — What's the Difference?</h3>
          <p>
            The <strong>SEE (Secondary Education Examination)</strong> is the Grade 10 board exam, while NEB covers Grades 11 and 12. Both use the same letter-grade scale (A+ to NG) and the same grade point values. The main difference is the subjects: SEE covers a broader general curriculum, while NEB Class 12 is faculty-specific. This calculator works for both NEB Class 11 and Class 12 examinations.
          </p>

          {/* FAQ Section */}
          <h2 className="text-xl font-bold text-gray-900 pt-2">Frequently Asked Questions — NEB GPA Calculator</h2>

          {FAQ_SCHEMA.mainEntity.map((faq, i) => (
            <details key={i} className="border border-gray-100 rounded-xl p-4 group">
              <summary className="font-semibold text-gray-900 cursor-pointer text-sm list-none flex items-center justify-between">
                {faq.name}
                <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.acceptedAnswer.text}</p>
            </details>
          ))}
        </article>
      </div>
    </>
  );
}
