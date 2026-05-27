import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Plus, Search, Users, Sparkles, BookOpen, Filter } from "lucide-react";
import { Room, subscribePublicRooms, SUBJECTS } from "@/lib/studyRooms";
import { RoomCard } from "@/components/study-room/RoomCard";
import { useAuth } from "@/context/AuthContext";

const STATUS_FILTERS = [
  { value: "all",     label: "All Rooms"   },
  { value: "active",  label: "Studying Now" },
  { value: "waiting", label: "Open"         },
];

export default function StudyRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribePublicRooms((r) => {
      setRooms(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = rooms.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !r.subject.toLowerCase().includes(search.toLowerCase()) &&
        !r.hostName.toLowerCase().includes(search.toLowerCase())) return false;
    if (subjectFilter !== "all" && r.subject !== subjectFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const activeCount = rooms.filter(r => r.status === "active").length;
  const totalStudents = rooms.reduce((s, r) => s + r.participantCount, 0);

  return (
    <>
      <Helmet>
        <title>Study Rooms — StudentHub</title>
        <meta name="description" content="Join virtual study rooms and study together with students across Nepal." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-500" />
              Study Rooms
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Study together, stay motivated
            </p>
          </div>
          {user && (
            <Link href="/study-rooms/create">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm hover:shadow transition-all flex-shrink-0">
                <Plus className="w-4 h-4" /> Create Room
              </button>
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Active Rooms",  value: activeCount,     icon: BookOpen, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"   },
            { label: "Students Live", value: totalStudents,   icon: Users,    color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" },
            { label: "Total Rooms",   value: rooms.length,    icon: Sparkles, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400", className: "hidden sm:flex" },
          ].map(({ label, value, icon: Icon, color, className = "" }) => (
            <div key={label} className={`${className} items-center gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex`}>
              <div className={`p-2.5 rounded-xl ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rooms, subjects, hosts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition-shadow"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Status filter */}
            <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {STATUS_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === value
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Subject filter */}
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Room grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-52 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 space-y-4"
          >
            <div className="w-16 h-16 mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300 font-semibold">No rooms found</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {rooms.length === 0
                  ? "Be the first to create a study room!"
                  : "Try a different search or filter"}
              </p>
            </div>
            {user && (
              <Link href="/study-rooms/create">
                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm">
                  <Plus className="w-4 h-4" /> Create Study Room
                </button>
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((room, i) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <RoomCard room={room} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Login prompt */}
        {!user && rooms.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white text-center">
            <p className="font-semibold mb-1">Sign in to join or create study rooms</p>
            <p className="text-white/70 text-sm mb-3">Your study time syncs to the leaderboard automatically</p>
            <Link href="/login">
              <button className="px-5 py-2 rounded-xl bg-white text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors">
                Sign In with Google
              </button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
