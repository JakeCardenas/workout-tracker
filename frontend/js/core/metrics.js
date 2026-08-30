const Metrics = (() => {
  const WORKING = new Set(["normal", "failure", "drop"]);

  const isWorking = (set) => set.done && WORKING.has(set.type || "normal");

  const volumeOf = (sets) =>
    sets.filter((s) => s.done).reduce((total, s) => total + s.reps * s.weight, 0);

  function sessionStats(session) {
    const sets = session.exercises.flatMap((e) => e.sets);
    const done = sets.filter((s) => s.done);
    return {
      volume: volumeOf(sets),
      sets: done.length,
      working: done.filter(isWorking).length,
      exercises: session.exercises.filter((e) => e.sets.some((s) => s.done)).length,
      minutes: Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000)),
    };
  }

  function bestOneRepMax(exId) {
    let best = 0;
    Store.state.history.forEach((session) => {
      const found = session.exercises.find((e) => e.exId === exId);
      if (!found) return;
      found.sets.filter((s) => s.done).forEach((s) => {
        const est = Plates.oneRepMax(s.weight, s.reps);
        if (est > best) best = est;
      });
    });
    return best;
  }

  // one point per session, so a chart reads as progress over time not per set
  function oneRepMaxSeries(exId) {
    const points = [];
    for (let i = Store.state.history.length - 1; i >= 0; i--) {
      const session = Store.state.history[i];
      const found = session.exercises.find((e) => e.exId === exId);
      if (!found) continue;
      const done = found.sets.filter((s) => s.done);
      if (!done.length) continue;
      const best = done.reduce(
        (top, s) => Math.max(top, Plates.oneRepMax(s.weight, s.reps)),
        0,
      );
      points.push({ at: session.endedAt, value: +best.toFixed(1) });
    }
    return points;
  }

  function volumeByMuscle(sessions) {
    const totals = {};
    sessions.forEach((session) =>
      session.exercises.forEach((entry) => {
        const ex = EXERCISE_BY_ID[entry.exId];
        if (!ex) return;
        const volume = volumeOf(entry.sets);
        if (!volume) return;
        // a secondary mover does real work, just less of it
        ex.primary.forEach((m) => (totals[m] = (totals[m] || 0) + volume));
        ex.secondary.forEach((m) => (totals[m] = (totals[m] || 0) + volume * 0.4));
      }),
    );
    return totals;
  }

  function volumeByGroup(sessions) {
    const totals = {};
    sessions.forEach((session) =>
      session.exercises.forEach((entry) => {
        const ex = EXERCISE_BY_ID[entry.exId];
        if (!ex) return;
        const volume = volumeOf(entry.sets);
        if (volume) totals[ex.group] = (totals[ex.group] || 0) + volume;
      }),
    );
    return totals;
  }

  function since(days) {
    const cut = Date.now() - days * 86400000;
    return Store.state.history.filter((s) => s.endedAt >= cut);
  }

  function weeklyVolume(weeks = 8) {
    const out = [];
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    for (let w = weeks - 1; w >= 0; w--) {
      const end = now.getTime() - w * 7 * 86400000;
      const start = end - 7 * 86400000;
      const inWeek = Store.state.history.filter(
        (s) => s.endedAt > start && s.endedAt <= end,
      );
      out.push({
        at: end,
        value: Math.round(inWeek.reduce((t, s) => t + sessionStats(s).volume, 0)),
        sessions: inWeek.length,
      });
    }
    return out;
  }

  // Bodyweight multiples on the big lifts, averaged and scaled to 1000. It is a
  // yardstick for your own progress, not a comparison against anyone else.
  const ANCHORS = [
    { id: "squat", elite: 2.0 },
    { id: "bench-press", elite: 1.5 },
    { id: "deadlift", elite: 2.5 },
    { id: "overhead-press", elite: 1.0 },
    { id: "pull-up", elite: 1.4 },
  ];

  function strengthScore(profile) {
    const weight = profile && profile.weightKg;
    if (!weight) return null;
    const lifts = ANCHORS.map((anchor) => {
      const best = bestOneRepMax(anchor.id);
      if (!best) return null;
      return {
        id: anchor.id,
        name: EXERCISE_BY_ID[anchor.id] ? EXERCISE_BY_ID[anchor.id].name : anchor.id,
        ratio: +(best / weight).toFixed(2),
        share: Math.min(1, best / weight / anchor.elite),
        best: +best.toFixed(1),
      };
    }).filter(Boolean);

    if (!lifts.length) return null;
    const score = Math.round(
      (lifts.reduce((t, l) => t + l.share, 0) / lifts.length) * 1000,
    );
    return { score, lifts, logged: lifts.length, of: ANCHORS.length };
  }

  const PUSH = new Set(["chest", "front-delts", "triceps"]);
  const PULL = new Set(["lats", "upper-back", "biceps", "rear-delts"]);

  // Ratios worth watching, not rules. Everything is reported as a share so a
  // heavy squat week cannot drown out the comparison being made.
  function balance(days = 28) {
    const totals = volumeByMuscle(since(days));
    const sum = (keys) =>
      Object.entries(totals).reduce((t, [k, v]) => (keys.has(k) ? t + v : t), 0);

    const push = sum(PUSH);
    const pull = sum(PULL);
    const quads = totals.quads || 0;
    const hams = (totals.hamstrings || 0) + (totals.glutes || 0);
    const upper = push + pull;
    const lower = quads + hams + (totals.calves || 0);

    const pair = (label, a, b, aName, bName, ideal) => {
      const total = a + b;
      if (!total) return null;
      const share = a / total;
      const off = Math.abs(share - ideal);
      return {
        label,
        aName,
        bName,
        share,
        a: Math.round(a),
        b: Math.round(b),
        state: off < 0.1 ? "even" : off < 0.2 ? "slight" : "off",
      };
    };

    return [
      pair("Push / Pull", push, pull, "Push", "Pull", 0.5),
      pair("Quads / Posterior", quads, hams, "Quads", "Hams + Glutes", 0.5),
      pair("Upper / Lower", upper, lower, "Upper", "Lower", 0.6),
    ].filter(Boolean);
  }

  // A deload is worth considering when hard weeks stack up and the numbers stop
  // moving. It is a prompt to look, never an instruction.
  function deloadHint() {
    const weeks = weeklyVolume(4);
    const trained = weeks.filter((w) => w.sessions > 0);
    if (trained.length < 3) return null;

    const recent = weeks.slice(-3);
    const heavy = recent.every((w) => w.sessions >= 4);
    const climbing = recent[2].value > recent[0].value * 1.15;
    const stalled = recent[2].value < recent[1].value && recent[1].value < recent[0].value;

    if (heavy && climbing) {
      return {
        tone: "watch",
        text: "Three heavy weeks in a row with volume still climbing. A lighter week soon would not cost you anything.",
      };
    }
    if (stalled && trained.length >= 3) {
      return {
        tone: "stall",
        text: "Volume has slipped two weeks running. That is often fatigue rather than lost fitness — an easy week usually fixes it.",
      };
    }
    return null;
  }

  return {
    volumeOf,
    isWorking,
    sessionStats,
    bestOneRepMax,
    oneRepMaxSeries,
    volumeByMuscle,
    volumeByGroup,
    weeklyVolume,
    strengthScore,
    balance,
    deloadHint,
    since,
  };
})();
