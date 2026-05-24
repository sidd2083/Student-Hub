/**
 * SSR meta-injection + static-file serving
 *
 * In PRODUCTION (when the frontend has been built):
 *   – /notes/:slug  → fetch note from Firestore, inject rich meta into index.html
 *   – /pyq/:slug    → fetch PYQ  from Firestore, inject rich meta into index.html
 *   – /assets/**    → served with 1-year immutable cache
 *   – everything else → index.html (SPA fallback)
 *
 * In DEVELOPMENT (no build present):
 *   – All routes call next() so Vite dev-server handles them.
 *
 * Why this matters for SEO:
 *   Googlebot struggles to execute JavaScript. Without SSR, every note page looks
 *   identical ("Student Hub — Free Study Platform") so Google ranks them all the
 *   same (poorly). With SSR each page gets a unique title + description + schema
 *   and Google crawls it as a proper article.
 */
import express, {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const router = Router();

const SITE_URL    = "https://studenthubnp.com";
const PROJECT_ID  = process.env.VITE_FIREBASE_PROJECT_ID ?? "studenthub-6bcc5";
const API_KEY     = process.env.VITE_FIREBASE_API_KEY    ?? "";

// When Express serves everything (production mode), set FRONTEND_DIST to the
// built frontend directory. Falls back to the monorepo-relative path.
const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? resolve(process.cwd(), process.env.FRONTEND_DIST)
  : resolve(process.cwd(), "../../student-hub/dist/public");

const BUILD_EXISTS = existsSync(resolve(FRONTEND_DIST, "index.html"));

// ── Firestore helpers ──────────────────────────────────────────────────────────
type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean };
type FirestoreFields = Record<string, FirestoreValue>;

function fStr(f: FirestoreFields, k: string): string {
  const v = f[k] as Record<string, unknown> | undefined;
  return (v?.["stringValue"] ?? v?.["integerValue"] ?? "") as string;
}
function fInt(f: FirestoreFields, k: string): number {
  const v = f[k] as Record<string, unknown> | undefined;
  return Number(v?.["integerValue"] ?? v?.["doubleValue"] ?? 0);
}

async function fetchFirestoreDoc(col: string, id: string): Promise<FirestoreFields | null> {
  if (!id || id.length < 10) return null;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${col}/${id}` +
      (API_KEY ? `?key=${API_KEY}` : "");
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const data = await res.json() as { fields?: FirestoreFields };
    return data.fields ?? null;
  } catch {
    return null;
  }
}

// ── Template cache ─────────────────────────────────────────────────────────────
// Read once and cache in memory. The file doesn't change at runtime.
let _tpl: string | null = null;
function getTemplate(): string | null {
  if (_tpl) return _tpl;
  const p = resolve(FRONTEND_DIST, "index.html");
  if (!existsSync(p)) return null;
  _tpl = readFileSync(p, "utf-8");
  return _tpl;
}

// ── Meta injection ─────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toSlug(str: string): string {
  return (str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

interface MetaInput {
  title:         string;
  description:   string;
  canonical:     string;
  keywords?:     string;
  ogType?:       string;
  structuredData?: string;
}

function injectMeta(html: string, m: MetaInput): string {
  const t   = esc(m.title);
  const d   = esc(m.description);
  const c   = esc(m.canonical);
  const kw  = esc(m.keywords ?? "");
  const img = esc(`${SITE_URL}/opengraph.jpg`);
  const ot  = m.ogType ?? "article";

  let result = html;

  result = result.replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`);
  result = result.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${d}" />`,
  );

  const tags = [
    kw ? `<meta name="keywords" content="${kw}" />` : "",
    `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large" />`,
    `<link rel="canonical" href="${c}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${c}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:type" content="${ot}" />`,
    `<meta property="og:site_name" content="Student Hub Nepal" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    m.structuredData ? `<script type="application/ld+json">${m.structuredData}</script>` : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  result = result.replace("</head>", `    ${tags}\n  </head>`);
  return result;
}

// ── /notes/:slug ───────────────────────────────────────────────────────────────
router.get("/notes/:slug", async (req: Request, res: Response, next: NextFunction) => {
  const tpl = getTemplate();
  if (!tpl) return next();

  const id = (req.params.slug ?? "").split("-")[0];
  const fields = await fetchFirestoreDoc("notes", id);
  if (!fields) return next();

  const grade   = fInt(fields, "grade");
  const subject = fStr(fields, "subject");
  const title   = fStr(fields, "title");
  const chapter = fStr(fields, "chapter");

  const slug      = `${id}-grade-${grade}-${toSlug(subject)}-${toSlug(title)}`;
  const canonical = `${SITE_URL}/notes/${slug}`;

  const pageTitle = chapter
    ? `${title} (${chapter}) | Grade ${grade} ${subject} Notes — Student Hub Nepal`
    : `${title} | Grade ${grade} ${subject} Notes — Student Hub Nepal`;
  const desc =
    `Free Grade ${grade} ${subject} notes — ${title}` +
    (chapter ? ` from ${chapter}` : "") +
    `. Complete chapter material for NEB & SEE exam preparation. Study on Student Hub Nepal.`;
  const kw =
    `${title.toLowerCase()}, grade ${grade} ${subject.toLowerCase()} notes, ` +
    `${subject.toLowerCase()} notes nepal` +
    (chapter ? `, ${chapter.toLowerCase()}` : "") +
    `, neb notes, see notes, nepal grade ${grade} notes`;

  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: pageTitle,
    description: desc,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: "Student Hub Nepal", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Student Hub Nepal", url: SITE_URL },
    educationalLevel: `Grade ${grade}`,
    about: { "@type": "Thing", name: `${subject} Grade ${grade}` },
    inLanguage: "en-NP",
    isAccessibleForFree: true,
  });

  const html = injectMeta(tpl, { title: pageTitle, description: desc, canonical, keywords: kw, ogType: "article", structuredData: ld });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.send(html);
});

// ── /pyq/:slug ─────────────────────────────────────────────────────────────────
router.get("/pyq/:slug", async (req: Request, res: Response, next: NextFunction) => {
  const tpl = getTemplate();
  if (!tpl) return next();

  const id = (req.params.slug ?? "").split("-")[0];
  const fields = await fetchFirestoreDoc("pyqs", id);
  if (!fields) return next();

  const grade   = fInt(fields, "grade");
  const subject = fStr(fields, "subject");
  const title   = fStr(fields, "title");
  const year    = fInt(fields, "year");

  const slug      = `${id}-grade-${grade}-${toSlug(subject)}-${year}-${toSlug(title)}`;
  const canonical = `${SITE_URL}/pyq/${slug}`;

  const pageTitle = `${subject} Grade ${grade} PYQ ${year} — ${title} | Student Hub Nepal`;
  const desc =
    `${year} past year question paper for Grade ${grade} ${subject}: ${title}. ` +
    `Practice real NEB/SEE exam questions. Free download on Student Hub Nepal.`;
  const kw =
    `${subject.toLowerCase()} pyq ${year}, grade ${grade} ${subject.toLowerCase()} past paper, ` +
    `${year} ${subject.toLowerCase()} question nepal, neb past year question ${year}, ` +
    `see past paper ${year}, grade ${grade} pyq nepal`;

  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: pageTitle,
    description: desc,
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    author: { "@type": "Organization", name: "Student Hub Nepal", url: SITE_URL },
    publisher: { "@type": "Organization", name: "Student Hub Nepal", url: SITE_URL },
    educationalLevel: `Grade ${grade}`,
    about: { "@type": "Thing", name: `${subject} Past Year Questions ${year}` },
    inLanguage: "en-NP",
    isAccessibleForFree: true,
  });

  const html = injectMeta(tpl, { title: pageTitle, description: desc, canonical, keywords: kw, ogType: "article", structuredData: ld });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.send(html);
});

// ── Static assets + SPA fallback (production only) ────────────────────────────
if (BUILD_EXISTS) {
  // Long-lived immutable cache for hashed assets (JS/CSS/images)
  router.use(
    express.static(FRONTEND_DIST, {
      maxAge: "1y",
      immutable: true,
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          (res as import("http").ServerResponse).setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  // SPA catch-all — anything not matched above gets index.html
  router.get("/*path", (_req: Request, res: Response, next: NextFunction) => {
    const tpl = getTemplate();
    if (!tpl) return next();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(tpl);
  });
}

export { BUILD_EXISTS };
export default router;
