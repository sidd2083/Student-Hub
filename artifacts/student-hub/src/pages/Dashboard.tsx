import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListTasks, useListScores } from "@workspace/api-client-react";
import {
  BookOpen, Brain, FileText, CheckSquare,
  Timer, MessageCircle, Trophy, Flame, Megaphone, X,
} from "lucide-react";
import {
  doc, updateDoc, getDoc,
  collection, getDocs, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const sections = [
  { href: "/notes",      icon: BookOpen,      label: "Notes",              desc: "Study materials by subject",  color: "bg-blue-50 text-blue-600"    },
  { href: "/mcq",        icon: Brain,         label: "MCQ Practice",       desc: "Test your knowledge",         color: "bg-purple-50 text-purple-600" },
  { href: "/pyqs",       icon: FileText,      label: "Previous Questions", desc: "Past exam papers",            color: "bg-orange-50 text-orange-600" },
  { href: "/todo",       icon: CheckSquare,   label: "To-Do",              desc: "Track your tasks",            color: "bg-green-50 text-green-600"   },
  { href: "/pomodoro",   icon: Timer,         label: "Pomodoro Timer",     desc: "Focus and study",             color: "bg-red-50 text-red-600"       },
  { href: "/ai",         icon: MessageCircle, label: "Nep AI",             desc: "AI study assistant",          color: "bg-indigo-50 text-indigo-600" },
];

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data: tasks } = useListTasks(
    { uid: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: ["listTasks", user?.uid || ""] } }
  );
  const { data: scores } = useListScores({ period: "daily" });

  const pendingTasks = tasks?.filter((t) => !t.completed).length ?? 0;
  const myRank = scores ? scores.findIndex((s) => s.uid === user?.uid) + 1 : 0;

  useEffect(() => {
    if (!user) return;
    const updateStreak = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() ?? {};
        const today = new Date().toDateString();
        const last: string | undefined = data.lastActive;
        const current: number = data.streak ?? 0;
        if (last === today) { setStreak(current); return; }
        const yesterday = new Date(Date.now() - 86_400_000).toDateString();
        const next = last === yesterday ? current + 1 : 1;
        await updateDoc(ref, { streak: next, lastActive: today });
        setStreak(next);
      } catch (err) {
        console.error("Streak update failed:", err);
      }
    };
    updateStreak();
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(
          collection(db, "announcements"),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const snap = await getDocs(q);
        setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
      } catch {
        /* collection may not exist yet */
      }
    };
    load();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id));

  return (
    <>
      <Helmet>
        <title>Dashboard — Student Hub</title>
      </Helmet>
      <Layout hideBack>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {greeting()}, {profile?.name?.split(" ")[0]}
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Grade {profile?.grade}
              </span>
            </div>
            <p className="text-gray-500 text-sm">Ready to learn something new today?</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Pending Tasks</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{pendingTasks}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-500 mb-1">Daily Rank</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {myRank > 0 ? `#${myRank}` : "—"}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-1 sm:gap-1.5 mb-1">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                <p className="text-xs sm:text-sm text-gray-500">Streak</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-orange-500">
                {streak}<span className="text-xs sm:text-base font-normal text-gray-400 ml-1">days</span>
              </p>
            </div>
          </div>

          {/* Announcements with close button */}
          {visibleAnnouncements.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Megaphone className="w-4 h-4 text-gray-400" />
                <h2 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Announcements
                </h2>
              </div>
              <div className="space-y-3">
                {visibleAnnouncements.map((a) => (
                  <div key={a.id} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 relative">
                    <button
                      onClick={() => setDismissed(prev => new Set([...prev, a.id]))}
                      className="absolute top-3 right-3 p-1 rounded-full hover:bg-blue-200/60 transition-all"
                      aria-label="Close announcement"
                    >
                      <X className="w-4 h-4 text-blue-400" />
                    </button>
                    <p className="font-semibold text-blue-900 text-sm mb-1 pr-6">{a.title}</p>
                    <p className="text-blue-700 text-sm leading-relaxed">{a.body}</p>
                    <p className="text-blue-400 text-xs mt-2">
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Access */}
          <h2 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">
            Quick Access
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sections.map(({ href, icon: Icon, label, desc, color }) => (
              <Link key={href} href={href}>
                <a
                  data-testid={`card-section-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 ${color} rounded-xl flex items-center justify-center mb-3 sm:mb-4`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-0.5 sm:mb-1 leading-tight">{label}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 leading-tight">{desc}</p>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </Layout>
    </>
  );
}
