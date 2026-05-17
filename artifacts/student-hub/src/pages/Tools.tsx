import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Calculator, CalendarCheck, ArrowRight } from "lucide-react";

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
];

export default function Tools() {
  return (
    <>
      <Helmet>
        <title>Student Tools — GPA & Attendance Calculator | Student Hub</title>
        <meta name="description" content="Free student tools: NEB GPA Calculator for Nepal Class 12, and a universal Attendance Calculator. Fast, accurate, and easy to use." />
        <meta property="og:title" content="Student Tools — Student Hub" />
        <meta property="og:description" content="Calculate your NEB GPA or check your attendance percentage instantly." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Student Tools</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">Free calculators built for students — no sign-up needed.</p>
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
