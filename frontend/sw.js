const CACHE = "reps-v63";

const SHELL = [
  "./",
  "./index.html",
  "./site.webmanifest?v=63",
  "./css/style.css?v=63",
  "./js/data/exercises.js?v=63",
  "./js/data/splits.js?v=63",
  "./js/ui/sound.js?v=63",
  "./js/ui/icons.js?v=63",
  "./js/ui/muscleMap.js?v=63",
  "./js/ui/art.js?v=63",
  "./js/ui/charts.js?v=63",
  "./js/ui/recoveryMap.js?v=63",
  "./js/ui/splash.js?v=63",
  "./js/ui/picker.js?v=63",
  "./js/core/units.js?v=63",
  "./js/core/plates.js?v=63",
  "./js/core/setTypes.js?v=63",
  "./js/core/coach.js?v=63",
  "./js/core/metrics.js?v=63",
  "./js/core/recovery.js?v=63",
  "./js/core/haptics.js?v=63",
  "./js/core/shell.js?v=63",
  "./js/core/backup.js?v=63",
  "./js/core/store.js?v=63",
  "./js/ui/ui.js?v=63",
  "./js/views/library.js?v=63",
  "./js/views/builder.js?v=63",
  "./js/views/workoutSets.js?v=63",
  "./js/views/workout.js?v=63",
  "./js/views/progress.js?v=63",
  "./js/views/plan.js?v=63",
  "./js/views/onboarding.js?v=63",
  "./js/views/you.js?v=63",
  "./js/views/settings.js?v=63",
  "./js/views/home.js?v=63",
  "./js/app.js?v=63",
  "./assets/icons/icon-192.png?v=63",
  "./assets/brand/logo.svg?v=63",
  "./assets/icons/icon-512.png?v=63",
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
