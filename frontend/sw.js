const CACHE = "reps-v23";

const SHELL = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./css/style.css?v=23",
  "./js/data/exercises.js?v=23",
  "./js/data/templates.js?v=23",
  "./js/ui/sound.js?v=23",
  "./js/ui/icons.js?v=23",
  "./js/ui/figures.js?v=23",
  "./js/core/units.js?v=23",
  "./js/core/plates.js?v=23",
  "./js/core/backup.js?v=23",
  "./js/account/config.js?v=23",
  "./js/account/api.js?v=23",
  "./js/core/store.js?v=23",
  "./js/ui/ui.js?v=23",
  "./js/views/library.js?v=23",
  "./js/views/builder.js?v=23",
  "./js/views/workout.js?v=23",
  "./js/views/progress.js?v=23",
  "./js/account/sync.js?v=23",
  "./js/account/gate.js?v=23",
  "./js/app.js?v=23",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // a deep link carries a query the cache key does not, so ignore it here
  const lookup =
    e.request.mode === "navigate"
      ? caches.match("./index.html", { ignoreSearch: true })
      : caches.match(e.request);

  e.respondWith(
    lookup.then((hit) => {
      if (hit) return hit;
      return fetch(e.request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }));
    }),
  );
});
