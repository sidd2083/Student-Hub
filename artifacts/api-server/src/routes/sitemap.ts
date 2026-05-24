import { Router, type Request, type Response } from "express";
import pino from "pino";

const router = Router();
const log = pino({ level: "info" });

const SITE_URL   = "https://studenthubnp.com";
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? "studenthub-6bcc5";
const API_KEY    = process.env.VITE_FIREBASE_API_KEY    ?? "";

function toSlug(str: string): string {
  return (str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type FirestoreFields = Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number }>;

interface FirestoreDoc {
  name:   string;
  fields: FirestoreFields;
}

function docId(docName: string): string {
  return docName.split("/").pop() ?? docName;
}

function fStr(fields: FirestoreFields, key: string): string {
  return fields[key]?.stringValue ?? fields[key]?.integerValue ?? "";
}

function fInt(fields: FirestoreFields, key: string): number {
  return Number(fields[key]?.integerValue ?? fields[key]?.doubleValue ?? 0);
}

async function fetchAll(collection: string): Promise<FirestoreDoc[]> {
  const docs: FirestoreDoc[] = [];
  let pageToken = "";
  let attempts  = 0;

  if (!API_KEY) {
    log.warn({ collection }, "VITE_FIREBASE_API_KEY is not set — Firestore fetch will fail");
  }

  while (attempts < 20) {
    attempts++;
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}` +
      `?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "") +
      (API_KEY   ? `&key=${API_KEY}`         : "");

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        const body = await res.text().catch(() => "(unreadable)");
        log.error({ collection, status: res.status, body }, "Firestore REST API error");
        break;
      }
      const data = await res.json() as { documents?: FirestoreDoc[]; nextPageToken?: string };
      const count = data.documents?.length ?? 0;
      log.info({ collection, page: attempts, count }, "Firestore page fetched");
      docs.push(...(data.documents ?? []));
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    } catch (err) {
      log.error({ collection, err }, "Firestore fetch threw");
      break;
    }
  }

  log.info({ collection, total: docs.length }, "Firestore fetch complete");
  return docs;
}

const STATIC_URLS = [
  { loc: `${SITE_URL}/`,                            priority: "1.0",  changefreq: "weekly"  },
  { loc: `${SITE_URL}/notes`,                       priority: "0.95", changefreq: "daily"   },
  { loc: `${SITE_URL}/pyqs`,                        priority: "0.90", changefreq: "weekly"  },
  { loc: `${SITE_URL}/mcq`,                         priority: "0.85", changefreq: "weekly"  },
  { loc: `${SITE_URL}/tools`,                       priority: "0.90", changefreq: "monthly" },
  { loc: `${SITE_URL}/tools/gpa-calculator`,        priority: "1.0",  changefreq: "weekly"  },
  { loc: `${SITE_URL}/tools/attendance-calculator`, priority: "1.0",  changefreq: "weekly"  },
  { loc: `${SITE_URL}/about`,                       priority: "0.60", changefreq: "monthly" },
  { loc: `${SITE_URL}/contact`,                     priority: "0.50", changefreq: "monthly" },
  { loc: `${SITE_URL}/privacy`,                     priority: "0.40", changefreq: "yearly"  },
  { loc: `${SITE_URL}/terms`,                       priority: "0.40", changefreq: "yearly"  },
] as const;

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&apos;");
}

function buildSitemapXml(
  urls: Array<{ loc: string; priority: string; changefreq: string }>,
  today: string,
): string {
  const entries = urls
    .map(
      u => `  <url>
    <loc>${escape(u.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

// ── In-memory sitemap cache ────────────────────────────────────────────────────
// Generated once on startup (and every 6 hours thereafter).
// Requests are served instantly from this cache — no Firestore call on each hit.
interface SitemapCache {
  xml:         string;
  generatedAt: number; // Date.now()
  noteCount:   number;
  pyqCount:    number;
}

let sitemapCache: SitemapCache | null = null;
let generating = false;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function generateSitemap(): Promise<SitemapCache> {
  const today = new Date().toISOString().split("T")[0];
  log.info("Sitemap: generating (fetching Firestore collections)");

  const [noteDocs, pyqDocs] = await Promise.all([
    fetchAll("notes"),
    fetchAll("pyqs"),
  ]);

  const noteUrls = noteDocs
    .filter(d => d.fields)
    .map(d => {
      const id      = docId(d.name);
      const grade   = fInt(d.fields, "grade");
      const subject = toSlug(fStr(d.fields, "subject"));
      const title   = toSlug(fStr(d.fields, "title"));
      return {
        loc: `${SITE_URL}/notes/${id}-grade-${grade}-${subject}-${title}`,
        priority:   "0.75",
        changefreq: "monthly",
      };
    });

  const pyqUrls = pyqDocs
    .filter(d => d.fields)
    .map(d => {
      const id      = docId(d.name);
      const grade   = fInt(d.fields, "grade");
      const subject = toSlug(fStr(d.fields, "subject"));
      const year    = fInt(d.fields, "year");
      const title   = toSlug(fStr(d.fields, "title"));
      return {
        loc: `${SITE_URL}/pyq/${id}-grade-${grade}-${subject}-${year}-${title}`,
        priority:   "0.75",
        changefreq: "monthly",
      };
    });

  const xml = buildSitemapXml([...STATIC_URLS, ...noteUrls, ...pyqUrls], today);
  const cache: SitemapCache = {
    xml,
    generatedAt: Date.now(),
    noteCount:   noteUrls.length,
    pyqCount:    pyqUrls.length,
  };

  log.info(
    { notes: cache.noteCount, pyqs: cache.pyqCount, statics: STATIC_URLS.length, totalUrls: STATIC_URLS.length + noteUrls.length + pyqUrls.length },
    "Sitemap: generated successfully",
  );
  return cache;
}

// Kick off generation in the background on startup so the first real request
// is served from cache instead of waiting 8+ seconds.
async function warmCache() {
  if (generating) return;
  generating = true;
  try {
    sitemapCache = await generateSitemap();
  } catch (err) {
    log.error({ err }, "Sitemap: background warm-up failed");
  } finally {
    generating = false;
  }
}

// Warm up immediately when this module is loaded
warmCache();

// Refresh every 6 hours
setInterval(() => {
  warmCache();
}, CACHE_TTL_MS);

router.get("/sitemap.xml", async (_req: Request, res: Response) => {
  // If cache is warm, serve immediately
  if (sitemapCache) {
    const ageMs  = Date.now() - sitemapCache.generatedAt;
    const ageMin = Math.round(ageMs / 60_000);
    log.info(
      { notes: sitemapCache.noteCount, pyqs: sitemapCache.pyqCount, ageMin },
      "Sitemap: served from cache",
    );

    // no-store prevents the Replit proxy / browser from caching a stale version
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Sitemap-Cache", "HIT");
    res.setHeader("X-Sitemap-Age-Min", String(ageMin));
    return res.send(sitemapCache.xml);
  }

  // Cache is cold — generate now (only happens on very first request after startup)
  log.info("Sitemap: cache cold, generating now");
  try {
    sitemapCache = await generateSitemap();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Sitemap-Cache", "MISS");
    return res.send(sitemapCache.xml);
  } catch (err) {
    log.error({ err }, "Sitemap: generation failed on request");
    // Serve static-only sitemap as fallback so the request doesn't fail
    const today = new Date().toISOString().split("T")[0];
    const fallbackXml = buildSitemapXml([...STATIC_URLS], today);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Sitemap-Cache", "FALLBACK");
    return res.send(fallbackXml);
  }
});

router.get("/sitemap-index.xml", (_req: Request, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(xml);
});

router.get("/robots.txt", (_req: Request, res: Response) => {
  const txt = [
    "User-agent: *",
    "",
    "# Public pages — allow crawling",
    "Allow: /$",
    "Allow: /notes",
    "Allow: /notes/",
    "Allow: /pyqs",
    "Allow: /pyqs/",
    "Allow: /pyq/",
    "Allow: /mcq",
    "Allow: /tools",
    "Allow: /tools/gpa-calculator",
    "Allow: /tools/attendance-calculator",
    "Allow: /about",
    "Allow: /contact",
    "Allow: /privacy",
    "Allow: /terms",
    "",
    "# Private / authenticated — do not index",
    "Disallow: /dashboard",
    "Disallow: /todo",
    "Disallow: /pomodoro",
    "Disallow: /ai",
    "Disallow: /leaderboard",
    "Disallow: /settings",
    "Disallow: /admin",
    "Disallow: /saved",
    "Disallow: /report",
    "Disallow: /login",
    "Disallow: /setup-profile",
    "Disallow: /onboarding",
    "Disallow: /missions",
    "Disallow: /badges",
    "Disallow: /api/",
    "",
    "# Do NOT disallow /assets/ — Googlebot needs JS/CSS to render this SPA",
    "",
    "Crawl-delay: 1",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    `Sitemap: ${SITE_URL}/sitemap-index.xml`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(txt);
});

export default router;
