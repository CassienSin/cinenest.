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

// ── push notifications ──
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "CineNest", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "CineNest";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
    tag: data.tag || "cinenest",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If a CineNest tab is already open, focus it and navigate.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new one.
      return self.clients.openWindow(url);
    })
  );
});