import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Users, Sparkles, BookOpen, Lock, X, Eye, EyeOff } from "lucide-react";
import { Room, subscribePublicRooms, SUBJECTS } from "@/lib/studyRooms";
import { RoomCard } from "@/components/study-room/RoomCard";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

const STATUS_FILTERS = [
  { value: "all",     label: "All"     },
  { value: "active",  label: "Live"    },
  { value: "waiting", label: "Open"    },
];

export default function StudyRooms() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [publicRooms, setPublicRooms]   = useState<Room[]>([]);
  const [myPrivateRooms, setMyPrivateRooms] = useState<Room[]>([]);
  const [search, setSearch]             = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [loading, setLoading]           = useState(true);

  // Private room password gate
  const [pendingRoom, setPendingRoom]   = useState<Room | null>(null);
  const [pwInput, setPwInput]           = useState("");
  const [pwError, setPwError]           = useState("");
  const [showPw, setShowPw]             = useState(false);
  const pwInputRef = useRef<HTMLInputElement>(null);

  // Merge public rooms + host's own private rooms (deduplicated by id)
  const rooms = useMemo(() => {
    const map = new Map<string, Room>();
    for (const r of publicRooms) map.set(r.id, r);
    for (const r of myPrivateRooms) map.set(r.id, r);
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
    );
  }, [publicRooms, myPrivateRooms]);

  useEffect(() => {
    const unsub = subscribePublicRooms((r) => {
      setPublicRooms(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Subscribe to the current user's own private rooms (host only)
  useEffect(() => {
    if (!user) { setMyPrivateRooms([]); return; }
    const now = Date.now();
    const q = query(
      collection(db, "studyRooms"),
      where("hostUid", "==", user.uid),
      where("isPrivate", "==", true),
      where("status", "in", ["waiting", "active", "paused"]),
      limit(5),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMyPrivateRooms(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Room))
          .filter(r => !r.expiresAt || r.expiresAt.toMillis() > now)
      );
    }, () => setMyPrivateRooms([]));
    return unsub;
  }, [user]);

  // Focus password input when modal opens
  useEffect(() => {
    if (pendingRoom) {
      setPwInput("");
      setPwError("");
      setShowPw(false);
      setTimeout(() => pwInputRef.current?.focus(), 100);
    }
  }, [pendingRoom]);

  const filtered = rooms.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.title.toLowerCase().includes(q) &&
          !r.subject.toLowerCase().includes(q) &&
          !r.hostName.toLowerCase().includes(q)) return false;
    }
    if (subjectFilter !== "all" && r.subject !== subjectFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const activeCount  = rooms.filter(r => r.status === "active").length;
  const totalStudents = rooms.reduce((s, r) => s + r.participantCount, 0);
  const publicCount  = rooms.filter(r => !r.isPrivate).length;
  const privateCount = rooms.filter(r => r.isPrivate).length;

  function handleJoinRoom(room: Room) {
    if (room.isPrivate) {
      setPendingRoom(room);
    } else {
      setLocation(`/study-rooms/${room.id}`);
    }
  }

  async function handlePasswordSubmit() {
    if (!pendingRoom) return;
    // Passwords are stored as SHA-256 hashes in Firestore — never plaintext.
    // Hash the user's input and compare to the stored hash.
    const { hashRoomPassword } = await import("@/lib/studyRooms");
    const inputHash = await hashRoomPassword(pwInput);
    if (inputHash === (pendingRoom.password ?? "")) {
      setLocation(`/study-rooms/${pendingRoom.id}`);
      setPendingRoom(null);
    } else {
      setPwError("Wrong password — try again.");
      setPwInput("");
      pwInputRef.current?.focus();
    }
  }

  return (
    <>
      <Helmet>
        <title>Study Rooms — StudentHub</title>
        <meta name="description" content="Join virtual study rooms and study together with students across Nepal." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-500" />
              Study Rooms
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              Study together, stay motivated
            </p>
          </div>
          {user && (
            <Link href="/study-rooms/create" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all flex-shrink-0">
              <Plus className="w-4 h-4" /> Create Room
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active",   value: activeCount,   color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"   },
            { label: "Students", value: totalStudents, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"     },
            { label: "Public",   value: publicCount,   color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" },
            { label: "Private",  value: privateCount,  color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className={`text-xs font-medium mt-0.5 ${color}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rooms, subjects, hosts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
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
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="all">All Subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <button
                onClick={() => setSubjectFilter("all")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${subjectFilter === "all" && statusFilter === "all" && !search ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
              >
                All
              </button>
            </div>
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
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-700 dark:text-gray-300 font-semibold">No rooms found</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {rooms.length === 0 ? "Be the first to create a study room!" : "Try a different filter"}
              </p>
            </div>
            {user && (
              <Link href="/study-rooms/create" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm">
                <Plus className="w-4 h-4" /> Create Study Room
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((room, i) => (
              <motion.div key={room.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <RoomCard room={room} onJoin={handleJoinRoom} />
              </motion.div>
            ))}
          </div>
        )}

        {!user && rooms.length > 0 && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white text-center">
            <p className="font-semibold mb-1">Sign in to join or create study rooms</p>
            <p className="text-white/70 text-sm mb-3">Your study time syncs to the leaderboard automatically</p>
            <Link href="/login" className="px-5 py-2 rounded-xl bg-white text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors">
              Sign In with Google
            </Link>
          </div>
        )}
      </div>

      {/* Private room password modal */}
      <AnimatePresence>
        {pendingRoom && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingRoom(null)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 16 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base truncate max-w-48">{pendingRoom.title}</p>
                      <p className="text-white/70 text-xs">Private Room · {pendingRoom.subject}</p>
                    </div>
                  </div>
                  <button onClick={() => setPendingRoom(null)} className="text-white/70 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This room is private. Enter the password to join.
                  </p>

                  <div className="relative">
                    <input
                      ref={pwInputRef}
                      type={showPw ? "text" : "password"}
                      value={pwInput}
                      onChange={(e) => { setPwInput(e.target.value); setPwError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                      placeholder="Room password"
                      className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm outline-none transition-all ${
                        pwError
                          ? "border-red-400 bg-red-50 dark:bg-red-900/10 focus:ring-2 focus:ring-red-400"
                          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-orange-400"
                      } text-gray-900 dark:text-white`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {pwError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-xs font-medium">
                      {pwError}
                    </motion.p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingRoom(null)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePasswordSubmit}
                      disabled={!pwInput.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                    >
                      Enter Room
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
