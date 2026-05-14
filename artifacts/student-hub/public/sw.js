const CACHE_NAME = "student-hub-v4";
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Never intercept API calls, Firebase, or external requests
  if (url.pathname.startsWith("/api/")) return;
  if (!url.hostname.includes("localhost") && !url.hostname.includes("replit") && !url.hostname.includes("vercel") && !url.hostname.includes("netlify")) {
    // External domains (Google APIs, Firebase, fonts, etc.) — skip caching
    if (!url.hostname.endsWith(self.location.hostname)) return;
  }

  // Skip Vite dev-only internals
  if (url.pathname.startsWith("/@") || url.pathname.includes("__vite") || url.pathname.includes("hot-update")) return;

  // JS/CSS/font chunks (content-hashed) — cache-first, instant load
  if (url.pathname.match(/\.(js|css|woff2?|ttf|otf)$/) || url.pathname.includes("/assets/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Images — cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // HTML navigation — stale-while-revalidate for instant load + fresh updates
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match("/");
        // Kick off a background fetch to update the cache
        const networkPromise = fetch(request).then((response) => {
          if (response.ok) cache.put("/", response.clone());
          return response;
        }).catch(() => null);

        // Return cached shell immediately for instant PWA launch, then update
        return cached ?? networkPromise ?? caches.match("/");
      })
    );
    return;
  }
});
