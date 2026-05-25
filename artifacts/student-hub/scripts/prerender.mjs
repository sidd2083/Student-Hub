import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SITE_URL    = "https://www.studenthubnp.com";
const PROJECT_ID  = "studenthub-6bcc5";

// Every URL here gets its own static index.html in the build output.
// Vercel serves these directly — static files always beat the /(.*) rewrite.
const ROUTES = [
  { url: "/tools/gpa-calculator",        outDir: "tools/gpa-calculator" },
  { url: "/tools/attendance-calculator", outDir: "tools/attendance-calculator" },
  { url: "/tools",                        outDir: "tools" },
  { url: "/about",                        outDir: "about" },
  { url: "/contact",                      outDir: "contact" },
  { url: "/privacy-policy",              outDir: "privacy-policy" },
  { url: "/terms",                        outDir: "terms" },
  { url: "/notes",                        outDir: "notes" },
  { url: "/pyqs",                         outDir: "pyqs" },
  { url: "/mcq",                          outDir: "mcq" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toSlug(str) {
  return (str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function fStr(fields, k) {
  const v = fields?.[k];
  return (v?.stringValue ?? v?.integerValue ?? "");
}

function fInt(fields, k) {
  const v = fields?.[k];
  return Number(v?.integerValue ?? v?.doubleValue ?? 0);
}

// Strip HTML tags and decode entities → plain readable text for auto-descriptions
function htmlToText(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// ── Meta injection ─────────────────────────────────────────────────────────────
// Mirrors the same logic in artifacts/api-server/src/routes/ssr.ts
// CRITICAL: strips the homepage-level canonical/OG/Twitter tags that are
// hardcoded in index.html before injecting page-specific ones.
// Without the strip step Google reads the FIRST canonical (homepage) and marks
// every note/PYQ as "Alternate page with proper canonical tag".
function injectMeta(html, { title, description, canonical, keywords, ogType, structuredData, noIndex = false }) {
  const t  = esc(title);
  const d  = esc(description);
  const c  = esc(canonical);
  const kw = esc(keywords ?? "");
  const ot = ogType ?? "article";
  const img = esc(`${SITE_URL}/opengraph.jpg`);

  let result = html;

  result = result.replace(/<title>[^<]*<\/title>/i, `<title>${t}</title>`);
  result = result.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${d}" />`,
  );

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
    noIndex
      ? `<meta name="robots" content="noindex,nofollow" />`
      : `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large" />`,
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
    structuredData ? `<script type="application/ld+json">${structuredData}</script>` : "",
  ].filter(Boolean).join("\n    ");

  return result.replace("</head>", `    ${tags}\n  </head>`);
}

// ── Firestore REST fetch (handles pagination) ──────────────────────────────────
async function fetchCollection(col) {
  const all = [];
  let pageToken = "";
  try {
    do {
      const url =
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${col}?pageSize=300` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) { console.warn(`  ⚠  Firestore fetch failed for ${col}: ${res.status}`); break; }
      const data = await res.json();
      all.push(...(data.documents ?? []));
      pageToken = data.nextPageToken ?? "";
    } while (pageToken);
  } catch (err) {
    console.warn(`  ⚠  Firestore fetch error for ${col}: ${err.message}`);
  }
  return all;
}

// ── Content HTML builders ──────────────────────────────────────────────────────
// React uses createRoot (NOT hydrateRoot), so it REPLACES #root content on load.
// The HTML we inject here is crawled by Google but replaced for real users.
// Strip <script> tags from Firestore content for safety.
function safeContent(raw) {
  if (!raw) return "";
  return raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function noteBodyHtml(title, grade, subject, chapter, content, contentType) {
  const subjectLine = [
    subject ? `<strong>Subject:</strong> ${esc(subject)}` : "",
    grade   ? `<strong>Grade:</strong> ${grade}` : "",
    chapter ? `<strong>Chapter:</strong> ${esc(chapter)}` : "",
  ].filter(Boolean).join(" &nbsp;|&nbsp; ");

  let contentBlock = "";
  if (content && (contentType === "html" || !contentType)) {
    contentBlock = `<div class="note-body">${safeContent(content)}</div>`;
  } else if (content && contentType === "text") {
    contentBlock = `<div class="note-body">${content.split("\n").map(l => `<p>${esc(l)}</p>`).join("")}</div>`;
  }

  return `<main style="max-width:860px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif">
  <nav style="font-size:13px;color:#6b7280;margin-bottom:16px">
    <a href="/" style="color:#3b82f6">Student Hub Nepal</a> &rsaquo;
    <a href="/notes" style="color:#3b82f6">Notes</a> &rsaquo;
    <span>${esc(title)}</span>
  </nav>
  <h1 style="font-size:1.6rem;font-weight:700;color:#111827;margin:0 0 8px">${esc(title)}</h1>
  <p style="font-size:14px;color:#6b7280;margin:0 0 20px">${subjectLine}</p>
  ${contentBlock}
  <p style="margin-top:32px;font-size:14px;color:#6b7280">
    Free study notes for Grade ${grade} students in Nepal. Available on
    <a href="${SITE_URL}" style="color:#3b82f6">Student Hub Nepal</a>.
  </p>
</main>`;
}

function pyqBodyHtml(title, grade, subject, year) {
  return `<main style="max-width:860px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif">
  <nav style="font-size:13px;color:#6b7280;margin-bottom:16px">
    <a href="/" style="color:#3b82f6">Student Hub Nepal</a> &rsaquo;
    <a href="/pyqs" style="color:#3b82f6">PYQ Papers</a> &rsaquo;
    <span>${esc(title)}</span>
  </nav>
  <h1 style="font-size:1.6rem;font-weight:700;color:#111827;margin:0 0 8px">${esc(subject)} Grade ${grade} Past Year Question — ${year}</h1>
  <p style="font-size:14px;color:#6b7280;margin:0 0 16px">
    <strong>Subject:</strong> ${esc(subject)} &nbsp;|&nbsp;
    <strong>Grade:</strong> ${grade} &nbsp;|&nbsp;
    <strong>Year:</strong> ${year}
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px">
    ${esc(title)}. This is the ${year} ${esc(subject)} past year question paper (PYQ) for Grade ${grade}
    students in Nepal. Practice real NEB/SEE exam questions to prepare for your upcoming examination.
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px">
    The ${year} Grade ${grade} ${esc(subject)} question paper covers key topics from the NEB curriculum.
    Solving past year questions is one of the most effective ways to prepare for the SEE and NEB examinations.
    Access this and hundreds more past year papers free on Student Hub Nepal.
  </p>
  <p style="font-size:14px;color:#6b7280">
    Free past year question papers for Grade 9–12 students in Nepal. Available on
    <a href="${SITE_URL}" style="color:#3b82f6">Student Hub Nepal</a>.
  </p>
</main>`;
}

// ── Fetch all custom SEO meta saved via the Admin SEO Panel ───────────────────
// Keys are like "note_{id}" and "pyq_{id}" — same as the Firestore doc IDs.
async function fetchSeoMetaMap() {
  const docs = await fetchCollection("seo_meta");
  const map  = new Map();
  for (const d of docs) {
    const key = d.name.split("/").pop();
    map.set(key, d.fields ?? {});
  }
  console.log(`  ✓  ${map.size} custom SEO overrides loaded from Admin SEO Panel`);
  return map;
}

// ── Pre-render individual note pages ──────────────────────────────────────────
async function prerenderNotes(template, seoMetaMap) {
  console.log("\n  📄 Pre-rendering individual note pages...");
  const docs = await fetchCollection("notes");
  if (!docs.length) { console.warn("  ⚠  No notes fetched from Firestore — skipping individual note pages"); return 0; }

  let ok = 0;
  for (const document of docs) {
    try {
      const id          = document.name.split("/").pop();
      const f           = document.fields ?? {};
      const grade       = fInt(f, "grade");
      const subject     = fStr(f, "subject");
      const title       = fStr(f, "title");
      const chapter     = fStr(f, "chapter");
      const content     = fStr(f, "content");
      const contentType = fStr(f, "contentType");

      if (!grade || !subject || !title) continue;

      const slug      = `${id}-grade-${grade}-${toSlug(subject)}-${toSlug(title)}`;
      const canonical = `${SITE_URL}/notes/${slug}`;

      // ── SEO: auto-generate from content; Admin Panel overrides only if complete ──
      const seo     = seoMetaMap.get(`note_${id}`) ?? {};
      const noIndex = seo.noIndex?.booleanValue ?? false;

      const autoTitle = chapter
        ? `${title} (${chapter}) | Grade ${grade} ${subject} Notes — Student Hub Nepal`
        : `${title} | Grade ${grade} ${subject} Notes — Student Hub Nepal`;

      // Use real note content for description so Google ranks on actual text
      const contentText = htmlToText(content);
      const autoDesc = contentText.length > 80
        ? contentText.slice(0, 155).replace(/\s+\S*$/, "") + "…"
        : `Free Grade ${grade} ${subject} notes on ${title}` +
          (chapter ? ` (${chapter})` : "") +
          ". Complete NEB & SEE exam preparation material. Study free on Student Hub Nepal.";

      const autoKw =
        `${title.toLowerCase()}, grade ${grade} ${subject.toLowerCase()} notes, ` +
        `${subject.toLowerCase()} notes nepal` +
        (chapter ? `, ${chapter.toLowerCase()}` : "") +
        `, neb notes, see notes, nepal grade ${grade} notes`;

      // Only use Admin SEO override if it's meaningfully long (not a draft/stub)
      const customTitle = fStr(seo, "seoTitle");
      const customDesc  = fStr(seo, "description");
      const customKw    = fStr(seo, "keywords");
      const pageTitle = customTitle.length >= 30 ? customTitle : autoTitle;
      const desc      = customDesc.length  >= 50 ? customDesc  : autoDesc;
      const kw        = customKw.length    >= 10 ? customKw    : autoKw;
      const customLd  = fStr(seo, "structuredData");

      const autoLd = JSON.stringify({
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

      const bodyHtml = noteBodyHtml(title, grade, subject, chapter, content, contentType);
      let html = template.replace("<!--APP_HTML-->", bodyHtml);
      html = injectMeta(html, {
        title: pageTitle,
        description: desc,
        canonical: fStr(seo, "canonicalUrl") || canonical,
        keywords: kw,
        ogType: fStr(seo, "ogType") || "article",
        structuredData: customLd || autoLd,
        noIndex,
      });

      const outPath = resolve(ROOT, "dist/public/notes", slug);
      mkdirSync(outPath, { recursive: true });
      writeFileSync(resolve(outPath, "index.html"), html, "utf-8");
      const flag = seoMetaMap.has(`note_${id}`) ? " [custom SEO]" : "";
      console.log(`  ✓  /notes/${slug}${flag}`);
      ok++;
    } catch (err) {
      console.warn(`  ⚠  Note skipped: ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`  → ${ok} note pages pre-rendered`);
  return ok;
}

// ── Pre-render individual PYQ pages ───────────────────────────────────────────
async function prerenderPyqs(template, seoMetaMap) {
  console.log("\n  📄 Pre-rendering individual PYQ pages...");
  const docs = await fetchCollection("pyqs");
  if (!docs.length) { console.warn("  ⚠  No PYQs fetched from Firestore — skipping individual PYQ pages"); return 0; }

  let ok = 0;
  for (const document of docs) {
    try {
      const id      = document.name.split("/").pop();
      const f       = document.fields ?? {};
      const grade   = fInt(f, "grade");
      const subject = fStr(f, "subject");
      const title   = fStr(f, "title");
      const year    = fInt(f, "year");

      if (!grade || !subject || !title) continue;

      const slug      = `${id}-grade-${grade}-${toSlug(subject)}-${year}-${toSlug(title)}`;
      const canonical = `${SITE_URL}/pyq/${slug}`;

      // ── SEO: auto-generate from content; Admin Panel overrides only if complete ──
      const seo     = seoMetaMap.get(`pyq_${id}`) ?? {};
      const noIndex = seo.noIndex?.booleanValue ?? false;

      const autoTitle = `${subject} Grade ${grade} PYQ ${year} — ${title} | Student Hub Nepal`;
      const autoDesc  =
        `${year} Grade ${grade} ${subject} past year question paper: ${title}. ` +
        `Practice real NEB/SEE exam questions for Nepal students. ` +
        `Free download on Student Hub Nepal.`;
      const autoKw =
        `${subject.toLowerCase()} pyq ${year}, grade ${grade} ${subject.toLowerCase()} past paper, ` +
        `${year} ${subject.toLowerCase()} question nepal, neb past year question ${year}, ` +
        `see past paper ${year}, grade ${grade} pyq nepal`;

      // Only use Admin SEO override if it's meaningfully long (not a draft/stub)
      const customTitle = fStr(seo, "seoTitle");
      const customDesc  = fStr(seo, "description");
      const customKw    = fStr(seo, "keywords");
      const pageTitle = customTitle.length >= 30 ? customTitle : autoTitle;
      const desc      = customDesc.length  >= 50 ? customDesc  : autoDesc;
      const kw        = customKw.length    >= 10 ? customKw    : autoKw;
      const customLd  = fStr(seo, "structuredData");

      const autoLd = JSON.stringify({
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

      const bodyHtml = pyqBodyHtml(title, grade, subject, year);
      let html = template.replace("<!--APP_HTML-->", bodyHtml);
      html = injectMeta(html, {
        title: pageTitle,
        description: desc,
        canonical: fStr(seo, "canonicalUrl") || canonical,
        keywords: kw,
        ogType: fStr(seo, "ogType") || "article",
        structuredData: customLd || autoLd,
        noIndex,
      });

      const outPath = resolve(ROOT, "dist/public/pyq", slug);
      mkdirSync(outPath, { recursive: true });
      writeFileSync(resolve(outPath, "index.html"), html, "utf-8");
      const flag = seoMetaMap.has(`pyq_${id}`) ? " [custom SEO]" : "";
      console.log(`  ✓  /pyq/${slug}${flag}`);
      ok++;
    } catch (err) {
      console.warn(`  ⚠  PYQ skipped: ${err.message?.slice(0, 80)}`);
    }
  }
  console.log(`  → ${ok} PYQ pages pre-rendered`);
  return ok;
}

// ── Static page pre-rendering (existing) ──────────────────────────────────────
function extractHeadAndCleanBody(appHtml) {
  const titleMatch     = appHtml.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/i);
  const title          = titleMatch ? titleMatch[1].trim() : null;

  const canonicalMatch =
    appHtml.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i) ||
    appHtml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*\/?>/i);
  const canonical      = canonicalMatch ? canonicalMatch[1] : null;

  const descMatch =
    appHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i) ||
    appHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*\/?>/i);
  const description    = descMatch ? descMatch[1] : null;

  const bodyHtml = appHtml
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link[^>]*rel=["']canonical["'][^>]*\/?>/gi, "")
    .replace(/<link[^>]*rel=["']alternate["'][^>]*\/?>/gi, "")
    .replace(/<meta(?=[^>]*(?:name=|property=|http-equiv=))[^>]*\/?>/gi, "")
    .trim();

  return { title, canonical, description, bodyHtml };
}

async function prerenderStaticRoutes(template) {
  const vite = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "warn",
  });

  let ok = 0, skipped = 0;

  try {
    const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");

    for (const { url, outDir } of ROUTES) {
      try {
        const result = await render(url);
        if (!result) { skipped++; continue; }

        const { title, canonical, description, bodyHtml } = extractHeadAndCleanBody(result.appHtml);

        let html = template.replace("<!--APP_HTML-->", bodyHtml);

        if (title) {
          html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
        }
        if (canonical) {
          html = html.replace(
            /<link rel="canonical" href="[^"]*"\s*\/>/,
            `<link rel="canonical" href="${canonical}" />`
          );
        }
        if (description) {
          html = html.replace(
            /<meta name="description" content="[^"]*"\s*\/>/,
            `<meta name="description" content="${description}" />`
          );
        }

        const outPath = resolve(ROOT, "dist/public", outDir);
        mkdirSync(outPath, { recursive: true });
        writeFileSync(resolve(outPath, "index.html"), html, "utf-8");
        console.log(`  ✓  ${url.padEnd(35)} → ${outDir}/index.html`);
        ok++;
      } catch (err) {
        console.warn(`  ⚠  ${url.padEnd(35)} skipped: ${err.message?.slice(0, 80)}`);
        skipped++;
      }
    }
  } finally {
    await vite.close();
  }

  return { ok, skipped };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function prerender() {
  const distIndex = resolve(ROOT, "dist/public/index.html");
  if (!existsSync(distIndex)) {
    console.error("  ✗  dist/public/index.html not found — run vite build first");
    return;
  }

  const template = readFileSync(distIndex, "utf-8");
  if (!template.includes("<!--APP_HTML-->")) {
    console.warn("  ⚠  <!--APP_HTML--> marker missing from index.html — skipping");
    return;
  }

  console.log("\n⚡ Pre-rendering static pages...");
  const { ok, skipped } = await prerenderStaticRoutes(template);
  console.log(`\n  ${ok} static pages pre-rendered, ${skipped} skipped`);

  // Pre-render every individual note and PYQ page so Vercel serves them with
  // the correct canonical URL instead of the homepage index.html.
  // This fixes "Alternate page with proper canonical tag" in Google Search Console.
  const seoMetaMap = await fetchSeoMetaMap();
  const noteCount = await prerenderNotes(template, seoMetaMap);
  const pyqCount  = await prerenderPyqs(template, seoMetaMap);

  console.log(`\n  ✅ Total: ${ok} static + ${noteCount} notes + ${pyqCount} PYQs pre-rendered`);
}

console.log("\n⚡ Pre-rendering pages...");
prerender()
  .then(() => console.log("✓  Pre-render complete\n"))
  .catch((err) => console.warn("⚠  Pre-render error:", err.message));
