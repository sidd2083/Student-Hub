import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { CalendarCheck, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is the 75% attendance rule?", acceptedAnswer: { "@type": "Answer", text: "The 75% attendance rule requires students to attend at least 75 out of every 100 classes. Students who fall below this threshold may be barred from sitting for exams or face grade deductions. This rule is common in colleges and universities across Nepal, India, and many other countries." } },
    { "@type": "Question", name: "How do I calculate my attendance percentage?", acceptedAnswer: { "@type": "Answer", text: "Attendance percentage = (Classes attended ÷ Total classes held) × 100. For example, if 80 classes were held and you attended 65, your attendance is (65 ÷ 80) × 100 = 81.25%." } },
    { "@type": "Question", name: "How many classes can I miss with 75% requirement?", acceptedAnswer: { "@type": "Answer", text: "You can miss at most 25% of total classes. Formula: Maximum absences = Total classes × (1 − required percentage / 100). If there are 100 classes total, you can miss up to 25. If you've already missed some, subtract those from the allowed absences." } },
    { "@type": "Question", name: "How many classes do I need to attend to reach 75%?", acceptedAnswer: { "@type": "Answer", text: "If your current attendance is below the required percentage, use this formula: Classes needed = (Required % × Total classes − 100 × Classes attended) ÷ (100 − Required %). This tells you exactly how many consecutive classes you must attend to reach the target." } },
    { "@type": "Question", name: "Can I calculate attendance for 80% or 90% requirement?", acceptedAnswer: { "@type": "Answer", text: "Yes. This attendance calculator works for any required percentage — 75%, 80%, 85%, 90%, or anything else. Simply change the 'Required Attendance %' field to your institution's requirement and the calculator adjusts all results automatically." } },
    { "@type": "Question", name: "What happens if my attendance drops below the minimum?", acceptedAnswer: { "@type": "Answer", text: "Consequences vary by institution. Common penalties include: being barred from semester/board exams, grade deductions (typically 10–20% of marks), detention to the same class, or requirement to repeat the course. Always check your college's specific attendance policy." } },
  ],
};

const HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Calculate Attendance Percentage",
  description: "Step-by-step guide to calculate your attendance percentage and find out how many classes you can miss.",
  step: [
    { "@type": "HowToStep", name: "Enter Total Classes", text: "Enter the total number of classes held in your subject or semester so far." },
    { "@type": "HowToStep", name: "Enter Classes Attended", text: "Enter the number of classes you have actually attended out of the total." },
    { "@type": "HowToStep", name: "Set Required Percentage", text: "Enter your institution's minimum attendance requirement (commonly 75%)." },
    { "@type": "HowToStep", name: "Read the Results", text: "The calculator instantly shows your current attendance %, how many more classes you can miss, or how many you need to attend to reach the requirement." },
  ],
};

function calcAttendance(total: number, attended: number, required: number) {
  if (total <= 0) return null;
  const current = (attended / total) * 100;
  const canMiss = Math.max(0, Math.floor(total * (1 - required / 100) - (total - attended)));
  const needed = current >= required ? 0 : Math.ceil((required * total - 100 * attended) / (100 - required));
  return { current: Math.round(current * 10) / 10, canMiss, needed, safe: current >= required };
}

export default function AttendanceCalculator() {
  const [total,    setTotal]    = useState<string>("");
  const [attended, setAttended] = useState<string>("");
  const [required, setRequired] = useState<string>("75");

  const result = useMemo(() => {
    const t = parseInt(total);
    const a = parseInt(attended);
    const r = parseFloat(required);
    if (!t || !a || !r || isNaN(t) || isNaN(a) || isNaN(r) || a > t || t <= 0 || r <= 0 || r >= 100) return null;
    return calcAttendance(t, a, r);
  }, [total, attended, required]);

  const statusColor = result
    ? result.current >= parseFloat(required || "75")
      ? "bg-green-50 border-green-100"
      : result.current >= parseFloat(required || "75") - 5
        ? "bg-yellow-50 border-yellow-100"
        : "bg-red-50 border-red-100"
    : "";

  return (
    <>
      <Helmet>
        <title>Attendance Calculator — How Many Classes Can I Miss? | Student Hub</title>
        <meta name="description" content="Free attendance calculator: find your attendance percentage, how many classes you can miss, and how many you need to reach 75% or any target. Instant results." />
        <meta name="keywords" content="attendance calculator, 75% attendance calculator, how many classes can I miss, attendance percentage calculator, class attendance calculator" />
        <meta property="og:title" content="Attendance Calculator — Student Hub" />
        <meta property="og:description" content="Calculate your attendance percentage instantly. Find out how many classes you can skip or how many you need to reach the required percentage." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://studenthubnp.com/tools/attendance-calculator" />
        <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(HOWTO_SCHEMA)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
          <Link href="/tools" className="hover:text-blue-600 transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-gray-600">Attendance Calculator</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Global · All Institutions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Attendance Calculator</h1>
          <p className="text-gray-500 mt-1 text-sm">Find your attendance %, how many classes you can miss, or how many you need to reach your required percentage.</p>
        </div>

        {/* Calculator Card */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 mb-6">
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Total Classes Held</label>
              <input
                type="number"
                min="1"
                value={total}
                onChange={e => setTotal(e.target.value)}
                placeholder="e.g. 80"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Classes Attended</label>
              <input
                type="number"
                min="0"
                value={attended}
                onChange={e => setAttended(e.target.value)}
                placeholder="e.g. 65"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Required % (default 75)</label>
              <input
                type="number"
                min="1"
                max="99"
                value={required}
                onChange={e => setRequired(e.target.value)}
                placeholder="75"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              />
            </div>
          </div>

          {/* Validation warning */}
          {attended && total && parseInt(attended) > parseInt(total) && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Classes attended cannot exceed total classes held.
            </div>
          )}

          {/* Result */}
          {result ? (
            <div className={`rounded-2xl p-5 border ${statusColor}`}>
              <div className="flex items-center gap-2 mb-4">
                {result.safe
                  ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  : <XCircle   className="w-5 h-5 text-red-500   flex-shrink-0" />
                }
                <span className={`text-sm font-bold ${result.safe ? "text-green-700" : "text-red-600"}`}>
                  {result.safe ? "You are safe!" : "Attendance below requirement"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className={`text-3xl font-black ${result.safe ? "text-green-600" : "text-red-500"}`}>
                    {result.current}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-medium">Current Attendance</div>
                </div>

                <div className="text-center border-x border-white/60">
                  {result.safe ? (
                    <>
                      <div className="text-3xl font-black text-blue-600">{result.canMiss}</div>
                      <div className="text-xs text-gray-500 mt-1 font-medium">Classes You Can Miss</div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-black text-orange-500">{result.needed}</div>
                      <div className="text-xs text-gray-500 mt-1 font-medium">Classes Needed</div>
                    </>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-3xl font-black text-gray-700">{required || 75}%</div>
                  <div className="text-xs text-gray-500 mt-1 font-medium">Required</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>0%</span>
                  <span>{required || 75}% required</span>
                  <span>100%</span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${result.safe ? "bg-green-500" : "bg-red-400"}`}
                    style={{ width: `${Math.min(result.current, 100)}%` }}
                  />
                </div>
                {/* Required mark */}
                <div
                  className="relative h-0"
                  style={{ marginTop: "-10px" }}
                >
                  <div
                    className="absolute top-0 w-0.5 h-3 bg-gray-400 rounded-full -translate-x-1/2"
                    style={{ left: `${parseFloat(required || "75")}%` }}
                  />
                </div>
              </div>

              {result.safe && result.canMiss === 0 && (
                <p className="mt-3 text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
                  ⚠️ You are exactly at the limit. Missing even one more class will put you below {required || 75}%.
                </p>
              )}
              {!result.safe && (
                <p className="mt-3 text-xs text-gray-600">
                  You must attend the next <strong>{result.needed} consecutive classes</strong> without missing any to reach {required || 75}%.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
              <p className="text-sm text-gray-400">Fill in the fields above to see your attendance results instantly.</p>
            </div>
          )}
        </div>

        {/* Examples */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 sm:p-6 mb-8">
          <h2 className="text-base font-bold text-gray-900 mb-4">Quick Examples</h2>
          <div className="space-y-3">
            {[
              { t: 80, a: 65, r: 75, label: "College semester, 75% rule" },
              { t: 120, a: 85, r: 80, label: "Medical college, 80% rule" },
              { t: 60, a: 40, r: 75, label: "Short course, below limit" },
            ].map(({ t, a, r, label }) => {
              const ex = calcAttendance(t, a, r)!;
              return (
                <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{label}</span>
                    <span className="text-gray-400 ml-2 text-xs">{a}/{t} classes · {r}% req.</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-bold ${ex.safe ? "text-green-600" : "text-red-500"}`}>{ex.current}%</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ex.safe ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {ex.safe ? `Can miss ${ex.canMiss}` : `Need ${ex.needed} more`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEO Content */}
        <article className="prose prose-sm max-w-none text-gray-600 space-y-6">
          <h2 className="text-xl font-bold text-gray-900">Attendance Calculator — Complete Guide</h2>
          <p>
            Whether you are a college student worried about the <strong>75% attendance rule</strong>, a university student needing to track your classes, or a school student managing multiple subjects — this <strong>attendance percentage calculator</strong> gives you instant, accurate answers. No formulas to memorise. No spreadsheets needed.
          </p>

          <h3 className="text-lg font-bold text-gray-900">What Is the 75% Attendance Rule?</h3>
          <p>
            The <strong>75% attendance rule</strong> is a minimum attendance policy used by colleges and universities worldwide — particularly in India, Nepal, Bangladesh, and many other countries. Under this rule, a student must attend at least 75 out of every 100 classes conducted. Falling below this threshold can result in being <strong>barred from examinations</strong>, receiving grade penalties, or being detained in the same academic year.
          </p>
          <p>
            Some institutions have stricter requirements — 80% for medical colleges, 85% for certain professional courses. This calculator works for <strong>any required percentage</strong> — just change the "Required %" field.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How to Calculate Attendance Percentage</h3>
          <p>The formula is simple:</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm text-gray-800">
            Attendance % = (Classes Attended ÷ Total Classes) × 100
          </div>
          <p>
            <strong>Example:</strong> If your college has conducted 90 classes and you have attended 72 of them, your attendance is (72 ÷ 90) × 100 = <strong>80%</strong>. With a 75% requirement, you can still miss 72 × (1/3) - 18 = <strong>7 more classes</strong> and remain safe.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How Many Classes Can I Miss? (Formula)</h3>
          <p>To find out the maximum number of classes you can skip while staying above the required percentage:</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm text-gray-800">
            Can Miss = (Total Classes × (1 − Required%/100)) − (Total Classes − Attended Classes)
          </div>
          <p>
            If this number is negative, you are already below the requirement and need to attend more classes — not fewer.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How Many Classes Do I Need to Attend to Reach 75%?</h3>
          <p>If your attendance has dropped below the required level, use this formula to find out how many consecutive classes you must attend:</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm text-gray-800">
            Classes Needed = (Required% × Total − 100 × Attended) ÷ (100 − Required%)
          </div>
          <p>
            <strong>Example:</strong> 60 total classes, 40 attended (66.7%), 75% required.<br />
            Classes needed = (75 × 60 − 100 × 40) ÷ (100 − 75) = (4500 − 4000) ÷ 25 = <strong>20 more consecutive classes</strong>.
          </p>

          <h3 className="text-lg font-bold text-gray-900">Attendance Tips for Students</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Check your attendance at the start of each week — catching a problem early gives you more time to recover.</li>
            <li>Even if a class feels less important, attendance counts the same for all subjects.</li>
            <li>If you have a planned absence (travel, event), calculate in advance how many classes you can miss.</li>
            <li>Some professors allow "proxy" attendance — this risks academic misconduct penalties. It is not worth it.</li>
            <li>Use the <Link href="/todo" className="text-blue-600 hover:underline">To-Do list</Link> and <Link href="/pomodoro" className="text-blue-600 hover:underline">Pomodoro Timer</Link> on Student Hub to stay organised and make the most of classes you do attend.</li>
          </ul>

          <h3 className="text-lg font-bold text-gray-900">Attendance Percentage for Different Countries</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>India:</strong> 75% is standard for most UGC-affiliated colleges. Medical colleges (MCI) require 75–80%.</li>
            <li><strong>Nepal:</strong> Tribhuvan University (TU) and most colleges require 75–80% attendance.</li>
            <li><strong>Bangladesh:</strong> National University requires a minimum of 75% attendance for exams.</li>
            <li><strong>USA:</strong> No universal rule, but most universities have policies of 80–85% for international students on F-1 visas.</li>
            <li><strong>UK:</strong> Universities require 85–90% for international students due to visa regulations.</li>
          </ul>

          {/* FAQ */}
          <h2 className="text-xl font-bold text-gray-900 pt-2">Frequently Asked Questions — Attendance Calculator</h2>
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
