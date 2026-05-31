import { Helmet } from "react-helmet-async";
import { BookOpen, Users, Target, Mail, Instagram } from "lucide-react";

export default function About() {
  return (
    <>
      <Helmet>
        <title>About Student Hub Nepal — Nepal's #1 Free Study Platform</title>
        <meta name="description" content="Student Hub Nepal is 100% free — notes, past papers, AI tutor &amp; Pomodoro for Grade 9–12 SEE &amp; NEB students. Built by Siddhant Lamichhane. No fees, ever." />
        <meta name="keywords" content="about student hub nepal, siddhant lamichhane student hub, student hub nepal founder, student hub nepal, free study platform nepal, best study platform nepal, NEB study platform, SEE preparation nepal, free education nepal, nepal study app, study platform grade 9 10 11 12, free learning nepal, Nep AI tutor, pomodoro study nepal, student hub mission, free notes nepal, free PYQ nepal, student hub features" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="author" content="Siddhant Lamichhane" />
        <meta name="geo.region" content="NP" />
        <meta name="geo.placename" content="Nepal" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/about" />
        <meta property="og:title" content="About Student Hub Nepal — Nepal's #1 Free Study Platform" />
        <meta property="og:description" content="Student Hub Nepal is 100% free — notes, past papers, AI tutor &amp; Pomodoro for Grade 9–12 SEE &amp; NEB students. Built by Siddhant Lamichhane." />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta property="og:image:alt" content="Student Hub Nepal — Free Study Platform for Grade 9 to 12" />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <meta property="og:locale" content="en_NP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About Student Hub Nepal — Nepal's #1 Free Study Platform" />
        <meta name="twitter:description" content="Student Hub Nepal is 100% free — notes, past papers, AI tutor &amp; Pomodoro for Grade 9–12 SEE &amp; NEB students. Built by Siddhant Lamichhane." />
        <meta name="twitter:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <link rel="canonical" href="https://www.studenthubnp.com/about" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Student Hub Nepal",
          "url": "https://www.studenthubnp.com",
          "logo": "https://www.studenthubnp.com/opengraph.jpg",
          "description": "Student Hub Nepal is a free study platform for Grade 9–12 students preparing for SEE and NEB exams in Nepal. Offers notes, past papers, AI tutor (Nep AI), Pomodoro timer, and progress tracking.",
          "areaServed": "NP",
          "foundingDate": "2024",
          "founder": {
            "@type": "Person",
            "name": "Siddhant Lamichhane",
            "jobTitle": "Founder & Developer",
            "url": "https://www.studenthubnp.com/about",
            "sameAs": ["https://www.instagram.com/lmc_siddhant.7/"]
          },
          "sameAs": ["https://www.instagram.com/lmc_siddhant.7/"],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "email": "contact@studenthubnp.com",
            "availableLanguage": ["English", "Nepali"]
          }
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          "name": "Siddhant Lamichhane",
          "jobTitle": "Founder & Developer",
          "description": "Siddhant Lamichhane is the founder and developer of Student Hub Nepal — Nepal's leading free study platform for Grade 9–12 students preparing for SEE and NEB exams.",
          "url": "https://www.studenthubnp.com/about",
          "sameAs": ["https://www.instagram.com/lmc_siddhant.7/"],
          "worksFor": {
            "@type": "Organization",
            "name": "Student Hub Nepal",
            "url": "https://www.studenthubnp.com"
          },
          "nationality": { "@type": "Country", "name": "Nepal" }
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.studenthubnp.com" },
            { "@type": "ListItem", "position": 2, "name": "About", "item": "https://www.studenthubnp.com/about" }
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
                ["📚", "Notes", "Study notes organized by grade, subject, and chapter — text, PDF, and image formats."],
                ["📄", "Previous Year Questions (PYQ)", "Past exam papers from various provinces and boards."],
                ["📊", "Report Card", "Track your study time, streak, and progress with daily analytics and badges."],
                ["🤖", "Nep AI", "An AI study assistant that answers your academic questions in seconds."],
                ["⏱", "Pomodoro Timer", "Built-in focus timer to help you study smarter."],
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

          {/* ── Founder section ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Meet the Founder</h2>
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <span className="text-white text-2xl font-bold">S</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-gray-900">Siddhant Lamichhane</p>
                <p className="text-sm text-blue-600 font-medium mb-3">Founder &amp; Developer, Student Hub Nepal</p>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Siddhant Lamichhane is a passionate student and developer from Nepal who built Student Hub Nepal
                  to give every Nepali student — regardless of their location or economic background — access to
                  high-quality study materials, AI tutoring, and smart study tools, completely free.
                </p>
                <a
                  href="https://www.instagram.com/lmc_siddhant.7/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Instagram className="w-4 h-4" />
                  Follow on Instagram
                </a>
              </div>
            </div>
          </div>

          {/* ── Contact CTA ──────────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-gray-900 mb-1">Got a suggestion or bug to report?</p>
              <p className="text-sm text-gray-500">Reach us at <a href="mailto:contact@studenthubnp.com" className="text-blue-600 font-medium hover:underline">contact@studenthubnp.com</a> or DM on Instagram.</p>
            </div>
            <a
              href="/contact"
              className="flex-shrink-0 px-5 py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-all text-center"
            >
              Contact Us
            </a>
          </div>
        </main>
      </div>
    </>
  );
}
