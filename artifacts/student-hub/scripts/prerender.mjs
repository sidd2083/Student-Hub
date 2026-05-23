import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ROUTES = [
  { url: "/tools/gpa-calculator",        outDir: "tools/gpa-calculator" },
  { url: "/tools/attendance-calculator", outDir: "tools/attendance-calculator" },
];

// Strip all Helmet-inlined head tags from rendered body HTML.
// react-helmet-async renders <title>, <meta>, <link> etc. inline during
// renderToString — they don't belong inside <div id="root">.
function extractHeadAndCleanBody(appHtml) {
  // Pull out <title>
  const titleMatch = appHtml.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Pull out canonical href
  const canonicalMatch = appHtml.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i)
    || appHtml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*\/?>/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;

  // Strip head-only tags from the body HTML
  const bodyHtml = appHtml
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<link[^>]*rel=["']canonical["'][^>]*\/?>/gi, "")
    .replace(/<link[^>]*rel=["']alternate["'][^>]*\/?>/gi, "")
    // Strip name/property/http-equiv meta (but keep charset/viewport which React might emit)
    .replace(/<meta(?=[^>]*(?:name=|property=|http-equiv=))[^>]*\/?>/gi, "")
    .trim();

  return { title, canonical, bodyHtml };
}

async function prerender() {
  const distIndex = resolve(ROOT, "dist/public/index.html");
  if (!existsSync(distIndex)) {
    console.error("  ✗  dist/public/index.html not found — run vite build first");
    return;
  }

  const template = readFileSync(distIndex, "utf-8");

  if (!template.includes("<!--APP_HTML-->")) {
    console.warn("  ⚠  <!--APP_HTML--> marker not found in index.html — skipping");
    return;
  }

  const vite = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "warn",
  });

  try {
    const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");

    for (const { url, outDir } of ROUTES) {
      try {
        const result = await render(url);
        if (!result) {
          console.warn(`  ⚠  ${url}: no render result — skipping`);
          continue;
        }

        const { title, canonical, bodyHtml } = extractHeadAndCleanBody(result.appHtml);

        // 1. Inject cleaned body HTML into the APP_HTML marker
        let html = template.replace("<!--APP_HTML-->", bodyHtml);

        // 2. Replace the default <title> with the page-specific one
        if (title) {
          html = html.replace(
            /<title>[^<]*<\/title>/,
            `<title>${title}</title>`
          );
        }

        // 3. Replace the default canonical with the page-specific one
        if (canonical) {
          html = html.replace(
            /<link rel="canonical" href="[^"]*"\s*\/>/,
            `<link rel="canonical" href="${canonical}" />`
          );
        }

        const outPath = resolve(ROOT, "dist/public", outDir);
        mkdirSync(outPath, { recursive: true });
        writeFileSync(resolve(outPath, "index.html"), html, "utf-8");
        console.log(`  ✓  ${url}  (title: "${title?.slice(0, 60)}...")`);
      } catch (err) {
        console.warn(`  ⚠  ${url}: ${err.message}`);
      }
    }
  } finally {
    await vite.close();
  }
}

console.log("\n⚡ Pre-rendering static pages...");
prerender()
  .then(() => console.log("✓  Pre-render complete\n"))
  .catch((err) => {
    console.warn("⚠  Pre-render skipped:", err.message);
  });
