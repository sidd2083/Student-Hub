import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
  // Dynamic pages — tried; silently skipped if Firebase/Auth unavailable in Node
  { url: "/notes",                        outDir: "notes" },
  { url: "/pyqs",                         outDir: "pyqs" },
  { url: "/mcq",                          outDir: "mcq" },
];

// Extract the page-specific title & canonical from inline-rendered appHtml,
// then strip orphaned head tags from the body content.
function extractHeadAndCleanBody(appHtml) {
  const titleMatch =
    appHtml.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const canonicalMatch =
    appHtml.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i) ||
    appHtml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*\/?>/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;

  const descMatch =
    appHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i) ||
    appHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*\/?>/i);
  const description = descMatch ? descMatch[1] : null;

  // Strip head-only tags that don't belong in <body>
  const bodyHtml = appHtml
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link[^>]*rel=["']canonical["'][^>]*\/?>/gi, "")
    .replace(/<link[^>]*rel=["']alternate["'][^>]*\/?>/gi, "")
    .replace(/<meta(?=[^>]*(?:name=|property=|http-equiv=))[^>]*\/?>/gi, "")
    .trim();

  return { title, canonical, description, bodyHtml };
}

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

  console.log(`\n  ${ok} pre-rendered, ${skipped} skipped`);
}

console.log("\n⚡ Pre-rendering pages...");
prerender()
  .then(() => console.log("✓  Pre-render complete\n"))
  .catch((err) => console.warn("⚠  Pre-render error:", err.message));
