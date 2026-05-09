import { useState, useEffect } from "react";
import { Link } from "wouter";
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

interface PreviewNote { id: string; title: string; subject: string; grade: number; contentType: string }
interface PreviewPyq  { id: string; title: string; subject: string; grade: number; year: number }

export default function Home() {
  const { user, loading, signInWithGoogle } = useAuth();
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
        <meta name="description" content="Free notes, past papers (PYQs), AI study assistant and progress tracking for Grade 9–12 students in Nepal. SEE and NEB exam preparation." />
        <meta name="keywords" content="student hub nepal, grade 10 notes, SEE preparation, NEB notes, PYQ nepal, study tracker nepal" />
        <meta property="og:title" content="Student Hub — Free Study Platform for Nepal Students" />
        <meta property="og:description" content="Notes, PYQs, Nep AI and study tracking for Grade 9–12 students in Nepal. Free forever." />
      </Helmet>

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
            Notes, past papers, AI tutor and progress tracking — all in one place.
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
              <LogIn className="w-4 h-4" /> Register — It's free
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-4">No credit card required · Sign in with Google</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Everything you need to study</h2>
        <p className="text-gray-500 text-center mb-10 text-sm">Public content is free for everyone. Register to unlock tools.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, label, desc, href, color, public: isPublic }) => (
            <Link key={href} href={href}>
              <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                {!isPublic && (
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                    Register
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

      {notes.length > 0 && (
        <section className="bg-gray-50 py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Notes</h2>
              <Link href="/notes" className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
                See all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid gap-2">
              {notes.map(note => (
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

      {pyqs.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Past Papers</h2>
              <Link href="/pyqs" className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
                See all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid gap-2">
              {pyqs.map(pyq => (
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

      <footer className="py-8 px-4 border-t border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Student Hub · Free for every Nepali student</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/about" className="hover:text-gray-600 transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Use</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
