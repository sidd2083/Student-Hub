import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Instagram, Youtube, Star, Users } from "lucide-react";

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
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  );
}

function SocialButton({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${color}`}
    >
      {icon}
      {label}
    </a>
  );
}

function CreatorImageFallback({ name, large }: { name: string; large?: boolean }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const size = large ? "w-full h-full text-4xl" : "w-full h-full text-2xl";
  return (
    <div
      className={`${size} bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white`}
    >
      {initials}
    </div>
  );
}

function FeaturedCreator({ creator }: { creator: Creator }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-px shadow-2xl mb-10">
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            {/* Image */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shadow-xl ring-4 ring-white">
                {creator.image && !imgError ? (
                  <img
                    src={creator.image}
                    alt={creator.name}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    loading="lazy"
                  />
                ) : (
                  <CreatorImageFallback name={creator.name} large />
                )}
              </div>
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-full p-1.5 shadow-lg">
                <Star className="w-3.5 h-3.5 fill-current" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{creator.name}</h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full shadow-sm">
                  <Star className="w-3 h-3 fill-current" />
                  Verified Partner
                </span>
              </div>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-5 max-w-xl">
                {creator.description}
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {creator.instagram && (
                  <SocialButton
                    href={creator.instagram}
                    icon={<Instagram className="w-3.5 h-3.5" />}
                    label="Instagram"
                    color="bg-gradient-to-r from-pink-500 to-purple-500 text-white"
                  />
                )}
                {creator.tiktok && (
                  <SocialButton
                    href={creator.tiktok}
                    icon={<TikTokIcon className="w-3.5 h-3.5" />}
                    label="TikTok"
                    color="bg-gray-900 text-white"
                  />
                )}
                {creator.youtube && (
                  <SocialButton
                    href={creator.youtube}
                    icon={<Youtube className="w-3.5 h-3.5" />}
                    label="YouTube"
                    color="bg-red-500 text-white"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatorCard({ creator }: { creator: Creator }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
      {/* Image area */}
      <div className="relative h-40 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
        {creator.image && !imgError ? (
          <img
            src={creator.image}
            alt={creator.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <CreatorImageFallback name={creator.name} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-gray-900 text-base leading-tight">{creator.name}</h3>
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100">
            <Star className="w-2.5 h-2.5 fill-current" />
            Partner
          </span>
        </div>
        <p className="text-gray-500 text-xs leading-relaxed flex-1 mb-4 line-clamp-3">
          {creator.description}
        </p>

        {/* Social buttons */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {creator.instagram && (
            <SocialButton
              href={creator.instagram}
              icon={<Instagram className="w-3 h-3" />}
              label="Instagram"
              color="bg-gradient-to-r from-pink-500 to-purple-500 text-white"
            />
          )}
          {creator.tiktok && (
            <SocialButton
              href={creator.tiktok}
              icon={<TikTokIcon className="w-3 h-3" />}
              label="TikTok"
              color="bg-gray-900 text-white"
            />
          )}
          {creator.youtube && (
            <SocialButton
              href={creator.youtube}
              icon={<Youtube className="w-3 h-3" />}
              label="YouTube"
              color="bg-red-500 text-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-40 bg-gray-100" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="flex gap-2 mt-4">
          <div className="h-7 bg-gray-100 rounded-xl w-20" />
          <div className="h-7 bg-gray-100 rounded-xl w-16" />
        </div>
      </div>
    </div>
  );
}

export default function PartnerCreators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCreators() {
      try {
        const resp = await fetch("/api/creators");
        if (!resp.ok) throw new Error("Fetch failed");
        const data = await resp.json() as Creator[];
        setCreators(data);
      } catch {
        setCreators([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCreators();
  }, []);

  const featured = creators.find((c) => c.featured);
  const regular = creators.filter((c) => !c.featured);

  return (
    <>
      <Helmet>
        <title>Partner Creators | Student Hub Nepal</title>
        <meta
          name="description"
          content="Meet Student Hub's official partner creators helping students across Nepal with study tips, exam preparation, and educational content."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.studenthubnp.com/creators" />
        <meta property="og:title" content="Partner Creators | Student Hub Nepal" />
        <meta
          property="og:description"
          content="Meet Student Hub's official partner creators helping students across Nepal with study tips, exam preparation, and educational content."
        />
        <meta property="og:image" content="https://www.studenthubnp.com/opengraph.jpg" />
        <meta property="og:site_name" content="Student Hub Nepal" />
        <link rel="canonical" href="https://www.studenthubnp.com/creators" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Partner Creators | Student Hub Nepal",
            description:
              "Official partner creators for Student Hub Nepal — helping students prepare for NEB and SEE exams.",
            url: "https://www.studenthubnp.com/creators",
            isPartOf: {
              "@type": "WebSite",
              name: "Student Hub Nepal",
              url: "https://www.studenthubnp.com",
            },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {/* Page header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-4 border border-blue-100">
              <Users className="w-4 h-4" />
              Official Partners
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Partner Creators
            </h1>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Meet the creators helping students across Nepal learn, study, prepare for exams,
              and achieve their goals.
            </p>
          </div>

          {loading ? (
            <>
              {/* Featured skeleton */}
              <div className="rounded-3xl overflow-hidden mb-10 animate-pulse">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 flex gap-6">
                  <div className="w-36 h-36 rounded-2xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-3 py-2">
                    <div className="h-7 bg-gray-200 rounded w-48" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="flex gap-2 mt-4">
                      <div className="h-8 bg-gray-200 rounded-xl w-24" />
                      <div className="h-8 bg-gray-200 rounded-xl w-20" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
              </div>
            </>
          ) : creators.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No creators yet</h2>
              <p className="text-gray-500 text-sm">
                Partner creators will appear here once they join Student Hub.
              </p>
            </div>
          ) : (
            <>
              {/* Featured creator */}
              {featured && <FeaturedCreator creator={featured} />}

              {/* Regular creators grid */}
              {regular.length > 0 && (
                <>
                  {featured && (
                    <h2 className="text-lg font-bold text-gray-900 mb-5">All Partner Creators</h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {regular.map((creator) => (
                      <CreatorCard key={creator.id} creator={creator} />
                    ))}
                  </div>
                </>
              )}

              {/* Only featured, no others */}
              {featured && regular.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-4">
                  More partner creators coming soon.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
