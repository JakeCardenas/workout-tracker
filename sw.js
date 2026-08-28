const CACHE = "reps-v17";

const SHELL = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./css/style.css?v=17",
  "./js/config.js?v=17",
  "./js/api.js?v=17",
  "./js/auth.js?v=17",
  "./js/data/exercises.js?v=17",
  "./js/data/templates.js?v=17",
  "./js/sound.js?v=17",
  "./js/icons.js?v=17",
  "./js/figures.js?v=17",
  "./js/units.js?v=17",
  "./js/plates.js?v=17",
  "./js/backup.js?v=17",
  "./js/store.js?v=17",
  "./js/ui.js?v=17",
  "./js/library.js?v=17",
  "./js/builder.js?v=17",
  "./js/session.js?v=17",
  "./js/progress.js?v=17",
  "./js/app.js?v=17",
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
