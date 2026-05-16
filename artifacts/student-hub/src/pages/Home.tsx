import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpen, FileText, BarChart2, MessageCircle, Timer, CheckSquare, Trophy, ArrowRight, LogIn, Sparkles } from "lucide-react";

const features = [
  { icon: BookOpen,      label: "Study Notes",       desc: "Notes by grade, subject & chapter",  href: "/notes",      color: "bg-blue-50 text-blue-600",    public: true  },
  { icon: FileText,      label: "PYQ Papers",        desc: "Past exam papers with viewer",        href: "/pyqs",       color: "bg-orange-50 text-orange-600", public: true  },
  { icon: BarChart2,     label: "Report Card",       desc: "Track your study time and progress",  href: "/report",     color: "bg-purple-50 text-purple-600", public: false },
  { icon: MessageCircle, label: "Nep AI",             desc: "AI study assistant for any topic",    href: "/ai",         color: "bg-indigo-50 text-indigo-600", public: false },
  { icon: Timer,         label: "Pomodoro Timer",     desc: "Focus timer for study sessions",      href: "/pomodoro",   color: "bg-red-50 text-red-600",       public: false },
  { icon: CheckSquare,   label: "To-Do List",         desc: "Track your study tasks",              href: "/todo",       color: "bg-green-50 text-green-600",   public: false },
  { icon: Trophy,        label: "Leaderboard",        desc: "Top students by study time & streak", href: "/leaderboard",color: "bg-amber-50 text-amber-600",   public: false },
];

const SITE_URL = "https://studenthub.np";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      "url": SITE_URL,
      "name": "Student Hub Nepal",
      "description": "Free study platform for Grade 9–12 students in Nepal. Notes, PYQs, AI tutor, and progress tracking.",
      "inLanguage": "en-NP",
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": `${SITE_URL}/notes?q={search_term_string}` },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      "name": "Student Hub Nepal",
      "url": SITE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/icon-192.png`,
        "width": 192,
        "height": 192
      },
      "description": "Free educational platform built for Grade 9–12 students across Nepal.",
      "sameAs": []
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      "url": SITE_URL,
      "name": "Student Hub — Free Study Platform for Grade 9–12 Students in Nepal",
      "isPartOf": { "@id": `${SITE_URL}/#website` },
      "about": { "@id": `${SITE_URL}/#organization` },
      "description": "Free notes, past papers (PYQs), AI study assistant and progress tracking for Grade 9–12 students in Nepal."
    }
  ]
};

interface PreviewNote { id: string; title: string; subject: string; grade: number; contentType: string }
interface PreviewPyq  { id: string; title: string; subject: string; grade: number; year: number }

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [notes, setNotes] = useState<PreviewNote[]>([]);
  const [pyqs, setPyqs] = useState<PreviewPyq[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, "notes"), where("grade", "==", 10)))
      .then(s => {
        const all = s.docs.map(d => ({ id: d.id, ...d.data() } as PreviewNote));
        all.sort((a: any, b: any) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        setNotes(all.slice(0, 5));
      })
      .catch(console.error);
    getDocs(query(collection(db, "pyqs"), where("grade", "==", 10)))
      .then(s => {
        const all = s.docs.map(d => ({ id: d.id, ...d.data() } as PreviewPyq));
        all.sort((a: any, b: any) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        setPyqs(all.slice(0, 5));
      })
      .catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (user) {
    window.location.replace("/dashboard");
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Student Hub — Free Study Platform for Grade 9–12 Students in Nepal</title>
        <meta name="description" content="Free notes, past papers (PYQs), AI study assistant and progress tracking for Grade 9–12 students in Nepal. SEE and NEB exam preparation." />
        <meta name="keywords" content="student hub nepal, grade 10 notes, SEE preparation, NEB notes, PYQ nepal, study tracker nepal, free notes nepal, SEE 2080" />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:title" content="Student Hub — Free Study Platform for Nepal Students" />
        <meta property="og:description" content="Notes, PYQs, Nep AI and study tracking for Grade 9–12 students in Nepal. Free forever." />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Student Hub — Free Study Platform for Nepal Students" />
        <meta name="twitter:description" content="Notes, PYQs, Nep AI and study tracking for Grade 9–12 students in Nepal." />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white pt-16 pb-20 px-4" aria-label="Hero">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-40" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-30" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-5">
            <Sparkles className="w-3 h-3" aria-hidden="true" /> Free for every Nepali student
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Study smarter.<br />
            <span className="text-blue-500">Rank higher.</span>
          </h1>
          <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
            Notes, past papers, AI tutor and progress tracking — all in one place.
            Built for Grade 9–12 students across Nepal.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/notes"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-500 text-white rounded-2xl font-semibold text-base hover:bg-blue-600 transition-all shadow-lg shadow-blue-200"
              aria-label="Browse free study notes for Grade 9 to 12"
            >
              <BookOpen className="w-5 h-5" aria-hidden="true" /> Browse Notes
            </Link>
            <button
              onClick={() => setLocation("/login")}
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-semibold text-base hover:bg-gray-50 transition-all shadow-sm"
              aria-label="Register for free with Google"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" /> Register — It's free
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">No credit card required · Sign in with Google</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-2xl font-bold text-gray-900 text-center mb-2">Everything you need to study</h2>
        <p className="text-gray-500 text-center mb-10 text-sm">Public content is free for everyone. Register to unlock tools.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, label, desc, href, color, public: isPublic }) => (
            <Link key={href} href={href} aria-label={label}>
              <article className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                {!isPublic && (
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                    Register
                  </span>
                )}
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`} aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
                <p className="text-xs text-gray-500 leading-snug">{desc}</p>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {notes.length > 0 && (
        <section className="bg-gray-50 py-12 px-4" aria-labelledby="recent-notes-heading">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 id="recent-notes-heading" className="text-xl font-bold text-gray-900">Recent Notes</h2>
              <Link href="/notes" className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" aria-label="See all study notes">
                See all <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid gap-2" role="list">
              {notes.map(note => (
                <li key={note.id}>
                  <Link href={`/notes/${note.id}`} aria-label={`${note.title} — ${note.subject} Grade ${note.grade}`}>
                    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-3.5 hover:border-blue-100 hover:shadow-sm transition-all">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        note.contentType === "pdf" ? "bg-red-50" : note.contentType === "image" ? "bg-purple-50" : "bg-blue-50"
                      }`} aria-hidden="true">
                        <BookOpen className={`w-4 h-4 ${
                          note.contentType === "pdf" ? "text-red-500" : note.contentType === "image" ? "text-purple-500" : "text-blue-500"
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{note.title}</p>
                        <p className="text-xs text-gray-500">{note.subject} · Grade {note.grade}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {pyqs.length > 0 && (
        <section className="py-12 px-4" aria-labelledby="recent-pyqs-heading">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 id="recent-pyqs-heading" className="text-xl font-bold text-gray-900">Recent Past Papers</h2>
              <Link href="/pyqs" className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline" aria-label="See all previous year question papers">
                See all <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid gap-2" role="list">
              {pyqs.map(pyq => (
                <li key={pyq.id}>
                  <Link href={`/pyq/${pyq.id}`} aria-label={`${pyq.title} — ${pyq.subject} ${pyq.year} Grade ${pyq.grade}`}>
                    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-3.5 hover:border-orange-100 hover:shadow-sm transition-all">
                      <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0" aria-hidden="true">
                        <FileText className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{pyq.title}</p>
                        <p className="text-xs text-gray-500">{pyq.subject} · {pyq.year} · Grade {pyq.grade}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <footer className="py-8 px-4 border-t border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Student Hub · Free for every Nepali student</p>
          <nav aria-label="Footer links">
            <ul className="flex items-center gap-4 text-xs text-gray-400">
              <li><Link href="/about"   className="hover:text-gray-600 transition-colors">About</Link></li>
              <li><Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms"   className="hover:text-gray-600 transition-colors">Terms of Use</Link></li>
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
