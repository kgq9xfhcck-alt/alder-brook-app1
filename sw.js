const CACHE_VERSION = "alder-brook-v10";
const APP_SHELL = [
  "./",
  "index.html",
  "animals.html",
  "animal.html",
  "favourites.html",
  "map.html",
  "kids.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "images/placeholder.svg",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's HTTP cache, so a new version never stores old files.
  const requests = APP_SHELL.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(requests)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Data: network first so content stays up to date, cache when offline.
  if (url.pathname.includes("/data/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell: cache first, then network.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});