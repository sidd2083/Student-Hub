import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const PROJECT_ID = "studenthub-6bcc5";
const SITE_URL   = "https://studenthubnp.com";
const FIRESTORE  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedXml: string | null = null;
let cacheExpiry = 0;

// ── Slug helpers (mirrors artifacts/student-hub/src/lib/slugs.ts) ──────────────
function toSlug(str: string): string {
  return (str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function noteUrl(n: { id: string; grade: number; subject: string; title: string }): string {
  return `/notes/${n.id}-grade-${n.grade}-${toSlug(n.subject)}-${toSlug(n.title)}`;
}

function pyqUrl(p: { id: string; grade: number; subject: string; title: string; year: number }): string {
  return `/pyq/${p.id}-grade-${p.grade}-${toSlug(p.subject)}-${p.year}-${toSlug(p.title)}`;
}

// ── Firestore REST response parser ────────────────────────────────────────────
interface FirestoreField {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
}

function str(fields: Record<string, FirestoreField>, key: string): string {
  return fields?.[key]?.stringValue ?? "";
}

function num(fields: Record<string, FirestoreField>, key: string): number {
  const f = fields?.[key];
  if (f?.integerValue !== undefined) return parseInt(f.integerValue, 10);
  if (f?.doubleValue  !== undefined) return f.doubleValue;
  return 0;
}

function ts(fields: Record<string, FirestoreField>, key: string): string {
  const v = fields?.[key]?.timestampValue ?? fields?.[key]?.stringValue;
  if (!v) return "";
  try { return new Date(v).toISOString().split("T")[0]; } catch { return ""; }
}

interface FsDocument {
  name: string;
  fields?: Record<string, FirestoreField>;
}

// ── Firestore fetch with pagination ──────────────────────────────────────────
async function fetchAll(collection: string): Promise<FsDocument[]> {
  const docs: FsDocument[] = [];
  let pageToken: string | undefined;

  do {
    const url =
      `${FIRESTORE}/${collection}?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      logger.warn(`[Sitemap] Firestore ${collection} returned ${resp.status}`);
      break;
    }

    const data = (await resp.json()) as { documents?: FsDocument[]; nextPageToken?: string };
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return docs;
}

// ── XML escaping ──────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod?: string, changefreq?: string, priority?: string): string {
  return [
    "  <url>",
    `    <loc>${esc(SITE_URL + loc)}</loc>`,
    lastmod    ? `    <lastmod>${lastmod}</lastmod>` : "",
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
    priority   ? `    <priority>${priority}</priority>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");
}

// ── Sitemap builder ───────────────────────────────────────────────────────────
async function buildSitemap(): Promise<string> {
  const today = new Date().toISOString().split("T")[0];

  const staticUrls = [
    urlEntry("/",                          today, "weekly",  "1.0"),
    urlEntry("/notes",                     today, "daily",   "0.95"),
    urlEntry("/pyqs",                      today, "weekly",  "0.90"),
    urlEntry("/tools",                     today, "monthly", "0.90"),
    urlEntry("/tools/gpa-calculator",      today, "weekly",  "1.0"),
    urlEntry("/tools/attendance-calculator", today, "weekly", "1.0"),
    urlEntry("/about",                     today, "monthly", "0.60"),
    urlEntry("/contact",                   today, "monthly", "0.50"),
    urlEntry("/privacy",                   today, "yearly",  "0.40"),
    urlEntry("/terms",                     today, "yearly",  "0.40"),
  ];

  let noteUrls: string[] = [];
  let pyqUrls:  string[] = [];

  try {
    const [noteDocs, pyqDocs] = await Promise.all([
      fetchAll("notes"),
      fetchAll("pyqs"),
    ]);

    noteUrls = noteDocs
      .filter(d => d.fields)
      .map(d => {
        const f = d.fields!;
        const id = d.name.split("/").pop() ?? "";
        if (!id || !str(f, "title") || !str(f, "subject")) return "";
        const noIndex = f["noIndex"]?.booleanValue === true;
        if (noIndex) return "";

        const url  = noteUrl({ id, grade: num(f, "grade"), subject: str(f, "subject"), title: str(f, "title") });
        const mod  = ts(f, "updatedAt") || ts(f, "createdAt") || today;
        return urlEntry(url, mod, "monthly", "0.80");
      })
      .filter(Boolean);

    pyqUrls = pyqDocs
      .filter(d => d.fields)
      .map(d => {
        const f = d.fields!;
        const id = d.name.split("/").pop() ?? "";
        if (!id || !str(f, "title") || !str(f, "subject")) return "";
        const noIndex = f["noIndex"]?.booleanValue === true;
        if (noIndex) return "";

        const url  = pyqUrl({ id, grade: num(f, "grade"), subject: str(f, "subject"), title: str(f, "title"), year: num(f, "year") });
        const mod  = ts(f, "updatedAt") || ts(f, "createdAt") || today;
        return urlEntry(url, mod, "yearly", "0.75");
      })
      .filter(Boolean);

    logger.info(`[Sitemap] Built with ${noteUrls.length} notes + ${pyqUrls.length} PYQs`);
  } catch (err) {
    logger.error({ err }, "[Sitemap] Failed to fetch Firestore data — returning static-only sitemap");
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    "",
    "  <!-- Static pages -->",
    ...staticUrls,
    "",
    noteUrls.length ? "  <!-- Notes pages -->" : "",
    ...noteUrls,
    "",
    pyqUrls.length ? "  <!-- PYQ pages -->" : "",
    ...pyqUrls,
    "",
    `</urlset>`,
  ].filter(s => s !== undefined).join("\n");
}

// ── Route handler ─────────────────────────────────────────────────────────────
router.get("/sitemap.xml", async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (!cachedXml || now > cacheExpiry) {
      cachedXml    = await buildSitemap();
      cacheExpiry  = now + CACHE_TTL_MS;
    }

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600");
    res.send(cachedXml);
  } catch (err) {
    logger.error({ err }, "[Sitemap] Unexpected error");
    res.status(500).send("<?xml version=\"1.0\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"/>");
  }
});

export default router;
