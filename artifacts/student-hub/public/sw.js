const CACHE_NAME = "student-hub-v5";
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
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests for same-origin assets
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return; // skip Firebase, Google APIs, fonts

  // Skip API calls and Vite dev internals
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/@") || url.pathname.includes("__vite") || url.pathname.includes("hot-update")) return;

  // Navigation requests (HTML) — serve cached shell instantly, refresh in background
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match("/");
        const networkFetch = fetch(request)
          .then((res) => { if (res.ok) cache.put("/", res.clone()); return res; })
          .catch(() => null);
        // Return cached immediately if available; wait for network otherwise
        return cached ?? await networkFetch ?? await caches.match("/");
      })
    );
    return;
  }

  // All other same-origin assets (JS, CSS, images, fonts) — cache-first
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
  );
});
