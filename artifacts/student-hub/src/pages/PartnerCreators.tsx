import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Instagram, Youtube, Star, Users, X, Flame, Clock, Trophy, Award, ExternalLink } from "lucide-react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Creator {
  id: string;
  name: string;
  image: string;
  description: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  featured: boolean;
  visible: boolean;
  order: number;
  createdAt: string;
  uid?: string;
}

interface UserProfile {
  uid: string;
  name: string;
  grade: number | null;
  photoURL: string | null;
  streak: number;
  totalStudyTime: number;
  badges: string[] | { id: string; text: string; emoji: string; color: string }[];
  missionCompletedDays: number;
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  );
}

function Avatar({ src, name, size = "md" }: { src?: string | null; name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const [err, setErr] = useState(false);
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sizeClass = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-xl", xl: "w-24 h-24 text-3xl" }[size];
  if (src && !err) {
    return <img src={src} alt={name} onError={() => setErr(true)} className={`${sizeClass} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials}
    </div>
  );
}

function ProfileModal({ creator, onClose }: { creator: Creator; onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(!!creator.uid);

  useEffect(() => {
    if (!creator.uid) { setLoading(false); return; }
    getDoc(doc(db, "users", creator.uid))
      .then(snap => {
        if (!snap.exists()) { setProfile(null); return; }
        const d = snap.data();
        setProfile({
          uid: creator.uid!,
          name: d.name ?? creator.name,
          grade: d.grade ?? null,
          photoURL: d.photoURL ?? null,
          streak: d.streak ?? 0,
          totalStudyTime: d.totalStudyTime ?? 0,
          badges: d.badges ?? [],
          missionCompletedDays: d.missionCompletedDays ?? 0,
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [creator.uid, creator.name]);

  const displayName = profile?.name ?? creator.name;
  const photo = profile?.photoURL ?? creator.image;

  const badgeList = (profile?.badges ?? []).map(b =>
    typeof b === "string" ? { text: b, emoji: "🏅", color: "bg-purple-50 text-purple-600 border-purple-100" } :
    { text: b.text, emoji: b.emoji, color: `${b.color} border-transparent` }
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header banner */}
        <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 pt-10 pb-14 px-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 mb-1">
            <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
            <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Verified Partner Creator</span>
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">{displayName}</h2>
          {profile?.grade && <p className="text-blue-200 text-sm mt-0.5">Grade {profile.grade}</p>}
        </div>

        {/* Avatar overlapping banner */}
        <div className="px-6 -mt-10 mb-4 flex items-end gap-4">
          <div className="ring-4 ring-white rounded-full shadow-xl">
            <Avatar src={photo} name={displayName} size="xl" />
          </div>
          {/* Social links */}
          <div className="pb-2 flex flex-wrap gap-2">
            {creator.instagram && (
              <a href={creator.instagram} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-semibold hover:opacity-90 transition-all">
                <Instagram className="w-3 h-3" />Instagram
              </a>
            )}
            {creator.tiktok && (
              <a href={creator.tiktok} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:opacity-90 transition-all">
                <TikTokIcon className="w-3 h-3" />TikTok
              </a>
            )}
            {creator.youtube && (
              <a href={creator.youtube} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-semibold hover:opacity-90 transition-all">
                <Youtube className="w-3 h-3" />YouTube
              </a>
            )}
          </div>
        </div>

        <div className="px-6 pb-8 space-y-5">
          {/* Description */}
          <p className="text-gray-600 text-sm leading-relaxed">{creator.description}</p>

          {/* Stats */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
            </div>
          ) : profile ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Study Stats</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <Flame className="w-5 h-5 text-orange-400" />, label: "Day Streak", value: `${profile.streak}`, sub: "days", bg: "bg-orange-50" },
                    { icon: <Clock className="w-5 h-5 text-blue-400" />, label: "Total Study", value: `${Math.floor((profile.totalStudyTime || 0) / 60)}`, sub: "hours", bg: "bg-blue-50" },
                    { icon: <Trophy className="w-5 h-5 text-yellow-500" />, label: "Mission Days", value: `${profile.missionCompletedDays || 0}`, sub: "days", bg: "bg-yellow-50" },
                    { icon: <Award className="w-5 h-5 text-purple-500" />, label: "Badges", value: `${badgeList.length}`, sub: "earned", bg: "bg-purple-50" },
                  ].map(({ icon, label, value, sub, bg }) => (
                    <div key={label} className={`${bg} rounded-2xl p-4 flex flex-col items-center text-center`}>
                      <div className="mb-2">{icon}</div>
                      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {badgeList.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Badges</p>
                  <div className="flex flex-wrap gap-1.5">
                    {badgeList.slice(0, 12).map((b, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${b.color}`}>
                        {b.emoji} {b.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-5 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Study stats not linked yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreatorCard({ creator, onOpenProfile }: { creator: Creator; onOpenProfile: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const initials = creator.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer"
      onClick={onOpenProfile}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-indigo-200 overflow-hidden flex-shrink-0">
        {creator.image && !imgErr ? (
          <img
            src={creator.image}
            alt={creator.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-5xl font-bold text-white/80">
            {initials}
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {/* Featured badge */}
        {creator.featured && (
          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full shadow">
            <Star className="w-2.5 h-2.5 fill-current" /> Featured
          </div>
        )}
        {/* Partner badge */}
        <div className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 bg-white/90 backdrop-blur-sm text-blue-600 text-[10px] font-bold rounded-full shadow">
          <Star className="w-2.5 h-2.5 fill-current" /> Partner
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-3">
          {/* Channel avatar */}
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-1">{creator.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Partner Creator · Student Hub Nepal</p>
          </div>
        </div>

        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-3 flex-1">{creator.description}</p>

        {/* Social links */}
        <div className="flex flex-wrap gap-1.5 mt-auto" onClick={e => e.stopPropagation()}>
          {creator.instagram && (
            <a href={creator.instagram} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[10px] font-semibold hover:opacity-90 transition-all">
              <Instagram className="w-2.5 h-2.5" />IG
            </a>
          )}
          {creator.tiktok && (
            <a href={creator.tiktok} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-semibold hover:opacity-90 transition-all">
              <TikTokIcon className="w-2.5 h-2.5" />TikTok
            </a>
          )}
          {creator.youtube && (
            <a href={creator.youtube} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 text-white text-[10px] font-semibold hover:opacity-90 transition-all">
              <Youtube className="w-2.5 h-2.5" />YT
            </a>
          )}
          <button
            onClick={e => { e.stopPropagation(); onOpenProfile(); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-semibold hover:bg-blue-100 transition-all ml-auto"
          >
            <ExternalLink className="w-2.5 h-2.5" />Profile
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="aspect-video bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-gray-100 rounded w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
        <div className="h-2.5 bg-gray-100 rounded" />
        <div className="h-2.5 bg-gray-100 rounded w-4/5" />
        <div className="flex gap-2 mt-2">
          <div className="h-6 bg-gray-100 rounded-lg w-10" />
          <div className="h-6 bg-gray-100 rounded-lg w-12" />
        </div>
      </div>
    </div>
  );
}

export default function PartnerCreators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading]   = useState(true);
  const [profileFor, setProfileFor] = useState<Creator | null>(null);

  useEffect(() => {
    getDocs(collection(db, "creators"))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Creator));
        setCreators(all.filter(c => c.visible).sort((a, b) => a.order - b.order));
      })
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, []);

  const featured = creators.filter(c => c.featured);
  const regular  = creators.filter(c => !c.featured);
  const all      = [...featured, ...regular];

  return (
    <>
      <Helmet>
        <title>Partner Creators | Student Hub Nepal</title>
        <meta name="description" content="Meet Student Hub's official partner creators helping students across Nepal with study tips, exam preparation, and educational content." />
        <meta name="robots" content="index, follow" />
        <meta property="og:url" content="https://www.studenthubnp.com/creators" />
        <meta property="og:title" content="Partner Creators | Student Hub Nepal" />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <link rel="canonical" href="https://www.studenthubnp.com/creators" />
      </Helmet>

      {profileFor && <ProfileModal creator={profileFor} onClose={() => setProfileFor(null)} />}

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

          {/* Hero header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-4 border border-blue-100">
              <Users className="w-4 h-4" /> Official Partner Creators
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Partner Creators</h1>
            <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Nepal's top student creators — study tips, exam prep, and motivation for Grade 9–12.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : all.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <Users className="w-10 h-10 text-blue-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No creators yet</h2>
              <p className="text-gray-400 text-sm">Partner creators will appear here once they join.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {all.map(c => (
                <CreatorCard key={c.id} creator={c} onOpenProfile={() => setProfileFor(c)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
