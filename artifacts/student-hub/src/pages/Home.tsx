import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, FileText, Brain, MessageCircle, Timer, CheckSquare, Trophy, ArrowRight, LogIn, Sparkles } from "lucide-react";
import { useListNotes, useListPyqs } from "@workspace/api-client-react";

const features = [
  { icon: BookOpen,      label: "Study Notes",       desc: "Notes by grade, subject & chapter",  href: "/notes",      color: "bg-blue-50 text-blue-600",    public: true  },
  { icon: FileText,      label: "PYQ Papers",        desc: "Past exam papers with viewer",        href: "/pyqs",       color: "bg-orange-50 text-orange-600", public: true  },
  { icon: Brain,         label: "MCQ Practice",      desc: "Thousands of practice questions",     href: "/mcq",        color: "bg-purple-50 text-purple-600", public: false },
  { icon: MessageCircle, label: "Nep AI",             desc: "AI study assistant for any topic",    href: "/ai",         color: "bg-indigo-50 text-indigo-600", public: false },
  { icon: Timer,         label: "Pomodoro Timer",     desc: "Focus timer for study sessions",      href: "/pomodoro",   color: "bg-red-50 text-red-600",       public: false },
  { icon: CheckSquare,   label: "To-Do List",         desc: "Track your study tasks",              href: "/todo",       color: "bg-green-50 text-green-600",   public: false },
  { icon: Trophy,        label: "Leaderboard",        desc: "Top MCQ scorers daily & all-time",    href: "/leaderboard",color: "bg-amber-50 text-amber-600",   public: false },
];

export default function Home() {
  const { user, loading, signInWithGoogle } = useAuth();

  const { data: notes } = useListNotes({ grade: 10 }, { query: { queryKey: ["notes-preview"] } });
  const { data: pyqs } = useListPyqs({ grade: 10 }, { query: { queryKey: ["pyqs-preview"] } });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
        <meta name="description" content="Free notes, past papers (PYQs), MCQ practice, and AI study assistant for Grade 9–12 students in Nepal. SEE and NEB exam preparation." />
        <meta name="keywords" content="student hub nepal, grade 10 notes, SEE preparation, NEB notes, PYQ nepal, MCQ practice nepal" />
        <meta property="og:title" content="Student Hub — Free Study Platform for Nepal Students" />
        <meta property="og:description" content="Notes, PYQs, MCQ practice and AI tools for Grade 9–12 students in Nepal. Free forever." />
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-base font-semibold text-gray-900">Student Hub</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
              <Link href="/notes" className="hover:text-blue-600 transition-colors">Notes</Link>
              <Link href="/pyqs" className="hover:text-blue-600 transition-colors">PYQs</Link>
              <Link href="/about" className="hover:text-blue-600 transition-colors">About</Link>
            </nav>
            <Link href="/login" className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-all">
              <LogIn className="w-3.5 h-3.5" /> Login
            </Link>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white pt-16 pb-20 px-4">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-40" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-30" />
          </div>
          <div className="relative max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-5">
              <Sparkles className="w-3 h-3" /> Free for every Nepali student
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
              Study smarter.<br />
              <span className="text-blue-500">Rank higher.</span>
            </h1>
            <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
              Notes, past papers, MCQ practice and an AI tutor — all in one place.
              Built for Grade 9–12 students across Nepal.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/notes"
                className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-500 text-white rounded-2xl font-semibold text-base hover:bg-blue-600 transition-all shadow-lg shadow-blue-200"
              >
                <BookOpen className="w-5 h-5" /> Browse Notes
              </Link>
              <button
                onClick={signInWithGoogle}
                className="flex items-center justify-center gap-2 px-7 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-semibold text-base hover:bg-gray-50 transition-all shadow-sm"
              >
                <LogIn className="w-4 h-4" /> Login — It's free
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">No credit card required · Sign in with Google</p>
          </div>
        </section>

        {/* ── Features grid ── */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Everything you need to study</h2>
          <p className="text-gray-500 text-center mb-10 text-sm">Public content is free for everyone. Login to unlock tools.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, label, desc, href, color, public: isPublic }) => (
              <Link key={href} href={href}>
                <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                  {!isPublic && (
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                      Login
                    </span>
                  )}
                  <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
                  <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Recent Notes preview ── */}
        {notes && notes.length > 0 && (
          <section className="bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Recent Notes</h2>
                <Link href="/notes" className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
                  See all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid gap-2">
                {notes.slice(0, 5).map(note => (
                  <Link key={note.id} href={`/notes/${note.id}`}>
                    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-3.5 hover:border-blue-100 hover:shadow-sm transition-all">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        note.contentType === "pdf" ? "bg-red-50" : note.contentType === "image" ? "bg-purple-50" : "bg-blue-50"
                      }`}>
                        <BookOpen className={`w-4 h-4 ${
                          note.contentType === "pdf" ? "text-red-500" : note.contentType === "image" ? "text-purple-500" : "text-blue-500"
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{note.title}</p>
                        <p className="text-xs text-gray-500">{note.subject} · Grade {note.grade}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Recent PYQs preview ── */}
        {pyqs && pyqs.length > 0 && (
          <section className="py-12 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Recent Past Papers</h2>
                <Link href="/pyqs" className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
                  See all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid gap-2">
                {pyqs.slice(0, 5).map(pyq => (
                  <Link key={pyq.id} href={`/pyq/${pyq.id}`}>
                    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-3.5 hover:border-orange-100 hover:shadow-sm transition-all">
                      <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{pyq.title}</p>
                        <p className="text-xs text-gray-500">{pyq.subject} · {pyq.year} · Grade {pyq.grade}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CTA Banner ── */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Ready to ace your exams?</h2>
            <p className="text-blue-100 text-sm mb-7">
              Join thousands of Nepali students using Student Hub to prepare for SEE and NEB.
            </p>
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-600 rounded-2xl font-bold text-base hover:bg-blue-50 transition-all shadow-xl shadow-blue-800/20"
            >
              <LogIn className="w-5 h-5" /> Get Full Access — Free
            </button>
          </div>
        </section>

        {/* ── Mobile bottom nav ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 shadow-lg">
          <div className="flex items-center justify-around h-16 px-2">
            {[
              { href: "/",          icon: BookOpen,  label: "Home"    },
              { href: "/notes",     icon: BookOpen,  label: "Notes"   },
              { href: "/pyqs",      icon: FileText,  label: "PYQs"    },
              { href: "/about",     icon: Sparkles,  label: "About"   },
              { href: "/login",     icon: LogIn,     label: "Login"   },
            ].map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href}>
                <div className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[52px] ${
                  href === "/" ? "text-blue-600" : "text-gray-400"
                }`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </nav>

        {/* ── Footer ── */}
        <footer className="bg-gray-900 py-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
                <BookOpen className="w-3 h-3 text-white" />
              </div>
              <span className="text-white font-medium text-sm">Student Hub</span>
            </div>
            <nav className="flex gap-5 text-xs text-gray-400">
              <Link href="/notes" className="hover:text-white transition-colors">Notes</Link>
              <Link href="/pyqs" className="hover:text-white transition-colors">PYQs</Link>
              <Link href="/about" className="hover:text-white transition-colors">About</Link>
              <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
            </nav>
            <p className="text-xs text-gray-500">© {new Date().getFullYear()} Student Hub · Built by Siddhant Lamichhane</p>
          </div>
        </footer>
      </div>
    </>
  );
}
