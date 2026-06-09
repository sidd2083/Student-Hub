import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Instagram, Youtube, Star, Users, X, Flame, Clock, Trophy, Award, ExternalLink } from "lucide-react";
import { collection, getDocs, doc, getDoc, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ─── Types ────────────────────────────────────────────────────── */

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
  uid?: string;
}

interface UserProfile {
  uid: string;
  name: string;
  grade: number | null;
  photoURL: string | null;
  streak: number;
  totalStudyMins: number;
  badges: ({ text: string; emoji: string; color: string } | string)[];
  missionDays: number;
}

/* ─── Tiny helpers ──────────────────────────────────────────────── */

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  );
}

function Initials({ name, className }: { name: string; className?: string }) {
  const init = name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (
    <span className={`font-bold tracking-wide ${className ?? ""}`}>{init}</span>
  );
}

/* ─── Profile Modal ─────────────────────────────────────────────── */

function ProfileModal({ creator, onClose }: { creator: Creator; onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(!!creator.uid);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    if (!creator.uid) { setLoading(false); return; }
    getDoc(doc(db, "users", creator.uid))
      .then(snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        setProfile({
          uid: creator.uid!,
          name: d.name ?? creator.name,
          grade: d.grade ?? null,
          photoURL: d.photoURL ?? null,
          streak: d.streak ?? 0,
          totalStudyMins: d.totalStudyTime ?? 0,
          badges: d.badges ?? [],
          missionDays: d.missionCompletedDays ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [creator.uid, creator.name]);

  const displayName = profile?.name ?? creator.name;
  const photoSrc = profile?.photoURL ?? null;
  const hours = Math.floor((profile?.totalStudyMins ?? 0) / 60);

  const badges = (profile?.badges ?? []).map(b =>
    typeof b === "string"
      ? { text: b, emoji: "🏅", color: "bg-indigo-50 text-indigo-600 border-indigo-100" }
      : { text: b.text, emoji: b.emoji, color: `${b.color} border-transparent` }
  );

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end sm:justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="relative bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "92dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close btn */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/25 transition-colors text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Gradient header — avatar lives INSIDE it */}
        <div className="rounded-t-3xl sm:rounded-t-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 px-6 pt-8 pb-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl overflow-hidden ring-4 ring-white/30 shadow-xl flex-shrink-0 bg-white/20">
              {photoSrc && !imgErr ? (
                <img
                  src={photoSrc}
                  alt={displayName}
                  onError={() => setImgErr(true)}
                  className="w-full h-full object-cover"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Initials name={displayName} className="text-3xl text-white" />
                </div>
              )}
            </div>

            {/* Name / grade / partner tag */}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-400/90 rounded-full mb-1.5">
                <Star className="w-2.5 h-2.5 text-yellow-900 fill-yellow-900" />
                <span className="text-[9px] font-extrabold text-yellow-900 uppercase tracking-wider">Verified Partner</span>
              </div>
              <h2 className="text-xl font-extrabold text-white leading-tight truncate">{displayName}</h2>
              {profile?.grade && (
                <p className="text-blue-200 text-xs mt-0.5">Grade {profile.grade}</p>
              )}
            </div>
          </div>

          {/* Social links inside header */}
          {(creator.instagram || creator.tiktok || creator.youtube) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {creator.instagram && (
                <a href={creator.instagram} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all">
                  <Instagram className="w-3.5 h-3.5" /> Instagram
                </a>
              )}
              {creator.tiktok && (
                <a href={creator.tiktok} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all">
                  <TikTokIcon className="w-3.5 h-3.5" /> TikTok
                </a>
              )}
              {creator.youtube && (
                <a href={creator.youtube} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all">
                  <Youtube className="w-3.5 h-3.5" /> YouTube
                </a>
              )}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
          {/* Description */}
          {creator.description && (
            <p className="text-gray-500 text-sm leading-relaxed">{creator.description}</p>
          )}

          {/* Stats */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
            </div>
          ) : profile ? (
            <>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Study Stats</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <Flame className="w-5 h-5 text-orange-500" />, value: String(profile.streak), unit: "days", label: "Day Streak", bg: "bg-orange-50" },
                    { icon: <Clock className="w-5 h-5 text-blue-500" />, value: String(hours), unit: "hours", label: "Total Study", bg: "bg-blue-50" },
                    { icon: <Trophy className="w-5 h-5 text-yellow-500" />, value: String(profile.missionDays), unit: "days", label: "Mission Days", bg: "bg-yellow-50" },
                    { icon: <Award className="w-5 h-5 text-purple-500" />, value: String(badges.length), unit: "earned", label: "Badges", bg: "bg-purple-50" },
                  ].map(({ icon, value, unit, label, bg }) => (
                    <div key={label} className={`${bg} rounded-2xl p-4 text-center`}>
                      <div className="flex justify-center mb-1.5">{icon}</div>
                      <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{unit}</p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {badges.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Badges</p>
                  <div className="flex flex-wrap gap-1.5">
                    {badges.slice(0, 10).map((b, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${b.color}`}>
                        {b.emoji} {b.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm font-medium">Study stats not linked yet</p>
              <p className="text-gray-300 text-xs mt-1">Follow this creator on their socials!</p>
            </div>
          )}

          {/* Bottom safe area */}
          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}

/* ─── Creator Card ──────────────────────────────────────────────── */

function CreatorCard({ creator, onOpen }: { creator: Creator; onOpen: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const init = creator.name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();

  return (
    <button
      className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      onClick={onOpen}
    >
      {/* ── Thumbnail ─────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-200" style={{ aspectRatio: "16/9" }}>
        {creator.image && !imgErr ? (
          <img
            src={creator.image}
            alt={creator.name}
            onError={() => setImgErr(true)}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            fetchPriority={creator.featured ? "high" : "low"}
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <span className="text-4xl font-black text-white/80">{init}</span>
          </div>
        )}

        {/* Subtle gradient at bottom of thumbnail */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {creator.featured && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-[9px] font-extrabold rounded-full shadow-sm">
              <Star className="w-2 h-2 fill-current" /> Featured
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-extrabold rounded-full shadow-sm">
            Partner
          </span>
        </div>
      </div>

      {/* ── Card body ─────────────────────────────────────────── */}
      <div className="p-3.5 flex flex-col flex-1 gap-2.5">
        {/* Channel row */}
        <div className="flex items-center gap-2.5">
          {/* Small avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-[10px] font-extrabold">{init}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">{creator.name}</p>
            <p className="text-[10px] text-gray-400">Partner Creator</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1">{creator.description}</p>

        {/* Social chips — stop propagation so clicking social link doesn't open modal */}
        <div className="flex flex-wrap gap-1.5 items-center" onClick={e => e.stopPropagation()}>
          {creator.instagram && (
            <a href={creator.instagram} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white text-[10px] font-bold hover:opacity-90 transition-opacity">
              <Instagram className="w-2.5 h-2.5" /> IG
            </a>
          )}
          {creator.tiktok && (
            <a href={creator.tiktok} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black text-white text-[10px] font-bold hover:opacity-90 transition-opacity">
              <TikTokIcon className="w-2.5 h-2.5" /> TT
            </a>
          )}
          {creator.youtube && (
            <a href={creator.youtube} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:opacity-90 transition-opacity">
              <Youtube className="w-2.5 h-2.5" /> YT
            </a>
          )}
          <span
            onClick={e => { e.stopPropagation(); onOpen(); }}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && onOpen()}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-2.5 h-2.5" /> View
          </span>
        </div>
      </div>
    </button>
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div style={{ aspectRatio: "16/9" }} className="bg-gray-100 w-full" />
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-100 rounded w-3/5" />
            <div className="h-2 bg-gray-100 rounded w-2/5" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 bg-gray-100 rounded" />
          <div className="h-2.5 bg-gray-100 rounded w-4/5" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-6 w-8 bg-gray-100 rounded-lg" />
          <div className="h-6 w-10 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function PartnerCreators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Creator | null>(null);

  useEffect(() => {
    // Filter visible=true server-side to avoid fetching hidden creator docs.
    getDocs(query(collection(db, "creators"), where("visible", "==", true)))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Creator));
        setCreators(
          all.sort((a, b) => {
            if (a.featured !== b.featured) return a.featured ? -1 : 1;
            return (a.order ?? 0) - (b.order ?? 0);
          })
        );
      })
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, []);

  const openModal  = useCallback((c: Creator) => setSelected(c), []);
  const closeModal = useCallback(() => setSelected(null), []);

  const creatorNames = creators.map(c => c.name).join(", ");
  const creatorKeywords = creators.map(c =>
    `${c.name} student hub, ${c.name} nepal, ${c.name} student hub nepal partner creator, ${c.name} neb study`
  ).join(", ");

  function nameSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  const jsonLd = creators.length > 0 ? JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://www.studenthubnp.com/creators",
        "url": "https://www.studenthubnp.com/creators",
        "name": "Partner Creators | Student Hub Nepal",
        "description": "Meet Student Hub's official partner creators — Nepal's top student content creators helping Grade 9–12 students with study tips, exam prep, and motivation.",
        "isPartOf": { "@id": "https://www.studenthubnp.com/#website" },
        "inLanguage": "en-NP",
        "about": creators.map(c => ({ "@type": "Person", "name": c.name })),
      },
      ...creators.map(c => ({
        "@type": "Person",
        "@id": `https://www.studenthubnp.com/creators#${nameSlug(c.name)}`,
        "name": c.name,
        "description": `${c.name} is an official Student Hub Nepal partner creator — helping Grade 9–12 Nepali students with NEB and SEE exam preparation. ${c.description}`,
        "image": c.image || undefined,
        "url": `https://www.studenthubnp.com/creators#${nameSlug(c.name)}`,
        "jobTitle": "Official Partner Creator, Student Hub Nepal",
        "affiliation": {
          "@type": "Organization",
          "name": "Student Hub Nepal",
          "url": "https://www.studenthubnp.com",
        },
        "worksFor": {
          "@type": "Organization",
          "name": "Student Hub Nepal",
          "url": "https://www.studenthubnp.com",
        },
        "sameAs": [
          c.instagram,
          c.tiktok,
          c.youtube,
        ].filter(Boolean),
        "knowsAbout": [
          "Nepal Education",
          "NEB Exam Preparation",
          "SEE Exam",
          "Study Tips",
          "Grade 9 to 12 Nepal",
          "Student Hub Nepal",
        ],
      })),
    ],
  }) : null;

  return (
    <>
      <Helmet>
        <title>Partner Creators — Student Hub Nepal | Official Content Creators</title>
        <meta name="description" content={`Meet Student Hub Nepal's official partner creators — ${creatorNames || "Nepal's top student content creators"} — helping Grade 9–12 students with study tips, NEB &amp; SEE exam prep, and motivation. Founded by Siddhant Lamichhane.`} />
        <meta name="keywords" content={`student hub partner creators, student hub nepal partner creator, partner creator student hub nepal, student hub nepal creators, ${creatorKeywords}, nepal student youtubers, nepal study creators, neb study creators, student hub nepal official creators, student hub content creators nepal, siddhant lamichhane student hub creators`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <meta name="author" content="Siddhant Lamichhane, Aarogya Sapkota" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Partner Creators — Student Hub Nepal | Official Content Creators" />
        <meta property="og:description" content={`Meet Student Hub Nepal's verified partner creators — ${creatorNames || "Nepal's top student content creators"} — helping Grade 9–12 students ace their NEB and SEE exams.`} />
        <meta property="og:url" content="https://www.studenthubnp.com/creators" />
        <meta property="og:image" content={creators[0]?.image || "https://www.studenthubnp.com/opengraph.jpg"} />
        <meta property="og:image:alt" content="Student Hub Nepal Partner Creators" />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Partner Creators — Student Hub Nepal | Official Content Creators" />
        <meta name="twitter:description" content={`Meet Student Hub Nepal's verified partner creators helping Nepali students with NEB and SEE exam prep.`} />
        <meta name="twitter:image" content={creators[0]?.image || "https://www.studenthubnp.com/opengraph.jpg"} />
        <link rel="canonical" href="https://www.studenthubnp.com/creators" />
        {jsonLd && (
          <script type="application/ld+json">{jsonLd}</script>
        )}
      </Helmet>

      {selected && <ProfileModal creator={selected} onClose={closeModal} />}

      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-full text-xs font-bold mb-4 uppercase tracking-wide">
              <Star className="w-3.5 h-3.5 fill-blue-400 text-blue-400" /> Official Partner Creators
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3 tracking-tight">Partner Creators</h1>
            <p className="text-gray-500 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              Nepal's top student creators — study tips, exam prep, and motivation for Grade 9–12 students.
            </p>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : creators.length === 0 ? (
            <div className="text-center py-28">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                <Users className="w-10 h-10 text-blue-300" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">No creators yet</h2>
              <p className="text-gray-400 text-sm">Partner creators will appear here once they join.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {creators.map(c => (
                <div key={c.id} id={nameSlug(c.name)}>
                  <CreatorCard creator={c} onOpen={() => openModal(c)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
