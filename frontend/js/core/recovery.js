const Recovery = (() => {
  // Rough hours to fresh for a normal working dose. Small muscles turn around
  // faster than the ones that move the most load. These are training estimates
  // to help you plan a week — nothing here is medical advice.
  const WINDOW = {
    chest: 48,
    "front-delts": 40,
    "side-delts": 36,
    "rear-delts": 36,
    traps: 40,
    lats: 48,
    "upper-back": 48,
    "lower-back": 60,
    biceps: 40,
    triceps: 40,
    forearms: 30,
    abs: 30,
    obliques: 30,
    glutes: 52,
    quads: 60,
    hamstrings: 60,
    calves: 36,
  };

  const HARD_SETS = 6;

  function stimulus(days = 7) {
    const cut = Date.now() - days * 86400000;
    const hits = {};

    Store.state.history
      .filter((s) => s.endedAt >= cut)
      .forEach((session) =>
        session.exercises.forEach((entry) => {
          const ex = EXERCISE_BY_ID[entry.exId];
          if (!ex) return;
          const sets = entry.sets.filter(Metrics.isWorking).length;
          if (!sets) return;

          const add = (muscle, weight) => {
            const hit = hits[muscle] || (hits[muscle] = { sets: 0, at: 0 });
            hit.sets += sets * weight;
            if (session.endedAt > hit.at) hit.at = session.endedAt;
          };
          ex.primary.forEach((m) => add(m, 1));
          ex.secondary.forEach((m) => add(m, 0.4));
        }),
      );

    return hits;
  }

  // 0 is freshly hammered, 1 is ready to go again. Volume stretches the window
  // rather than deepening the hole: twelve hard sets take longer than three.
  function map() {
    const hits = stimulus();
    const now = Date.now();
    const out = {};

    Object.keys(WINDOW).forEach((muscle) => {
      const hit = hits[muscle];
      if (!hit || !hit.at) {
        out[muscle] = { ready: 1, hoursLeft: 0, lastAt: null, sets: 0 };
        return;
      }
      const load = Math.min(2, Math.max(0.5, hit.sets / HARD_SETS));
      const window = WINDOW[muscle] * load;
      const elapsed = (now - hit.at) / 3600000;
      const ready = Math.max(0, Math.min(1, elapsed / window));
      out[muscle] = {
        ready: +ready.toFixed(2),
        hoursLeft: Math.max(0, Math.round(window - elapsed)),
        lastAt: hit.at,
        sets: +hit.sets.toFixed(1),
      };
    });

    return out;
  }

  const label = (ready) =>
    ready >= 0.95 ? "Fresh" : ready >= 0.6 ? "Recovering" : ready >= 0.3 ? "Sore" : "Worked";

  function freshest(limit = 3) {
    const m = map();
    return Object.entries(m)
      .filter(([, v]) => v.lastAt)
      .sort((a, b) => b[1].ready - a[1].ready)
      .slice(0, limit)
      .map(([key, v]) => ({ key, name: MUSCLES[key], ...v }));
  }

  function neediest(limit = 3) {
    const m = map();
    return Object.entries(m)
      .sort((a, b) => a[1].ready - b[1].ready)
      .slice(0, limit)
      .map(([key, v]) => ({ key, name: MUSCLES[key], ...v }));
  }

  // how ready you are for a given workout, averaged over what it actually hits
  function forWorkout(items) {
    const m = map();
    const touched = new Set();
    items.forEach((item) => {
      const ex = EXERCISE_BY_ID[item.exId];
      if (ex) ex.primary.forEach((p) => touched.add(p));
    });
    if (!touched.size) return 1;
    const total = [...touched].reduce((t, key) => t + (m[key] ? m[key].ready : 1), 0);
    return +(total / touched.size).toFixed(2);
  }

  return { map, label, freshest, neediest, forWorkout, WINDOW };
})();
