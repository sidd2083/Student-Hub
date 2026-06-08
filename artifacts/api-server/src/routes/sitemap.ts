import { Router, type Request, type Response } from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import pino from "pino";

const router = Router();
const log = pino({ level: "info" });

const SITE_URL   = "https://www.studenthubnp.com";
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? "studenthub-6bcc5";
const API_KEY    = process.env.VITE_FIREBASE_API_KEY    ?? "";

// Disk cache path — survives server restarts so Google never gets stale/missing URLs
const DISK_CACHE_PATH = resolve(process.cwd(), "sitemap_cache.json");
const CACHE_TTL_MS    = 60 * 60 * 1000; // 1 hour

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

type FSFields = Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number }>;
interface FSDoc { name: string; fields: FSFields; }

const docId = (n: string) => n.split("/").pop() ?? n;
const fStr  = (f: FSFields, k: string) => f[k]?.stringValue ?? f[k]?.integerValue ?? "";
const fInt  = (f: FSFields, k: string) => Number(f[k]?.integerValue ?? f[k]?.doubleValue ?? 0);

async function fetchAll(collection: string): Promise<FSDoc[]> {
  const docs: FSDoc[] = [];
  let pageToken = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}` +
      `?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "") +
      (API_KEY   ? `&key=${API_KEY}` : "");
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) { log.error({ collection, status: res.status }, "Firestore error"); break; }
      const data = await res.json() as { documents?: FSDoc[]; nextPageToken?: string };
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
  { loc: `${SITE_URL}/creators`,                    priority: "0.85", changefreq: "weekly"  },
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

// ── Disk cache ─────────────────────────────────────────────────────────────────
// Persists the last successful full sitemap to disk so server restarts never
// cause a gap where Google sees only the static-only fallback.

interface DiskCache {
  xml:          string;
  generatedAt:  number; // epoch ms
  noteCount:    number;
  pyqCount:     number;
  creatorCount: number;
}

function loadFromDisk(): DiskCache | null {
  try {
    if (!existsSync(DISK_CACHE_PATH)) return null;
    const raw = readFileSync(DISK_CACHE_PATH, "utf-8");
    const c = JSON.parse(raw) as DiskCache;
    const ageMs = Date.now() - c.generatedAt;
    if (ageMs > CACHE_TTL_MS * 2) { // discard if > 12 hours old
      log.info("Sitemap: disk cache too old, ignoring");
      return null;
    }
    log.info({ noteCount: c.noteCount, pyqCount: c.pyqCount, creatorCount: c.creatorCount ?? 0, ageMin: Math.round(ageMs / 60_000) }, "Sitemap: loaded from disk cache");
    return c;
  } catch {
    return null;
  }
}

function saveToDisk(c: DiskCache): void {
  try {
    writeFileSync(DISK_CACHE_PATH, JSON.stringify(c), "utf-8");
    log.info({ noteCount: c.noteCount, pyqCount: c.pyqCount }, "Sitemap: saved to disk cache");
  } catch (err) {
    log.warn({ err }, "Sitemap: disk save failed (non-fatal)");
  }
}

// ── In-memory cache (loaded from disk on startup) ─────────────────────────────

interface SitemapCache extends DiskCache { isFullData: boolean; }

let sitemapCache: SitemapCache;
let isGenerating = false;

// ── Search-engine ping ─────────────────────────────────────────────────────────

async function pingSearchEngines(): Promise<void> {
  const sitemapUrl = encodeURIComponent(`${SITE_URL}/sitemap.xml`);
  const engines = [
    { name: "Google", url: `https://www.google.com/ping?sitemap=${sitemapUrl}` },
    { name: "Bing",   url: `https://www.bing.com/ping?sitemap=${sitemapUrl}`   },
  ];
  await Promise.allSettled(engines.map(async ({ name, url }) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      log.info({ engine: name, status: res.status }, "Sitemap ping sent");
    } catch (err) {
      log.warn({ engine: name, err }, "Sitemap ping failed (non-fatal)");
    }
  }));
}

// ── Generation ─────────────────────────────────────────────────────────────────

async function generateAndCache(pingAfter = false): Promise<void> {
  if (isGenerating) return;
  isGenerating = true;
  try {
    const today = new Date().toISOString().split("T")[0];
    log.info("Sitemap: fetching Firestore collections");

    const [noteDocs, pyqDocs, creatorDocs] = await Promise.all([
      fetchAll("notes"),
      fetchAll("pyqs"),
      fetchAll("creators"),
    ]);

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

    // Individual creator profile URLs — visible creators only
    const creatorUrls: UrlEntry[] = creatorDocs
      .filter(d => d.fields && d.fields.visible?.booleanValue !== false)
      .map(d => ({
        loc:        `${SITE_URL}/creators/${docId(d.name)}-${toSlug(fStr(d.fields, "name"))}`,
        priority:   "0.80",
        changefreq: "weekly",
      }));

    const disk: DiskCache = {
      xml:          buildXml([...STATIC_URLS, ...noteUrls, ...pyqUrls, ...creatorUrls], today),
      generatedAt:  Date.now(),
      noteCount:    noteUrls.length,
      pyqCount:     pyqUrls.length,
      creatorCount: creatorUrls.length,
    };

    sitemapCache = { ...disk, isFullData: true };
    saveToDisk(disk);

    log.info(
      { notes: noteUrls.length, pyqs: pyqUrls.length, creators: creatorUrls.length, total: STATIC_URLS.length + noteUrls.length + pyqUrls.length + creatorUrls.length },
      "Sitemap: generated",
    );

    if (pingAfter) pingSearchEngines().catch(() => {});
  } catch (err) {
    log.error({ err }, "Sitemap: generation failed");
  } finally {
    isGenerating = false;
  }
}

// ── Startup ────────────────────────────────────────────────────────────────────
// 1. Try to load the last full sitemap from disk → serves ALL URLs instantly.
// 2. If disk is empty/stale, set static-only placeholder so the first request
//    never hangs (Google gets at least the static URLs immediately).
// 3. Either way, kick off a fresh background generation.

(function initCache() {
  const disk = loadFromDisk();
  if (disk) {
    sitemapCache = { ...disk, isFullData: true };
    log.info("Sitemap: disk cache ready — no cold-start delay");
  } else {
    const today = new Date().toISOString().split("T")[0];
    sitemapCache = {
      xml:          buildXml([...STATIC_URLS], today),
      generatedAt:  Date.now(),
      noteCount:    0,
      pyqCount:     0,
      creatorCount: 0,
      isFullData:   false,
    };
    log.info("Sitemap: no disk cache — static placeholder active, generating full sitemap in background");
  }
  // Always refresh in background to keep URLs up to date
  generateAndCache(false).catch(() => {});
})();

// Refresh every 6 hours and ping search engines
setInterval(() => {
  log.info("Sitemap: scheduled 6-hour refresh");
  generateAndCache(true).catch(() => {});
}, CACHE_TTL_MS);

// ── Routes ─────────────────────────────────────────────────────────────────────

router.get("/sitemap.xml", async (_req: Request, res: Response) => {
  // On serverless (Vercel) cold starts, the background generation may not
  // have completed yet. Wait for it so we always return full data.
  if (!sitemapCache.isFullData) {
    if (isGenerating) {
      // Poll until the in-progress generation finishes (max 15s)
      await new Promise<void>((resolve) => {
        const deadline = Date.now() + 15_000;
        const poll = setInterval(() => {
          if (!isGenerating || Date.now() > deadline) {
            clearInterval(poll);
            resolve();
          }
        }, 100);
      });
    } else {
      // Nothing running — generate synchronously now
      await generateAndCache(false);
    }
  }

  const { noteCount, pyqCount, generatedAt, isFullData, xml } = sitemapCache;
  log.info(
    { notes: noteCount, pyqs: pyqCount, ageMin: Math.round((Date.now() - generatedAt) / 60_000), full: isFullData },
    "Sitemap: served",
  );
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.setHeader("X-Sitemap-Cache", isFullData ? "FULL" : "STATIC-ONLY");
  res.send(xml);
});

router.get("/sitemap-index.xml", (_req: Request, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${SITE_URL}/sitemap.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n</sitemapindex>`
  );
});

router.post("/api/sitemap/refresh", async (_req: Request, res: Response) => {
  res.json({ ok: true, message: "Sitemap refresh started. Google and Bing will be pinged once done." });
  await generateAndCache(true);
  log.info({ notes: sitemapCache.noteCount, pyqs: sitemapCache.pyqCount }, "Sitemap: manual refresh complete");
});

/**
 * Exported so other routes (e.g. upload) can trigger a background refresh
 * when new content is added without waiting for the next scheduled cycle.
 */
export function triggerSitemapRefresh(): void {
  generateAndCache(true).catch((err) =>
    log.warn({ err }, "Sitemap: background refresh after upload failed (non-fatal)")
  );
}

/**
 * Fire a Vercel deploy hook so the static sitemap is rebuilt with latest
 * Firestore data.  The hook URL is kept server-side so it never reaches
 * the browser.  Errors are non-fatal — the hourly refresh is the fallback.
 */
async function triggerVercelDeploy(reason: string): Promise<void> {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    log.info("[Sitemap] VERCEL_DEPLOY_HOOK_URL not set — skipping redeploy trigger");
    return;
  }
  try {
    const res = await fetch(hookUrl, { method: "POST", signal: AbortSignal.timeout(10_000) });
    log.info({ status: res.status, reason }, "[Sitemap] Vercel deploy hook triggered");
  } catch (err) {
    log.warn({ err, reason }, "[Sitemap] Vercel deploy hook failed (non-fatal)");
  }
}

router.post("/api/sitemap/redeploy", async (_req: Request, res: Response) => {
  res.json({ ok: true, message: "Redeploy triggered — sitemap will update in ~1-2 minutes." });
  await triggerVercelDeploy("admin-content-change");
});

router.get("/api/sitemap/status", (_req: Request, res: Response) => {
  const { noteCount, pyqCount, creatorCount, generatedAt, isFullData } = sitemapCache;
  res.json({
    ready:        true,
    isFullData,
    noteCount,
    pyqCount,
    creatorCount: creatorCount ?? 0,
    totalUrls:    STATIC_URLS.length + noteCount + pyqCount + (creatorCount ?? 0),
    ageMin:       Math.round((Date.now() - generatedAt) / 60_000),
    generatedAt:  new Date(generatedAt).toISOString(),
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
    "Allow: /creators",
    "Allow: /creators/",
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
