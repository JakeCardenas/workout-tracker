const CACHE = "reps-v52";

const SHELL = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./css/style.css?v=52",
  "./js/data/exercises.js?v=52",
  "./js/data/splits.js?v=52",
  "./js/ui/sound.js?v=52",
  "./js/ui/icons.js?v=52",
  "./js/ui/art.js?v=52",
  "./js/ui/splash.js?v=52",
  "./js/ui/picker.js?v=52",
  "./js/core/units.js?v=52",
  "./js/core/plates.js?v=52",
  "./js/core/coach.js?v=52",
  "./js/core/shell.js?v=52",
  "./js/core/backup.js?v=52",
  "./js/core/store.js?v=52",
  "./js/ui/ui.js?v=52",
  "./js/views/library.js?v=52",
  "./js/views/builder.js?v=52",
  "./js/views/workout.js?v=52",
  "./js/views/progress.js?v=52",
  "./js/views/plan.js?v=52",
  "./js/views/onboarding.js?v=52",
  "./js/views/you.js?v=52",
  "./js/views/settings.js?v=52",
  "./js/views/home.js?v=52",
  "./js/app.js?v=52",
  "./assets/icons/icon-192.png",
  "./assets/brand/logo.svg",
  "./assets/icons/icon-512.png",
];

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL)),
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
