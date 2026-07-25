const CACHE = "cinenest-v1";
const SHELL = ["/", "/library", "/manifest.json"];

// install: cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// activate: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch: network-first for pages, never touch video or supabase
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache video streams, API calls, or Supabase traffic.
  if (
    url.pathname.includes(".m3u8") ||
    url.pathname.includes(".ts") ||
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase")
  ) {
    return; // let the browser handle it normally
  }

  // Network-first, fall back to cache when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
  }
});