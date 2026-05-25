import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../artifacts/student-hub/dist/public");

const SITE_URL    = "https://www.studenthubnp.com";
const PROJECT_ID  = process.env.VITE_FIREBASE_PROJECT_ID  ?? "studenthub-6bcc5";
const API_KEY     = process.env.VITE_FIREBASE_API_KEY     ?? "";

function toSlug(str) {
  return (str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const docId = (name) => name.split("/").pop() ?? name;
const fStr  = (f, k) => f[k]?.stringValue ?? f[k]?.integerValue ?? "";
const fInt  = (f, k) => Number(f[k]?.integerValue ?? f[k]?.doubleValue ?? 0);

async function fetchAll(collection) {
  const docs = [];
  let pageToken = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}` +
      `?pageSize=300` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "") +
      (API_KEY   ? `&key=${encodeURIComponent(API_KEY)}`         : "");
    const res  = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`  ⚠  Firestore ${collection} returned ${res.status}`);
      break;
    }
    const data = await res.json();
    docs.push(...(data.documents ?? []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return docs;
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildSitemap(urls, today) {
  const entries = urls.map(u =>
    `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
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
];

const ROBOTS = [
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

async function generate() {
  const today = new Date().toISOString().split("T")[0];
  console.log("\n⚡ Generating sitemap...");

  const [noteDocs, pyqDocs] = await Promise.all([
    fetchAll("notes"),
    fetchAll("pyqs"),
  ]);

  const noteUrls = noteDocs.filter(d => d.fields).map(d => ({
    loc:        `${SITE_URL}/notes/${docId(d.name)}-grade-${fInt(d.fields, "grade")}-${toSlug(fStr(d.fields, "subject"))}-${toSlug(fStr(d.fields, "title"))}`,
    priority:   "0.75",
    changefreq: "monthly",
  }));

  const pyqUrls = pyqDocs.filter(d => d.fields).map(d => ({
    loc:        `${SITE_URL}/pyq/${docId(d.name)}-grade-${fInt(d.fields, "grade")}-${toSlug(fStr(d.fields, "subject"))}-${fInt(d.fields, "year")}-${toSlug(fStr(d.fields, "title"))}`,
    priority:   "0.75",
    changefreq: "monthly",
  }));

  const allUrls = [...STATIC_URLS, ...noteUrls, ...pyqUrls];

  mkdirSync(OUT_DIR, { recursive: true });

  writeFileSync(resolve(OUT_DIR, "sitemap.xml"), buildSitemap(allUrls, today), "utf-8");
  console.log(`  ✓  sitemap.xml        — ${allUrls.length} URLs (${noteUrls.length} notes, ${pyqUrls.length} PYQs)`);

  const sitemapIndex =
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${SITE_URL}/sitemap.xml</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>\n</sitemapindex>\n`;
  writeFileSync(resolve(OUT_DIR, "sitemap-index.xml"), sitemapIndex, "utf-8");
  console.log(`  ✓  sitemap-index.xml`);

  writeFileSync(resolve(OUT_DIR, "robots.txt"), ROBOTS, "utf-8");
  console.log(`  ✓  robots.txt`);
}

generate()
  .then(() => console.log("✓  Sitemap generation complete\n"))
  .catch(err => {
    console.error("✗  Sitemap generation failed:", err.message);
    process.exit(1);
  });
