import { Router, type Request, type Response } from "express";
import pino from "pino";

const router = Router();
const log = pino({ level: "info" });

const SITE_URL   = "https://studenthubnp.com";
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? "studenthub-6bcc5";
const API_KEY    = process.env.VITE_FIREBASE_API_KEY    ?? "";

// ── Helpers ────────────────────────────────────────────────────────────────────

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
interface FirestoreDoc { name: string; fields: FirestoreFields; }

function docId(docName: string): string { return docName.split("/").pop() ?? docName; }
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
  while (attempts < 20) {
    attempts++;
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}` +
      `?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "") +
      (API_KEY   ? `&key=${API_KEY}` : "");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) { log.error({ collection, status: res.status }, "Firestore error"); break; }
      const data = await res.json() as { documents?: FirestoreDoc[]; nextPageToken?: string };
      log.info({ collection, page: attempts, count: data.documents?.length ?? 0 }, "Firestore page fetched");
      docs.push(...(data.documents ?? []));
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    } catch (err) { log.error({ collection, err }, "Firestore fetch threw"); break; }
  }
  log.info({ collection, total: docs.length }, "Firestore fetch complete");
  return docs;
}

// ── Static URLs ────────────────────────────────────────────────────────────────

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

type UrlEntry = { loc: string; priority: string; changefreq: string };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildXml(urls: UrlEntry[], today: string): string {
  const entries = urls.map(u =>
    `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

// ── Search-engine ping ─────────────────────────────────────────────────────────
// Notifies Google and Bing that the sitemap has been updated so they re-crawl
// your notes and PYQ pages faster. Fires silently in the background — never
// blocks a request. Results are logged but errors are swallowed.

async function pingSitemapToSearchEngines(): Promise<void> {
  const sitemapUrl = encodeURIComponent(`${SITE_URL}/sitemap.xml`);

  const engines = [
    { name: "Google", url: `https://www.google.com/ping?sitemap=${sitemapUrl}` },
    { name: "Bing",   url: `https://www.bing.com/ping?sitemap=${sitemapUrl}`   },
  ];

  await Promise.allSettled(
    engines.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        log.info({ engine: name, status: res.status }, "Sitemap ping sent");
      } catch (err) {
        log.warn({ engine: name, err }, "Sitemap ping failed (non-fatal)");
      }
    }),
  );
}

// ── In-memory cache ────────────────────────────────────────────────────────────

interface SitemapCache {
  xml:         string;
  generatedAt: number;
  noteCount:   number;
  pyqCount:    number;
  isFullData:  boolean; // false = static-only fallback
}

let sitemapCache: SitemapCache | null = null;
let isGenerating = false;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function generateAndCache(pingSearchEngines = false): Promise<void> {
  if (isGenerating) return;
  isGenerating = true;
  try {
    const today = new Date().toISOString().split("T")[0];
    log.info("Sitemap: fetching Firestore collections");

    const [noteDocs, pyqDocs] = await Promise.all([fetchAll("notes"), fetchAll("pyqs")]);

    const noteUrls: UrlEntry[] = noteDocs.filter(d => d.fields).map(d => ({
      loc:        `${SITE_URL}/notes/${docId(d.name)}-grade-${fInt(d.fields, "grade")}-${toSlug(fStr(d.fields, "subject"))}-${toSlug(fStr(d.fields, "title"))}`,
      priority:   "0.75",
      changefreq: "monthly",
    }));

    const pyqUrls: UrlEntry[] = pyqDocs.filter(d => d.fields).map(d => ({
      loc:        `${SITE_URL}/pyq/${docId(d.name)}-grade-${fInt(d.fields, "grade")}-${toSlug(fStr(d.fields, "subject"))}-${fInt(d.fields, "year")}-${toSlug(fStr(d.fields, "title"))}`,
      priority:   "0.75",
      changefreq: "monthly",
    }));

    const totalUrls = STATIC_URLS.length + noteUrls.length + pyqUrls.length;
    sitemapCache = {
      xml:         buildXml([...STATIC_URLS, ...noteUrls, ...pyqUrls], today),
      generatedAt: Date.now(),
      noteCount:   noteUrls.length,
      pyqCount:    pyqUrls.length,
      isFullData:  true,
    };

    log.info(
      { notes: noteUrls.length, pyqs: pyqUrls.length, statics: STATIC_URLS.length, totalUrls },
      "Sitemap: generated successfully",
    );

    if (pingSearchEngines) {
      // Fire-and-forget: don't await so we never block a request
      pingSitemapToSearchEngines().catch(() => {});
    }
  } catch (err) {
    log.error({ err }, "Sitemap: generation failed");
  } finally {
    isGenerating = false;
  }
}

// On startup: set a static-only placeholder immediately so the VERY FIRST
// request responds instantly (no Firestore calls needed). Then kick off full
// generation in the background. Any request after ~8 s gets the complete sitemap.
(function initCache() {
  const today = new Date().toISOString().split("T")[0];
  sitemapCache = {
    xml:         buildXml([...STATIC_URLS], today),
    generatedAt: Date.now(),
    noteCount:   0,
    pyqCount:    0,
    isFullData:  false,
  };
  log.info("Sitemap: static placeholder ready — fetching dynamic URLs in background");
  generateAndCache(false).catch(() => {});
})();

// Refresh every 6 hours and ping search engines so new notes get indexed faster
setInterval(() => {
  log.info("Sitemap: scheduled 6-hour refresh");
  generateAndCache(true).catch(() => {});
}, CACHE_TTL_MS);

// ── Routes ─────────────────────────────────────────────────────────────────────

router.get("/sitemap.xml", (_req: Request, res: Response) => {
  const cache = sitemapCache!;
  const ageMin = Math.round((Date.now() - cache.generatedAt) / 60_000);

  log.info(
    { notes: cache.noteCount, pyqs: cache.pyqCount, ageMin, full: cache.isFullData },
    "Sitemap: served",
  );

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  // no-store prevents browser / CDN from caching a stale or partial version
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Sitemap-Cache", cache.isFullData ? "FULL" : "STATIC-ONLY");
  res.setHeader("X-Sitemap-Age-Min", String(ageMin));
  res.send(cache.xml);
});

router.get("/sitemap-index.xml", (_req: Request, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${SITE_URL}/sitemap.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n</sitemapindex>`
  );
});

/**
 * POST /api/sitemap/refresh
 *
 * Manually triggers a sitemap regeneration and pings Google + Bing.
 * Use this from Google Search Console or after adding new notes/PYQs.
 *
 * How to use:
 *   curl -X POST https://studenthubnp.com/api/sitemap/refresh
 *
 * Returns: { ok: true, notes, pyqs, totalUrls, pinged: ["Google","Bing"] }
 */
router.post("/api/sitemap/refresh", async (_req: Request, res: Response) => {
  log.info("Sitemap: manual refresh triggered via API");

  // Respond immediately so the caller isn't waiting 8 s
  res.json({
    ok:      true,
    message: "Sitemap refresh started in background. Google and Bing will be pinged once done.",
  });

  // Run after responding
  await generateAndCache(true);
  log.info(
    { notes: sitemapCache?.noteCount, pyqs: sitemapCache?.pyqCount },
    "Sitemap: manual refresh complete",
  );
});

/**
 * GET /api/sitemap/status
 *
 * Returns the current sitemap cache status — useful for checking if
 * the full sitemap has been generated yet.
 */
router.get("/api/sitemap/status", (_req: Request, res: Response) => {
  const cache = sitemapCache;
  if (!cache) return res.json({ ready: false });
  res.json({
    ready:       true,
    isFullData:  cache.isFullData,
    noteCount:   cache.noteCount,
    pyqCount:    cache.pyqCount,
    totalUrls:   STATIC_URLS.length + cache.noteCount + cache.pyqCount,
    ageMin:      Math.round((Date.now() - cache.generatedAt) / 60_000),
    generatedAt: new Date(cache.generatedAt).toISOString(),
  });
});

router.get("/robots.txt", (_req: Request, res: Response) => {
  const txt = [
    "User-agent: *",
    "",
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
