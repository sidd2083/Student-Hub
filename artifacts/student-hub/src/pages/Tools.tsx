import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Calculator, CalendarCheck, ArrowRight, Keyboard, Globe } from "lucide-react";

const TOOLS_ITEMLIST_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Free Student Tools — NEB GPA Calculator, Attendance Calculator, Nepali Typing Practice & English Typing Test",
  description: "Free online tools for Nepal students: NEB GPA Calculator, Attendance Calculator, Nepali typing practice for Lok Sewa exam, English typing test for government job prep, and Hindi typing practice.",
  url: "https://www.studenthubnp.com/tools",
  numberOfItems: 4,
  itemListElement: [
    {
      "@type": "ListItem", position: 1,
      name: "NEB GPA Calculator Nepal 2082 2083",
      url: "https://www.studenthubnp.com/tools/gpa-calculator",
      description: "Free NEB Class 12 GPA calculator using official formula — 75% Theory + 25% Practical. Science and Management streams.",
    },
    {
      "@type": "ListItem", position: 2,
      name: "Attendance Calculator — How Many Classes Can I Miss?",
      url: "https://www.studenthubnp.com/tools/attendance-calculator",
      description: "Free attendance percentage calculator. Find how many classes you can miss or bunk, or how many you need to reach 75%, 80%, or any required percentage.",
    },
    {
      "@type": "ListItem", position: 3,
      name: "नेपाली टाइपिंग अभ्यास | Nepali Hindi Typing Practice — Lok Sewa Exam",
      url: "https://www.studenthubnp.com/tools/nepali-typing",
      description: "Free Nepali and Hindi typing practice with virtual keyboard, hand guide, Easy/Medium/Hard levels, WPM and accuracy tracking. Ideal for Lok Sewa Aayog typing exam preparation.",
    },
    {
      "@type": "ListItem", position: 4,
      name: "English Typing Practice Online — Government Job Typing Test Nepal",
      url: "https://www.studenthubnp.com/tools/english-typing",
      description: "Free English typing speed test for Nepal government job exams, Lok Sewa Aayog, banking, and civil service recruitment. Real-time WPM and accuracy tracking.",
    },
  ],
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.studenthubnp.com" },
    { "@type": "ListItem", position: 2, name: "Tools", item: "https://www.studenthubnp.com/tools" },
  ],
};

const tools = [
  {
    href: "/tools/gpa-calculator",
    icon: Calculator,
    color: "bg-blue-50 text-blue-600",
    badge: "Nepal",
    badgeColor: "bg-blue-100 text-blue-700",
    title: "NEB GPA Calculator",
    desc: "Calculate your Class 12 GPA using the official NEB grading system — Science or Management faculty.",
    cta: "Calculate GPA",
  },
  {
    href: "/tools/attendance-calculator",
    icon: CalendarCheck,
    color: "bg-green-50 text-green-600",
    badge: "Global",
    badgeColor: "bg-green-100 text-green-700",
    title: "Attendance Calculator",
    desc: "Find out how many classes you can miss, or how many you need to reach your required attendance percentage.",
    cta: "Check Attendance",
  },
  {
    href: "/tools/nepali-typing",
    icon: Keyboard,
    color: "bg-orange-50 text-orange-600",
    badge: "Lok Sewa",
    badgeColor: "bg-orange-100 text-orange-700",
    title: "नेपाली टाइपिंग अभ्यास",
    desc: "Free Nepali & Hindi typing practice — virtual keyboard, finger guide, Easy/Medium/Hard levels, live WPM. Perfect for Lok Sewa exam prep.",
    cta: "Practice Nepali Typing",
  },
  {
    href: "/tools/english-typing",
    icon: Globe,
    color: "bg-purple-50 text-purple-600",
    badge: "Govt Job",
    badgeColor: "bg-purple-100 text-purple-700",
    title: "English Typing Test",
    desc: "Free English typing speed test for government job exams, Lok Sewa Aayog, banking recruitment and civil service positions. WPM + accuracy tracked.",
    cta: "Start English Typing",
  },
];

export default function Tools() {
  return (
    <>
      <Helmet>
        <title>Free Student Tools — NEB GPA Calculator, Nepali Typing Practice, English Typing Test | Student Hub Nepal</title>
        <meta name="description" content="Free student tools for Nepal: NEB GPA Calculator for Class 12 (2082/2083), Attendance Calculator, Nepali typing practice for Lok Sewa exam (लोकसेवा टाइपिंग), English typing test for government jobs, and Hindi typing practice. All instant, free, no sign-up." />
        <meta name="keywords" content="NEB GPA calculator Nepal, attendance calculator, nepali typing practice, lok sewa typing test, english typing test nepal, english typing for government job, hindi typing practice, नेपाली टाइपिंग, class 12 GPA calculator Nepal, how many classes can I miss, student tools Nepal, free calculator for students, devanagari typing, government job typing test nepal, sarkari jagir typing" />
        <meta property="og:title" content="Free Student Tools — GPA Calculator, Nepali Typing, English Typing Test | Student Hub" />
        <meta property="og:description" content="Free NEB GPA Calculator, Attendance Calculator, Nepali typing for Lok Sewa, and English typing test for government jobs. Instant, no sign-up." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/tools" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Free Student Tools — NEB GPA Calculator, Typing Practice | Student Hub" />
        <meta name="twitter:description" content="Free NEB GPA Calculator, Attendance Calculator, Nepali & English Typing Practice. No sign-up needed." />
        <link rel="canonical" href="https://www.studenthubnp.com/tools" />
        <script type="application/ld+json">{JSON.stringify(TOOLS_ITEMLIST_SCHEMA)}</script>
        <script type="application/ld+json">{JSON.stringify(BREADCRUMB_SCHEMA)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Student Tools</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Free tools built for Nepal students — no sign-up needed.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {tools.map(({ href, icon: Icon, color, badge, badgeColor, title, desc, cta }) => (
            <Link key={href} href={href}>
              <div className="group bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
                </div>
                <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{desc}</p>
                <div className="flex items-center gap-1.5 mt-5 text-sm font-semibold text-blue-600 group-hover:gap-3 transition-all">
                  {cta} <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
