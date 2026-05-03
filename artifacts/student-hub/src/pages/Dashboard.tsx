import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { useListTasks, useListScores } from "@workspace/api-client-react";
import { BookOpen, Brain, FileText, CheckSquare, Timer, MessageCircle, Trophy } from "lucide-react";

const sections = [
  { href: "/notes", icon: BookOpen, label: "Notes", desc: "Study materials by subject", color: "bg-blue-50 text-blue-600" },
  { href: "/mcq", icon: Brain, label: "MCQ Practice", desc: "Test your knowledge", color: "bg-purple-50 text-purple-600" },
  { href: "/pyqs", icon: FileText, label: "Previous Questions", desc: "Past exam papers", color: "bg-orange-50 text-orange-600" },
  { href: "/todo", icon: CheckSquare, label: "To-Do", desc: "Track your tasks", color: "bg-green-50 text-green-600" },
  { href: "/pomodoro", icon: Timer, label: "Pomodoro Timer", desc: "Focus and study", color: "bg-red-50 text-red-600" },
  { href: "/ai", icon: MessageCircle, label: "Nep AI", desc: "AI study assistant", color: "bg-indigo-50 text-indigo-600" },
];

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { data: tasks } = useListTasks(
    { uid: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: ["listTasks", user?.uid || ""] } }
  );
  const { data: scores } = useListScores({ period: "daily" });

  const pendingTasks = tasks?.filter((t) => !t.completed).length || 0;
  const myRank = scores
    ? scores.findIndex((s) => s.uid === user?.uid) + 1
    : 0;

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

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Pending Tasks</p>
            <p className="text-3xl font-bold text-gray-900">{pendingTasks}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Daily Rank</p>
            <p className="text-3xl font-bold text-gray-900">{myRank > 0 ? `#${myRank}` : "—"}</p>
          </div>
        </div>

        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Quick Access</h2>
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
