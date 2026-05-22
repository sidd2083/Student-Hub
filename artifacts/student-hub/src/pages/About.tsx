import { Helmet } from "react-helmet-async";
import { BookOpen, Users, Target, Mail } from "lucide-react";

export default function About() {
  return (
    <>
      <Helmet>
        <title>About Student Hub Nepal — Nepal's #1 Free Study Platform</title>
        <meta name="description" content="Student Hub Nepal is 100% free — notes, past papers, AI tutor &amp; Pomodoro for Grade 9–12 SEE &amp; NEB students. Built by Nepali students, for Nepali students. No fees, ever." />
        <meta name="keywords" content="about student hub nepal, student hub nepal, free study platform nepal, best study platform nepal, NEB study platform, SEE preparation nepal, free education nepal, nepal study app, study platform grade 9 10 11 12, free learning nepal, Nep AI tutor, pomodoro study nepal, student hub mission, free notes nepal, free PYQ nepal, student hub features" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="author" content="Student Hub Nepal" />
        <meta name="geo.region" content="NP" />
        <meta name="geo.placename" content="Nepal" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://studenthubnp.com/about" />
        <meta property="og:title" content="About Student Hub Nepal — Nepal's #1 Free Study Platform" />
        <meta property="og:description" content="Student Hub Nepal is 100% free — notes, past papers, AI tutor &amp; Pomodoro for Grade 9–12 SEE &amp; NEB students. Built for Nepali students." />
        <meta property="og:image" content="https://studenthubnp.com/opengraph.jpg" />
        <meta property="og:image:alt" content="Student Hub Nepal — Free Study Platform for Grade 9 to 12" />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <meta property="og:locale" content="en_NP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About Student Hub Nepal — Nepal's #1 Free Study Platform" />
        <meta name="twitter:description" content="Student Hub Nepal is 100% free — notes, past papers, AI tutor &amp; Pomodoro for Grade 9–12 SEE &amp; NEB students. No fees, ever." />
        <meta name="twitter:image" content="https://studenthubnp.com/opengraph.jpg" />
        <link rel="canonical" href="https://studenthubnp.com/about" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Student Hub Nepal",
          "url": "https://studenthubnp.com",
          "logo": "https://studenthubnp.com/opengraph.jpg",
          "description": "Student Hub Nepal is a free study platform for Grade 9–12 students preparing for SEE and NEB exams in Nepal. Offers notes, past papers, AI tutor (Nep AI), Pomodoro timer, and progress tracking.",
          "areaServed": "NP",
          "foundingDate": "2024",
          "sameAs": [],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "email": "info@studenthubnp.com",
            "availableLanguage": ["English", "Nepali"]
          }
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://studenthubnp.com" },
            { "@type": "ListItem", "position": 2, "name": "About", "item": "https://studenthubnp.com/about" }
          ]
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">About Student Hub</h1>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              A free, modern study platform built for Nepali students in Grades 9–12.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Target,
                title: "Our Mission",
                desc: "Make quality study materials accessible to every student in Nepal — completely free.",
                color: "bg-blue-50 text-blue-600",
              },
              {
                icon: Users,
                title: "Who It's For",
                desc: "Students preparing for SEE, NEB, and grade-wise exams across all subjects.",
                color: "bg-green-50 text-green-600",
              },
              {
                icon: Mail,
                title: "Get In Touch",
                desc: "Have feedback or suggestions? We'd love to hear from you. Reach out anytime.",
                color: "bg-purple-50 text-purple-600",
              },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What We Offer</h2>
            <div className="space-y-3">
              {[
                ["📚", "Study Notes", "Free study notes for Grade 9–12 — Maths, Science, English, Social Studies, Physics, Chemistry, Biology, Computer Science. Text, PDF and image formats."],
                ["📄", "Previous Year Questions (PYQ)", "Free SEE and NEB past papers from 2076 to 2081 BS, all subjects, all provinces."],
                ["🧮", "NEB GPA Calculator", "Free GPA calculator for NEB Grade 11 & 12 — official 75% Theory + 25% Practical formula, Science & Management streams."],
                ["📅", "Attendance Calculator", "Free attendance calculator — find your current attendance %, how many classes you can miss or bunk, and exactly how many to attend to recover."],
                ["📊", "Report Card", "Track your study time, streak, and progress with daily analytics and badges."],
                ["🤖", "Nep AI", "An AI study assistant that answers your academic questions in seconds."],
                ["⏱", "Pomodoro Timer", "Built-in focus timer to help you study smarter with the 25-minute Pomodoro technique."],
                ["✅", "To-Do", "Task manager to keep your study schedule on track."],
              ].map(([emoji, feature, desc]) => (
                <div key={feature as string} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xl flex-shrink-0">{emoji}</span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{feature}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">About Us &amp; Our Expertise</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Student Hub Nepal is a product of <strong>Tufan Production</strong> — a Nepal-based edtech team dedicated to making quality education free and accessible for every student across the country.
              Launched in 2024, Student Hub is used daily by thousands of students preparing for <strong>SEE (Grade 10)</strong> and <strong>NEB (Grade 11 &amp; 12)</strong> board examinations.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Our tools, notes and past papers are built with deep knowledge of the <strong>NEB curriculum</strong> and the <strong>Bikram Sambat (BS) academic calendar</strong>.
              The <strong>NEB GPA Calculator</strong> uses the official NEB grading formula as published by the National Examinations Board of Nepal — the same formula used by exam centres across all provinces.
              The <strong>Attendance Calculator</strong> covers the 75% UGC rule (India), Australia's ESOS Act 80% requirement, UK Student Visa attendance requirements and more.
            </p>
            <p className="text-gray-600 leading-relaxed mb-5">
              All content is reviewed and updated every academic year to stay aligned with the latest NEB curriculum changes.
              Our study notes are curated from reliable Nepali textbooks and reference materials approved for SEE and NEB examinations.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              {[
                { num: "2024", label: "Year founded" },
                { num: "NP", label: "Verified for Nepal" },
                { num: "Free", label: "Always, no fees" },
              ].map(({ num, label }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-2xl font-black text-blue-600 mb-1">{num}</p>
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">Our most-used tools</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <a href="/tools/gpa-calculator" className="flex items-center gap-3 bg-white rounded-xl p-3 border border-blue-100 hover:border-blue-300 transition-all">
                <span className="text-2xl">🧮</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">NEB GPA Calculator Nepal</p>
                  <p className="text-xs text-gray-500">Grade 11 &amp; 12, Science &amp; Management 2082/2083</p>
                </div>
              </a>
              <a href="/tools/attendance-calculator" className="flex items-center gap-3 bg-white rounded-xl p-3 border border-blue-100 hover:border-blue-300 transition-all">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Attendance Calculator</p>
                  <p className="text-xs text-gray-500">How many classes can I miss or bunk?</p>
                </div>
              </a>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

