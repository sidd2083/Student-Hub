/**
 * Fires a background request to trigger a Vercel redeploy so the static
 * sitemap is rebuilt with the latest Firestore content.
 * Completely silent — never throws, never blocks the UI.
 */
export function triggerSitemapUpdate(reason: string): void {
  fetch("/api/sitemap/redeploy", { method: "POST" })
    .then(() => console.info(`[Sitemap] Redeploy queued (${reason})`))
    .catch(() => {});
}
