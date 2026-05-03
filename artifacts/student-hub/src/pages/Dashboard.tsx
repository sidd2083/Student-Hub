import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListTasks, useListScores } from "@workspace/api-client-react";
import {
  BookOpen, Brain, FileText, CheckSquare,
  Timer, MessageCircle, Trophy, Flame, Megaphone
} from "lucide-react";
import {
  doc, updateDoc, getDoc,
  collection, getDocs, query, orderBy, limit
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const sections = [
  { href: "/notes",      icon: BookOpen,      label: "Notes",              desc: "Study materials by subject",  color: "bg-blue-50 text-blue-600"   },
  { href: "/mcq",        icon: Brain,         label: "MCQ Practice",       desc: "Test your knowledge",         color: "bg-purple-50 text-purple-600" },
  { href: "/pyqs",       icon: FileText,      label: "Previous Questions", desc: "Past exam papers",            color: "bg-orange-50 text-orange-600" },
  { href: "/todo",       icon: CheckSquare,   label: "To-Do",              desc: "Track your tasks",            color: "bg-green-50 text-green-600"  },
  { href: "/pomodoro",   icon: Timer,         label: "Pomodoro Timer",     desc: "Focus and study",             color: "bg-red-50 text-red-600"      },
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
        setAnnouncements(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))
        );
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

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting()}, {profile?.name?.split(" ")[0]}
            </h1>
            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              Grade {profile?.grade}
            </span>
          </div>
          <p className="text-gray-500">Ready to learn something new today?</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Pending Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{pendingTasks}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Daily Rank</p>
            <p className="text-3xl font-bold text-gray-900">
              {myRank > 0 ? `#${myRank}` : "—"}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <p className="text-sm text-gray-500">Streak</p>
            </div>
            <p className="text-3xl font-bold text-orange-500">
              {streak}<span className="text-base font-normal text-gray-400 ml-1">days</span>
            </p>
          </div>
        </div>

        {announcements.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                Announcements
              </h2>
            </div>
            <div className="space-y-3">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="bg-blue-50 border border-blue-100 rounded-2xl p-4"
                >
                  <p className="font-semibold text-blue-900 text-sm mb-1">{a.title}</p>
                  <p className="text-blue-700 text-sm leading-relaxed">{a.body}</p>
                  <p className="text-blue-400 text-xs mt-2">
                    {new Date(a.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric"
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Quick Access
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(({ href, icon: Icon, label, desc, color }) => (
            <Link key={href} href={href}>
              <a
                data-testid={`card-section-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className="block bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
