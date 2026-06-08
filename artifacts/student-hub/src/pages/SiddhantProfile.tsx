import { Helmet } from "react-helmet-async";
import { MapPin, ExternalLink } from "lucide-react";

const SITE_URL = "https://www.studenthubnp.com";

export default function SiddhantProfile() {
  return (
    <>
      <Helmet>
        <title>Siddhant Lamichhane — Founder &amp; CEO, Student Hub Nepal</title>
        <meta
          name="description"
          content="Siddhant Lamichhane is the Founder and CEO of Student Hub Nepal. A Grade 11 student from Hetauda, Nepal — builder, freelancer, and AI/ML learner."
        />
        <meta
          name="keywords"
          content="Siddhant Lamichhane, siddhant lamichhane student hub nepal, siddhant lamichhane founder ceo, siddhant lamichhane nepal, siddhant lamichhane hetauda, student hub nepal founder, student hub nepal ceo, student hub nepal owner"
        />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
        <meta name="author" content="Siddhant Lamichhane" />
        <link rel="canonical" href={`${SITE_URL}/siddhant-lamichhane`} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={`${SITE_URL}/siddhant-lamichhane`} />
        <meta property="og:title" content="Siddhant Lamichhane — Founder &amp; CEO, Student Hub Nepal" />
        <meta property="og:description" content="Siddhant Lamichhane is the Founder and CEO of Student Hub Nepal. A Grade 11 student from Hetauda, Nepal — builder, freelancer, and AI/ML learner." />
        <meta property="og:image" content={`${SITE_URL}/opengraph.jpg`} />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <meta property="og:locale" content="en_NP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Siddhant Lamichhane — Founder &amp; CEO, Student Hub Nepal" />
        <meta name="twitter:description" content="Founder &amp; CEO of Student Hub Nepal. Builder, freelancer, AI/ML learner from Hetauda, Nepal." />
        <meta name="twitter:image" content={`${SITE_URL}/opengraph.jpg`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          "@id": `${SITE_URL}/siddhant-lamichhane`,
          "name": "Siddhant Lamichhane",
          "jobTitle": "Founder & CEO",
          "description": "Siddhant Lamichhane is the Founder and CEO of Student Hub Nepal — a free study platform for Grade 9–12 students in Nepal. He is a Grade 11 student from Hetauda, Makwanpur, Bagmati Pradesh, Nepal, passionate about building products, freelancing, and learning AI/ML.",
          "url": `${SITE_URL}/siddhant-lamichhane`,
          "sameAs": [
            "https://www.instagram.com/lmc_siddhant.7/",
            `${SITE_URL}/about`
          ],
          "worksFor": {
            "@type": "Organization",
            "name": "Student Hub Nepal",
            "url": SITE_URL
          },
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Hetauda",
            "addressRegion": "Bagmati Pradesh",
            "addressCountry": "NP"
          },
          "nationality": { "@type": "Country", "name": "Nepal" },
          "knowsAbout": [
            "Student Hub Nepal",
            "Nepal Education",
            "NEB Exam Preparation",
            "Artificial Intelligence",
            "Machine Learning",
            "Web Development",
            "Freelancing"
          ]
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20">

          {/* ── Identity ─────────────────────────────────────────────── */}
          <div className="mb-12">
            <div className="flex items-start gap-5 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white text-2xl font-bold select-none">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">Siddhant Lamichhane</h1>
                <p className="text-sm text-blue-600 font-medium mt-0.5">Founder &amp; CEO — Student Hub Nepal</p>
                <div className="flex items-center gap-1 mt-1.5 text-gray-400">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs">Hetauda, Makwanpur, Nepal</span>
                </div>
              </div>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed">
              Grade 11 student from Hetauda with a thing for building products from scratch.
              I founded Student Hub Nepal to make quality study resources free and accessible
              for every student in Nepal. Currently learning AI/ML, doing freelance work,
              and always looking for the next thing to build.
            </p>
          </div>

          {/* ── Now ──────────────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Now</h2>
            <div className="space-y-3">
              {[
                { label: "Studying", value: "Grade 11, Hetauda" },
                { label: "Building", value: "Student Hub Nepal" },
                { label: "Learning", value: "AI / ML" },
                { label: "Working", value: "Freelancing" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-3">
                  <span className="text-xs font-semibold text-gray-400 w-16 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-700">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Projects ─────────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Projects</h2>
            <div className="space-y-3">

              {/* Student Hub Nepal */}
              <a
                href="https://www.studenthubnp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-blue-600" viewBox="0 0 180 180" fill="none">
                    <path d="M90 44 C90 44 56 39 36 48 L36 136 C56 127 90 132 90 132 L90 44Z" fill="currentColor" fillOpacity=".8"/>
                    <path d="M90 44 C90 44 124 39 144 48 L144 136 C124 127 90 132 90 132 L90 44Z" fill="currentColor" fillOpacity=".4"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">Student Hub Nepal</p>
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md">Live</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Free study platform for Grade 9–12 students in Nepal — notes, PYQs, AI tutor, leaderboard, and more. Built and maintained solo.
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1.5">studenthubnp.com</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0 mt-1" />
              </a>

              {/* GS Confession */}
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">GS Confession</p>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-md">First big project</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    A student social networking site where students could share anonymous confessions and connect with their peers.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* ── Interests ────────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {["Building products", "AI / ML", "Freelancing", "Web development", "Education tech", "Open source"].map(tag => (
                <span key={tag} className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-xs text-gray-600 font-medium shadow-sm">
                  {tag}
                </span>
              ))}
            </div>
          </section>

          {/* ── Contact ──────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Contact</h2>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.instagram.com/lmc_siddhant.7/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-700 font-medium shadow-sm hover:border-pink-200 hover:text-pink-600 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Instagram
              </a>
              <a
                href={`${SITE_URL}/about`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-700 font-medium shadow-sm hover:border-blue-200 hover:text-blue-600 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                About Student Hub
              </a>
              <a
                href="mailto:contact@studenthubnp.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm text-gray-700 font-medium shadow-sm hover:border-gray-300 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Email
              </a>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
