const CACHE = "reps-v29";

const SHELL = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./css/style.css?v=29",
  "./js/data/exercises.js?v=29",
  "./js/data/templates.js?v=29",
  "./js/ui/sound.js?v=29",
  "./js/ui/icons.js?v=29",
  "./js/ui/art.js?v=29",
  "./js/core/units.js?v=29",
  "./js/core/plates.js?v=29",
  "./js/core/backup.js?v=29",
  "./js/core/store.js?v=29",
  "./js/ui/ui.js?v=29",
  "./js/views/library.js?v=29",
  "./js/views/builder.js?v=29",
  "./js/views/workout.js?v=29",
  "./js/views/progress.js?v=29",
  "./js/app.js?v=29",
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

  const shell = () => caches.match("./index.html", { ignoreSearch: true });

  // the page itself always comes from the network when there is one. cached
  // markup would keep pointing at whichever script versions it shipped with,
  // and no amount of cache busting downstream can fix that.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(shell),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(shell);
    }),
  );
});
