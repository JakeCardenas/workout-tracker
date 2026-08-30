const CACHE = "reps-v65";

const SHELL = [
  "./",
  "./index.html",
  "./site.webmanifest?v=65",
  "./css/style.css?v=65",
  "./js/data/exercises.js?v=65",
  "./js/data/splits.js?v=65",
  "./js/ui/sound.js?v=65",
  "./js/ui/icons.js?v=65",
  "./js/ui/muscleMap.js?v=65",
  "./js/ui/art.js?v=65",
  "./js/ui/charts.js?v=65",
  "./js/ui/recoveryMap.js?v=65",
  "./js/ui/splash.js?v=65",
  "./js/ui/picker.js?v=65",
  "./js/core/units.js?v=65",
  "./js/core/plates.js?v=65",
  "./js/core/setTypes.js?v=65",
  "./js/core/coach.js?v=65",
  "./js/core/metrics.js?v=65",
  "./js/core/recovery.js?v=65",
  "./js/core/haptics.js?v=65",
  "./js/core/shell.js?v=65",
  "./js/core/backup.js?v=65",
  "./js/core/store.js?v=65",
  "./js/ui/ui.js?v=65",
  "./js/views/library.js?v=65",
  "./js/views/builder.js?v=65",
  "./js/views/workoutSets.js?v=65",
  "./js/views/workout.js?v=65",
  "./js/views/progress.js?v=65",
  "./js/views/plan.js?v=65",
  "./js/views/onboarding.js?v=65",
  "./js/views/you.js?v=65",
  "./js/views/body.js?v=65",
  "./js/views/settings.js?v=65",
  "./js/views/home.js?v=65",
  "./js/app.js?v=65",
  "./assets/icons/icon-192.png?v=65",
  "./assets/brand/logo.svg?v=65",
  "./assets/icons/icon-512.png?v=65",
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
