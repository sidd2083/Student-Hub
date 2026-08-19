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
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __ssrDir = dirname(fileURLToPath(import.meta.url));

const router = Router();

const SITE_URL    = "https://www.studenthubnp.com";
const PROJECT_ID  = process.env.VITE_FIREBASE_PROJECT_ID ?? "studenthub-6bcc5";
const API_KEY     = process.env.VITE_FIREBASE_API_KEY    ?? "";

// When Express serves everything (production mode), set FRONTEND_DIST to the
// built frontend directory. Falls back to the monorepo-relative path.
// __ssrDir is the compiled file's directory (e.g. artifacts/api-server/dist/).
// ../../student-hub/dist/public reliably resolves to the frontend build on both
// Replit (process.cwd = artifacts/api-server) and Vercel (function bundle root).
const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? resolve(process.cwd(), process.env.FRONTEND_DIST)
  : resolve(__ssrDir, "../../student-hub/dist/public");

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

  // Replace inline title and description
  result = result.replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`);
  result = result.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${d}" />`,
  );

  // ── CRITICAL: strip homepage-level tags that conflict with page-specific ones ──
  // index.html embeds a canonical pointing at the homepage root plus matching OG/
  // Twitter tags.  Leaving them in produces duplicate, contradictory tags.
  // Google reads the FIRST canonical it encounters — which is the homepage one —
  // and classifies every note/PYQ as "Alternate page with proper canonical tag",
  // preventing indexing.  Strip them ALL before injecting the correct page values.
  result = result.replace(/<link\s[^>]*rel=["']canonical["'][^>]*\/?>/gi, "");
  result = result.replace(/<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/gi, "");
  result = result.replace(/<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/?>/gi, "");

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
    `<meta property="og:image:alt" content="${t}" />`,
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

  const slugParam = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug ?? "";
  const id = slugParam.split("-")[0];
  const fields = await fetchFirestoreDoc("notes", id);
  if (!fields) return next();

  const grade   = fInt(fields, "grade");
  const subject = fStr(fields, "subject");
  const title   = fStr(fields, "title");
  const chapter = fStr(fields, "chapter");

  const slug      = `${id}-grade-${grade}-${toSlug(subject)}-${toSlug(title)}`;
  const canonical = `${SITE_URL}/notes/${slug}`;

  if (req.path !== `/notes/${slug}`) {
    res.redirect(301, canonical);
    return;
  }

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
    "@graph": [
      {
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
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Notes", item: `${SITE_URL}/notes` },
          { "@type": "ListItem", position: 3, name: `${subject} Grade ${grade}`, item: `${SITE_URL}/notes?subject=${encodeURIComponent(subject)}&grade=${grade}` },
          { "@type": "ListItem", position: 4, name: title, item: canonical },
        ],
      },
    ],
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

  const slugParam = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug ?? "";
  const id = slugParam.split("-")[0];
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
    "@graph": [
      {
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
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Past Papers (PYQ)", item: `${SITE_URL}/pyqs` },
          { "@type": "ListItem", position: 3, name: `${subject} Grade ${grade}`, item: `${SITE_URL}/pyqs` },
          { "@type": "ListItem", position: 4, name: `${title} (${year})`, item: canonical },
        ],
      },
    ],
  });

  const html = injectMeta(tpl, { title: pageTitle, description: desc, canonical, keywords: kw, ogType: "article", structuredData: ld });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.send(html);
});

// ── Static page SSR routes ─────────────────────────────────────────────────────
// Each public static page gets its own unique title, description, canonical URL,
// and structured data. Without this every page inherits homepage metadata from
// index.html and Googlebot sees them all as identical/duplicate content.

interface StaticPageMeta {
  title:           string;
  description:     string;
  canonical:       string;
  keywords:        string;
  ogType?:         string;
  structuredData?: object;
}

const STATIC_META: Record<string, StaticPageMeta> = {
  "/notes": {
    title: "Free Study Notes for Grade 9–12 Nepal — NEB & SEE | Student Hub",
    description: "Browse free study notes for Grade 9, 10, 11 and 12 students in Nepal. Mathematics, Science, English, Social Studies and more. Download or read online. Prepared for NEB and SEE exams.",
    canonical: `${SITE_URL}/notes`,
    keywords: "grade 9 notes nepal, grade 10 notes, grade 11 notes nepal, grade 12 notes, NEB notes, SEE notes, free notes nepal, mathematics notes, science notes nepal",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/notes`,
          name: "Free Study Notes for Grade 9–12 Nepal",
          description: "Browse free study notes for Grade 9–12 students in Nepal. NEB and SEE exam preparation.",
          url: `${SITE_URL}/notes`,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          inLanguage: "en-NP",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Notes", item: `${SITE_URL}/notes` },
          ],
        },
      ],
    },
  },
  "/pyqs": {
    title: "Past Year Question Papers (PYQ) Nepal — NEB & SEE | Student Hub",
    description: "Download free NEB and SEE past year question papers (PYQs) for Grade 9–12. Province-wise papers for Koshi, Bagmati, Gandaki and all provinces. Prepared for exam practice.",
    canonical: `${SITE_URL}/pyqs`,
    keywords: "NEB PYQ nepal, SEE past papers, grade 12 past questions, grade 11 PYQ, previous year questions nepal, SEE 2081 question paper, NEB 2081 question paper",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `${SITE_URL}/pyqs`,
          name: "Past Year Question Papers (PYQ) Nepal — NEB & SEE",
          description: "Download free NEB and SEE past year question papers for Grade 9–12.",
          url: `${SITE_URL}/pyqs`,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          inLanguage: "en-NP",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Past Papers (PYQ)", item: `${SITE_URL}/pyqs` },
          ],
        },
      ],
    },
  },
  "/mcq": {
    title: "MCQ Practice for Grade 9–12 Nepal — NEB & SEE | Student Hub",
    description: "Practice multiple-choice questions (MCQs) for NEB Grade 11 & 12 and SEE Grade 9 & 10 exams. Chapter-wise MCQ sets for Mathematics, Science, English and all subjects. Free, instant feedback.",
    canonical: `${SITE_URL}/mcq`,
    keywords: "MCQ practice nepal, NEB MCQ, SEE MCQ, grade 10 MCQ, grade 12 MCQ, multiple choice questions nepal, chapter wise MCQ nepal",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${SITE_URL}/mcq`,
          name: "MCQ Practice for Grade 9–12 Nepal",
          description: "Free MCQ practice for NEB and SEE exams. Chapter-wise questions for all subjects.",
          url: `${SITE_URL}/mcq`,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          inLanguage: "en-NP",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "MCQ Practice", item: `${SITE_URL}/mcq` },
          ],
        },
      ],
    },
  },
  "/tools": {
    title: "Free Study Tools for Students Nepal — GPA & Attendance Calculator | Student Hub",
    description: "Free online study tools for students in Nepal and worldwide. NEB GPA Calculator and Bunk/Attendance Calculator. Calculate your GPA or find how many classes you can miss instantly.",
    canonical: `${SITE_URL}/tools`,
    keywords: "student tools nepal, NEB GPA calculator, bunk calculator, attendance calculator nepal, free tools students nepal",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ItemList",
          "@id": `${SITE_URL}/tools`,
          name: "Free Study Tools for Students",
          description: "Free GPA Calculator and Attendance/Bunk Calculator for students.",
          url: `${SITE_URL}/tools`,
          itemListElement: [
            { "@type": "ListItem", position: 1, item: { "@type": "SoftwareApplication", name: "NEB GPA Calculator Nepal", url: `${SITE_URL}/tools/gpa-calculator`, applicationCategory: "EducationApplication" } },
            { "@type": "ListItem", position: 2, item: { "@type": "SoftwareApplication", name: "Bunk Calculator & Attendance Calculator", url: `${SITE_URL}/tools/attendance-calculator`, applicationCategory: "EducationApplication" } },
          ],
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
          ],
        },
      ],
    },
  },
  "/tools/gpa-calculator": {
    title: "GPA Calculator Nepal — NEB Class 11 & 12 GPA Calculator (Free) | Student Hub",
    description: "Free NEB GPA Calculator for Grade 11 and Grade 12 students in Nepal. Calculate your GPA instantly using the official NEB formula (75% theory + 25% practical). Supports Science and Management streams.",
    canonical: `${SITE_URL}/tools/gpa-calculator`,
    keywords: "NEB GPA calculator, grade 12 GPA nepal, class 11 GPA calculator, NEB grade calculator, GPA calculator nepal 2082, grade 11 GPA calculator nepal",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          "@id": `${SITE_URL}/tools/gpa-calculator`,
          name: "NEB GPA Calculator Nepal — Grade 11 & 12",
          applicationCategory: "EducationApplication",
          operatingSystem: "Web Browser",
          url: `${SITE_URL}/tools/gpa-calculator`,
          description: "Free NEB GPA Calculator for Grade 11 and Grade 12. Uses official NEB formula with 75% theory and 25% practical marks.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: ["NEB Grade 11 & 12 GPA calculation", "Science and Management stream support", "75% theory + 25% practical formula", "Free, no sign-up"],
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
            { "@type": "ListItem", position: 3, name: "GPA Calculator", item: `${SITE_URL}/tools/gpa-calculator` },
          ],
        },
      ],
    },
  },
  "/tools/attendance-calculator": {
    title: "Bunk Calculator — Free Attendance Calculator | How Many Classes Can I Miss? India & Worldwide",
    description: "Free bunk calculator & attendance calculator. Instantly see how many classes you can miss (bunk) while staying above 75%, 80%, 85% or any required %. Works for India (UGC/CBSE/DU/IIT/NIT/Mumbai University/Anna University/VTU), Nepal, USA (F-1 visa), UK, Australia (ESOS), Canada. No sign-up.",
    canonical: `${SITE_URL}/tools/attendance-calculator`,
    keywords: "bunk calculator, attendance calculator, how many classes can i bunk, how many classes can i miss, attendance percentage calculator, 75 attendance calculator, college bunk calculator, attendance calculator india, UGC 75 attendance rule, how many classes can i skip, bunk class calculator, attendance calculator for 75 percent, 75 percent attendance rule, attendance calculator online free, class attendance calculator, college attendance calculator, CBSE attendance calculator, DU attendance calculator, Delhi university attendance calculator, Mumbai university attendance calculator, Anna university attendance calculator, VTU attendance calculator, attendance shortage calculator, lecture attendance calculator, bunking calculator college, how many lectures can i miss, attendance recovery calculator, attendance shortage india, 80 percent attendance calculator, 85 percent attendance calculator, attendance percentage formula, bunk calculator nepal, attendance calculator usa, attendance calculator uk, attendance calculator australia, F1 visa attendance, SEVIS attendance",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "SoftwareApplication",
          "@id": `${SITE_URL}/tools/attendance-calculator`,
          name: "Bunk Calculator & Attendance Calculator — How Many Classes Can I Miss? Free",
          applicationCategory: "EducationApplication",
          operatingSystem: "Web Browser",
          url: `${SITE_URL}/tools/attendance-calculator`,
          description: "Free bunk calculator and attendance calculator. Instantly find how many classes you can miss (bunk) while staying above 75%, 80%, 85% or any required percentage. Works for India (UGC/CBSE), Nepal, USA, UK, Australia.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: [
            "Bunk calculator — exactly how many classes you can miss",
            "Instant attendance percentage calculation",
            "Recovery calculator — how many consecutive classes to attend to reach 75%",
            "Works for 75%, 80%, 85%, 90% or any custom requirement",
            "India UGC 75% rule, CBSE, DU, Mumbai University, IIT, NIT support",
            "Global: USA, UK, Australia, Canada, Nepal, Pakistan",
            "Free, no login, no sign-up",
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How many classes can I bunk or miss?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Classes you can bunk = Floor(Total Classes × (1 − Required%/100)) − Classes already missed. Example: 100 total classes, 75% rule → you can miss at most 25 total. If you've already missed 10, you can only miss 15 more. Use the bunk calculator above by entering your total classes, classes attended, and required percentage — it shows the answer instantly.",
              },
            },
            {
              "@type": "Question",
              name: "How do I calculate my attendance percentage?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Attendance % = (Classes Attended ÷ Total Classes Held) × 100. Example: 65 attended out of 80 total = (65 ÷ 80) × 100 = 81.25%. Enter your numbers above and the attendance calculator shows your percentage instantly.",
              },
            },
            {
              "@type": "Question",
              name: "What is the 75% attendance rule in Indian colleges?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "UGC (University Grants Commission) mandates a minimum 75% attendance for all affiliated colleges in India, including DU, Mumbai University, Anna University, VTU, Osmania, and Pune University. Medical colleges under MCI/NMC require 75–80%. IITs and NITs enforce 75% strictly with grade penalties for shortage. Falling below 75% can result in being barred from semester examinations.",
              },
            },
            {
              "@type": "Question",
              name: "How many classes do I need to attend to recover to 75%?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Classes needed = (Required% × Total − 100 × Attended) ÷ (100 − Required%). Example: 60 total classes, 40 attended (66.7%), 75% required → (75×60 − 100×40) ÷ 25 = 20 consecutive classes you must attend without missing any. The bunk calculator shows this recovery number instantly when your attendance is below the required minimum.",
              },
            },
            {
              "@type": "Question",
              name: "What is the attendance rule for F-1 visa students in the USA?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "US universities do not have a federal attendance mandate, but most set their own policies between 75% and 85%. International students on F-1 visas must maintain full-time status. Excessive absences can trigger a SEVIS record termination report, which puts the student's visa status at risk. Always check your specific university's policy and use this attendance calculator to track your current percentage.",
              },
            },
            {
              "@type": "Question",
              name: "Does this bunk calculator work for 80% or 85% attendance requirements?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes — this attendance calculator works for any required percentage. Change the 'Required %' field to 80% (medical colleges India, Australian student visa), 85% (UK student visa, many Canadian universities), 90% (some professional programs), or any value your institution requires. The bunk calculator recalculates instantly.",
              },
            },
          ],
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
            { "@type": "ListItem", position: 3, name: "Attendance Calculator", item: `${SITE_URL}/tools/attendance-calculator` },
          ],
        },
      ],
    },
  },
  "/about": {
    title: "About Student Hub Nepal — Free Study Platform for Grade 9–12",
    description: "Learn about Student Hub Nepal, a free online study platform built for Grade 9–12 students in Nepal. Notes, PYQs, MCQ practice, GPA calculator and AI tutor for NEB and SEE exam preparation.",
    canonical: `${SITE_URL}/about`,
    keywords: "about student hub nepal, student hub nepal team, free study platform nepal",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "@id": `${SITE_URL}/about`,
      name: "About Student Hub Nepal",
      description: "Free study platform for Grade 9–12 students in Nepal.",
      url: `${SITE_URL}/about`,
      breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "About", item: `${SITE_URL}/about` },
      ]},
    },
  },
  "/contact": {
    title: "Contact Student Hub Nepal | Support & Feedback",
    description: "Get in touch with the Student Hub Nepal team. Send feedback, report issues, or reach out for support. We're here to help Grade 9–12 students across Nepal.",
    canonical: `${SITE_URL}/contact`,
    keywords: "contact student hub nepal, student hub support, student hub feedback",
    ogType: "website",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      "@id": `${SITE_URL}/contact`,
      name: "Contact Student Hub Nepal",
      url: `${SITE_URL}/contact`,
      breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE_URL}/contact` },
      ]},
    },
  },
  "/privacy": {
    title: "Privacy Policy | Student Hub Nepal",
    description: "Read the Student Hub Nepal privacy policy. Learn how we collect, use and protect your data.",
    canonical: `${SITE_URL}/privacy`,
    keywords: "student hub privacy policy, student hub nepal data policy",
    ogType: "website",
  },
  "/terms": {
    title: "Terms of Service | Student Hub Nepal",
    description: "Read the Student Hub Nepal terms of service and usage policy.",
    canonical: `${SITE_URL}/terms`,
    keywords: "student hub terms of service, student hub nepal terms",
    ogType: "website",
  },
};

// Register SSR handler for every static page
for (const [path, meta] of Object.entries(STATIC_META)) {
  router.get(path, (req: Request, res: Response, next: NextFunction) => {
    const tpl = getTemplate();
    if (!tpl) return next();
    const html = injectMeta(tpl, {
      title:           meta.title,
      description:     meta.description,
      canonical:       meta.canonical,
      keywords:        meta.keywords,
      ogType:          meta.ogType,
      structuredData:  meta.structuredData ? JSON.stringify(meta.structuredData) : undefined,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.send(html);
  });
}

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
