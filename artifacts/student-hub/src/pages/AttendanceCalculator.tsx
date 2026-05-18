import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { CalendarCheck, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is the 75% attendance rule in college?", acceptedAnswer: { "@type": "Answer", text: "The 75% attendance rule requires students to attend at least 75 out of every 100 classes. In India, UGC mandates 75% attendance for all affiliated colleges. In the UK, Student Visa holders must maintain 85–90%. In Australia, Student Visa (Subclass 500) holders must maintain 80% under the ESOS Act. In the USA there is no federal mandate, but most universities require 75–85% especially for international students." } },
    { "@type": "Question", name: "How do I calculate my attendance percentage?", acceptedAnswer: { "@type": "Answer", text: "Attendance % = (Classes Attended ÷ Total Classes Held) × 100. Example: 65 attended out of 80 total = (65 ÷ 80) × 100 = 81.25%. Our free online attendance calculator does this instantly — just type your numbers above." } },
    { "@type": "Question", name: "How many classes can I miss or bunk?", acceptedAnswer: { "@type": "Answer", text: "Classes you can bunk = Total Classes × (1 − Required% ÷ 100) − Classes already missed. Example: 100 total classes, 75% rule: you can miss at most 25 classes total. If you've already missed 10, you can only miss 15 more. Enter your numbers above and the bunk calculator shows this instantly." } },
    { "@type": "Question", name: "How many classes do I need to attend to reach 75%?", acceptedAnswer: { "@type": "Answer", text: "Classes needed = (Required% × Total − 100 × Attended) ÷ (100 − Required%). Example: 60 total, 40 attended (66.7%), 75% required → (75×60 − 100×40) ÷ 25 = 20 consecutive classes. The calculator shows this recovery number instantly." } },
    { "@type": "Question", name: "Can I use this for 80%, 85%, or 90% attendance requirement?", acceptedAnswer: { "@type": "Answer", text: "Yes — this attendance calculator works for any percentage. Change the 'Required %' field to 80% (medical colleges India), 85% (many Canadian and UK universities), 90% (some professional programs), or any value and it recalculates instantly." } },
    { "@type": "Question", name: "What is the attendance rule in Indian colleges?", acceptedAnswer: { "@type": "Answer", text: "UGC (University Grants Commission) mandates a minimum 75% attendance for all affiliated colleges in India, including DU, Mumbai University, Anna University, VTU, Osmania, and Pune University. Medical colleges under MCI/NMC require 75–80%. IITs and NITs enforce 75% strictly with grade penalties." } },
    { "@type": "Question", name: "What is the attendance requirement for Australian student visa?", acceptedAnswer: { "@type": "Answer", text: "International students on an Australian Student Visa (Subclass 500) must maintain at least 80% attendance under the ESOS Act. Universities like Melbourne, Sydney, Monash, and RMIT all enforce this. Falling below 80% can trigger a visa compliance report which risks visa cancellation." } },
    { "@type": "Question", name: "What is the attendance rule in USA universities?", acceptedAnswer: { "@type": "Answer", text: "US universities do not have a federal attendance mandate, but most set their own policies ranging from 75% to 85%. International students on F-1 visas must maintain 'full-time status' which typically requires attending required classes. Missing too many classes can trigger a SEVIS termination report affecting F-1 status." } },
    { "@type": "Question", name: "How do I write an attendance shortage application?", acceptedAnswer: { "@type": "Answer", text: "Address the letter to your Principal/Dean/HoD. Include: student name, enrollment ID, current attendance percentage, subject(s) affected, genuine reason (medical, emergency, official event), and supporting documents (medical certificate, hospital records, etc.). Request condonation under the college's policy. Most institutions allow 5–10% condonation on valid grounds." } },
    { "@type": "Question", name: "How many classes can I miss per week and stay above 75%?", acceptedAnswer: { "@type": "Answer", text: "Track cumulative, not weekly — missed classes compound quickly. As a rough guide: with 30 classes/week, attending at least 23 per week keeps you at 75%+. But the safest approach is to check your running total using this calculator at the start of each week." } },
  ],
};

const HOWTO_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Use the Attendance Calculator",
  description: "Free step-by-step guide to find your attendance percentage and see exactly how many classes you can miss.",
  step: [
    { "@type": "HowToStep", name: "Enter Total Classes Held", text: "Enter the total number of classes your college has conducted so far this semester." },
    { "@type": "HowToStep", name: "Enter Classes Attended", text: "Enter the number of classes you have actually attended." },
    { "@type": "HowToStep", name: "Set Your Required Percentage", text: "Enter your college's minimum. Default is 75% — change it to 80%, 85%, 90%, or any value." },
    { "@type": "HowToStep", name: "Read Instant Results", text: "See your current percentage, exactly how many more classes you can miss (bunk), or how many consecutive classes you need to attend to recover. No button needed." },
  ],
};

const WEBAPP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Attendance Calculator — How Many Classes Can I Miss or Bunk?",
  applicationCategory: "EducationApplication",
  operatingSystem: "Web Browser",
  url: "https://studenthubnp.com/tools/attendance-calculator",
  description: "Free online attendance calculator. Instantly find your attendance percentage, how many classes you can miss or bunk, and how many you need to reach 75%, 80%, or any required percentage. Used by college students in India, USA, Australia, Canada, and UK.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Instant attendance percentage calculation",
    "Bunk calculator — how many classes you can miss",
    "Recovery calculator — how many classes to attend to reach 75%",
    "Works for 75%, 80%, 85%, 90% or any custom requirement",
    "Free, no login, no sign-up",
  ],
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://studenthubnp.com" },
    { "@type": "ListItem", position: 2, name: "Tools", item: "https://studenthubnp.com/tools" },
    { "@type": "ListItem", position: 3, name: "Attendance Calculator", item: "https://studenthubnp.com/tools/attendance-calculator" },
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
        <title>Attendance Calculator — How Many Classes Can I Miss or Bunk? | Free Online Tool</title>
        <meta name="description" content="Free online attendance calculator: instantly find your attendance percentage, exactly how many classes you can miss or bunk, and how many you need to reach 75%, 80%, or any required %. Works for college students in India, USA, Australia, Canada, UK — no sign-up." />
        <meta name="keywords" content="attendance calculator, how many classes can i miss, how many classes can i bunk, bunk calculator, 75 attendance calculator, attendance percentage calculator, class attendance calculator, college attendance calculator, attendance calculator india, attendance calculator australia, attendance calculator usa, attendance calculator canada, attendance calculator uk, attendance shortage calculator, 75 percent attendance rule, how many classes can i skip, minimum attendance calculator, attendance calculator online free, lecture attendance calculator, bunking calculator college, how many lectures can i miss, attendance calculator for 75 percent, college bunk calculator, student attendance tracker" />
        <meta name="author" content="Student Hub" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />

        <meta property="og:title" content="Attendance Calculator — How Many Classes Can I Miss or Bunk? | Free Online Tool" />
        <meta property="og:description" content="Free attendance calculator: find your attendance %, how many classes you can bunk/miss, or how many you need to reach 75%, 80%, or any required percentage. India, USA, Australia, UK, Canada." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://studenthubnp.com/tools/attendance-calculator" />
        <meta property="og:image" content="https://studenthubnp.com/opengraph.jpg" />
        <meta property="og:image:alt" content="Free Attendance Calculator — How Many Classes Can I Miss?" />
        <meta property="og:site_name" content="Student Hub" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Attendance Calculator — How Many Classes Can I Miss or Bunk?" />
        <meta name="twitter:description" content="Free online attendance calculator. Enter your classes and instantly see how many you can miss or bunk — works for 75%, 80%, 85%, 90% rules." />
        <meta name="twitter:image" content="https://studenthubnp.com/opengraph.jpg" />

        <link rel="canonical" href="https://studenthubnp.com/tools/attendance-calculator" />
        <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(HOWTO_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(WEBAPP_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(BREADCRUMB_SCHEMA)}</script>
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
          <h2 className="text-xl font-bold text-gray-900">Attendance Calculator — Complete Guide (75% Rule, Bunk Calculator & More)</h2>
          <p>
            Whether you are a college student worried about the <strong>75% attendance rule</strong>, looking for a <strong>bunk calculator</strong> to plan ahead, or need to know how many classes you must attend to recover — this free <strong>attendance percentage calculator</strong> gives you instant, accurate answers. No formula to memorise. Works for students in India, USA, Australia, Canada, the UK, and every institution worldwide.
          </p>

          <h3 className="text-lg font-bold text-gray-900">What Is the 75% Attendance Rule?</h3>
          <p>
            The <strong>75% attendance rule</strong> is a minimum class attendance policy enforced by colleges and universities across South Asia and beyond. Under this rule, a student must attend at least 75 out of every 100 classes conducted. Falling below this threshold can result in being <strong>barred from semester or board examinations</strong>, grade deductions, detention, or having to repeat the academic year.
          </p>
          <p>
            Some institutions have stricter requirements — 80% for most medical and engineering colleges in India, 85–90% for international students in the UK and Australia. This <strong>attendance calculator</strong> works for <em>any</em> required percentage — simply change the "Required %" field to your college's specific rule.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How to Calculate Attendance Percentage — Formula</h3>
          <p>The attendance percentage formula is:</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm text-gray-800">
            Attendance % = (Classes Attended ÷ Total Classes Held) × 100
          </div>
          <p>
            <strong>Example:</strong> If your college held 90 classes and you attended 72, your attendance is (72 ÷ 90) × 100 = <strong>80%</strong>. With a 75% requirement, you can miss 7 more classes and still be safe.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How Many Classes Can I Miss or Bunk? (Bunk Calculator Formula)</h3>
          <p>To find the maximum number of classes you can skip (bunk) while staying safe:</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm text-gray-800">
            Classes You Can Bunk = (Total × (1 − Required%/100)) − (Total − Attended)
          </div>
          <p>
            If the result is negative, you've already exceeded your bunk limit and must now attend consecutively to recover. Our calculator shows this instantly — just enter your numbers above.
          </p>

          <h3 className="text-lg font-bold text-gray-900">How Many Classes Do I Need to Attend to Reach 75%?</h3>
          <p>If your attendance has fallen below the required level, use this recovery formula:</p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 font-mono text-sm text-gray-800">
            Classes Needed = (Required% × Total − 100 × Attended) ÷ (100 − Required%)
          </div>
          <p>
            <strong>Example:</strong> 60 total classes, 40 attended (66.7%), 75% required →
            (75 × 60 − 100 × 40) ÷ (100 − 75) = 500 ÷ 25 = <strong>20 consecutive classes you must attend</strong>.
          </p>

          <h3 className="text-lg font-bold text-gray-900">Attendance Calculator for India — College-Wise Rules</h3>
          <p>
            India has one of the highest searches for <strong>"how many classes can I bunk"</strong> and <strong>"attendance calculator"</strong> globally, because the <strong>UGC mandates 75% attendance</strong> across all affiliated colleges. Here's a quick breakdown:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr className="text-gray-500">
                  <th className="text-left px-3 py-2 font-semibold">Institution Type</th>
                  <th className="text-left px-3 py-2 font-semibold">Required Attendance</th>
                  <th className="text-left px-3 py-2 font-semibold">Consequence of Shortage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ["UGC-affiliated colleges (DU, Mumbai, Anna, VTU, etc.)", "75%", "Barred from exams"],
                  ["Medical colleges — MCI/NMC", "75–80%", "Barred from exams"],
                  ["IITs / NITs", "75% (strict enforcement)", "Grade penalty / debarred"],
                  ["Private engineering colleges (AICTE)", "75%", "Varies by college"],
                  ["CBSE / Class 11–12", "75% recommended", "May affect board forms"],
                ].map(([inst, req, cons]) => (
                  <tr key={inst} className="text-xs">
                    <td className="px-3 py-2 text-gray-700">{inst}</td>
                    <td className="px-3 py-2 font-semibold text-red-600">{req}</td>
                    <td className="px-3 py-2 text-gray-500">{cons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold text-gray-900">Attendance Rules by Country — Global Reference</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr className="text-gray-500">
                  <th className="text-left px-3 py-2 font-semibold">Country</th>
                  <th className="text-left px-3 py-2 font-semibold">Minimum Required</th>
                  <th className="text-left px-3 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ["🇮🇳 India", "75%", "UGC mandate for all colleges. Medical / IITs / NITs: 75–80%."],
                  ["🇦🇺 Australia", "80%", "Student Visa (Subclass 500) ESOS Act — monitored by PRISMS."],
                  ["🇬🇧 UK", "85–90%", "Student Visa compliance — UKVI reports if breached."],
                  ["🇺🇸 USA", "75–85%", "Institution-set; F-1 students risk SEVIS status if missing classes."],
                  ["🇨🇦 Canada", "80%", "Most universities; required for study permit compliance."],
                  ["🇵🇰 Pakistan", "75%", "HEC requirement for all affiliated colleges and universities."],
                ].map(([country, req, notes]) => (
                  <tr key={country} className="text-xs">
                    <td className="px-3 py-2 font-medium text-gray-800">{country}</td>
                    <td className="px-3 py-2 font-bold text-blue-600">{req}</td>
                    <td className="px-3 py-2 text-gray-500">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold text-gray-900">How to Write an Attendance Shortage Application</h3>
          <p>
            If your attendance falls below the minimum, many colleges accept a written application for condonation (waiver) on genuine grounds — medical emergencies, family bereavement, official competitions, or natural disasters. The application should be addressed to the Principal or Head of Department, clearly state your enrollment number, current attendance percentage, the reason for shortage, and attach supporting documents (medical certificate, etc.). Most colleges allow condonation for up to a <strong>5–10% shortage</strong>.
          </p>

          <h3 className="text-lg font-bold text-gray-900">Smart Attendance Tips</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Use this <strong>bunk calculator</strong> at the start of each week to know exactly how many classes you can safely skip.</li>
            <li>Even if a class seems unimportant, all classes count equally toward your percentage.</li>
            <li>If you have planned absences (travel, events), calculate how they affect your running total before missing.</li>
            <li>Proxy attendance carries serious academic misconduct penalties — not worth the risk.</li>
            <li>Track your tasks with the <Link href="/todo" className="text-blue-600 hover:underline">To-Do list</Link> and use the <Link href="/pomodoro" className="text-blue-600 hover:underline">Pomodoro Timer</Link> to make every class you attend count.</li>
            <li>Pair this with the <Link href="/tools/gpa-calculator" className="text-blue-600 hover:underline">NEB GPA Calculator</Link> to track both your grades and attendance simultaneously.</li>
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
