const Store = (() => {
  const KEY = "reps.state.v1";

  const blank = () => ({
    v: 1,
    favorites: [],
    prefs: {},
    draft: { name: "", items: [] },
    workouts: [],
    history: [],
    records: {},
    recent: [],
    settings: { theme: "system", sound: true, unit: "kg" },
  });

  let state = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw);
      return Object.assign(blank(), parsed, {
        settings: Object.assign(blank().settings, parsed.settings || {}),
        draft: Object.assign(blank().draft, parsed.draft || {}),
      });
    } catch (err) {
      console.warn("saved data was unreadable, starting fresh", err);
      return blank();
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("could not save", err);
    }
  }

  function commit(...topics) {
    persist();
    listeners.forEach((fn) => fn(topics));
  }

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function config(exId) {
    const ex = EXERCISE_BY_ID[exId];
    return Object.assign({}, ex.defaults, state.prefs[exId] || {});
  }

  function setConfig(exId, cfg) {
    state.prefs[exId] = Object.assign({}, config(exId), cfg);
    commit("prefs");
  }

  function touchRecent(exId) {
    state.recent = [exId, ...state.recent.filter((id) => id !== exId)].slice(0, 8);
    commit("recent");
  }

  function toggleFavorite(exId) {
    const i = state.favorites.indexOf(exId);
    if (i === -1) state.favorites.push(exId);
    else state.favorites.splice(i, 1);
    commit("favorites");
    return i === -1;
  }

  const isFavorite = (exId) => state.favorites.includes(exId);

  function addToDraft(exId, cfg) {
    const merged = Object.assign(config(exId), pick(cfg));
    state.draft.items.push(Object.assign({ uid: uid(), exId }, merged));
    state.prefs[exId] = merged;
    touchRecent(exId);
    commit("draft", "prefs");
    return state.draft.items.length;
  }

  function updateDraftItem(itemUid, patch) {
    const item = state.draft.items.find((i) => i.uid === itemUid);
    if (!item) return;
    Object.assign(item, patch);
    state.prefs[item.exId] = {
      sets: item.sets,
      reps: item.reps,
      weight: item.weight,
      rest: item.rest,
    };
    commit("draft", "prefs");
  }

  function removeDraftItem(itemUid) {
    state.draft.items = state.draft.items.filter((i) => i.uid !== itemUid);
    commit("draft");
  }

  function moveDraftItem(itemUid, dir) {
    const items = state.draft.items;
    const i = items.findIndex((x) => x.uid === itemUid);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= items.length) return false;
    [items[i], items[j]] = [items[j], items[i]];
    commit("draft");
    return true;
  }

  function setDraftName(name) {
    state.draft.name = name;
    commit("draft");
  }

  function clearDraft() {
    state.draft = { name: "", items: [] };
    commit("draft");
  }

  function saveDraft(name) {
    const items = state.draft.items;
    if (!items.length) return null;
    const title = (name || state.draft.name || "Untitled Workout").trim();
    const existing = state.workouts.find((w) => w.id === state.draft.savedId);
    const now = Date.now();

    if (existing) {
      existing.name = title;
      existing.items = clone(items);
      existing.updatedAt = now;
      commit("workouts");
      return existing;
    }

    const workout = {
      id: uid(),
      name: title,
      items: clone(items),
      createdAt: now,
      updatedAt: now,
    };
    state.workouts.unshift(workout);
    state.draft.name = title;
    state.draft.savedId = workout.id;
    commit("workouts", "draft");
    return workout;
  }

  function loadWorkout(workoutId) {
    const w = state.workouts.find((x) => x.id === workoutId);
    if (!w) return null;
    state.draft = {
      name: w.name,
      savedId: w.id,
      items: clone(w.items).map((i) => Object.assign(i, { uid: uid() })),
    };
    commit("draft");
    return state.draft;
  }

  function duplicateWorkout(workoutId) {
    const w = state.workouts.find((x) => x.id === workoutId);
    if (!w) return null;
    const copy = {
      id: uid(),
      name: `${w.name} copy`,
      items: clone(w.items).map((i) => Object.assign(i, { uid: uid() })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.workouts.unshift(copy);
    commit("workouts");
    return copy;
  }

  function deleteWorkout(workoutId) {
    state.workouts = state.workouts.filter((w) => w.id !== workoutId);
    if (state.draft.savedId === workoutId) delete state.draft.savedId;
    commit("workouts", "draft");
  }

  function restoreWorkout(workout) {
    state.workouts.unshift(workout);
    commit("workouts");
  }

  function renameWorkout(workoutId, name) {
    const w = state.workouts.find((x) => x.id === workoutId);
    if (!w) return;
    w.name = name.trim() || w.name;
    w.updatedAt = Date.now();
    commit("workouts");
  }

  function logSession(session) {
    const entry = Object.assign({ id: uid() }, session);
    state.history.unshift(entry);
    entry.exercises.forEach((ex) => touchRecentSilent(ex.exId));
    commit("history", "records", "recent");
    return entry;
  }

  function touchRecentSilent(exId) {
    state.recent = [exId, ...state.recent.filter((id) => id !== exId)].slice(0, 8);
  }

  function applyRecords(exercises, at) {
    const won = [];
    exercises.forEach((ex) => {
      const done = ex.sets.filter((s) => s.done);
      if (!done.length) return;
      const firstEver = !state.records[ex.exId];
      const rec = state.records[ex.exId] || {
        bestWeight: 0,
        bestReps: 0,
        bestVolume: 0,
      };
      const topWeight = Math.max(...done.map((s) => s.weight));
      const topReps = Math.max(...done.map((s) => s.reps));
      const volume = done.reduce((t, s) => t + s.reps * s.weight, 0);

      // everything is a PR the first time, so one line beats two
      if (firstEver) {
        won.push({ exId: ex.exId, kind: "first", value: topWeight, reps: topReps });
        rec.bestWeight = topWeight;
        rec.bestReps = topReps;
        rec.bestVolume = volume;
        rec.lastWeight = topWeight;
        rec.lastReps = topReps;
        rec.updatedAt = at;
        state.records[ex.exId] = rec;
        return;
      }

      if (topWeight > rec.bestWeight && topWeight > 0) {
        won.push({ exId: ex.exId, kind: "weight", value: topWeight, prev: rec.bestWeight });
        rec.bestWeight = topWeight;
      }
      if (topReps > rec.bestReps) {
        won.push({ exId: ex.exId, kind: "reps", value: topReps, prev: rec.bestReps });
        rec.bestReps = topReps;
      }
      if (volume > rec.bestVolume && volume > 0) {
        rec.bestVolume = volume;
      }
      rec.lastWeight = topWeight;
      rec.lastReps = topReps;
      rec.updatedAt = at;
      state.records[ex.exId] = rec;
    });
    return won;
  }

  function deleteSession(sessionId) {
    state.history = state.history.filter((h) => h.id !== sessionId);
    commit("history");
  }

  function lastPerformance(exId) {
    for (const session of state.history) {
      const found = session.exercises.find((e) => e.exId === exId);
      if (!found) continue;
      const done = found.sets.filter((s) => s.done);
      if (!done.length) continue;
      const top = done.reduce((a, b) => (b.weight > a.weight ? b : a));
      return { at: session.endedAt, weight: top.weight, reps: top.reps, sets: done.length };
    }
    return null;
  }

  function historyFor(exId) {
    const points = [];
    for (let i = state.history.length - 1; i >= 0; i--) {
      const session = state.history[i];
      const found = session.exercises.find((e) => e.exId === exId);
      if (!found) continue;
      const done = found.sets.filter((s) => s.done);
      if (!done.length) continue;
      const top = done.reduce((a, b) =>
        Plates.oneRepMax(b.weight, b.reps) > Plates.oneRepMax(a.weight, a.reps) ? b : a,
      );
      points.push({
        at: session.endedAt,
        weight: Math.max(...done.map((s) => s.weight)),
        reps: Math.max(...done.map((s) => s.reps)),
        best: { weight: top.weight, reps: top.reps },
        e1rm: Plates.oneRepMax(top.weight, top.reps),
        volume: done.reduce((t, s) => t + s.reps * s.weight, 0),
      });
    }
    return points;
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    commit("settings");
  }

  function replace(next) {
    state = Object.assign(blank(), next, {
      settings: Object.assign(blank().settings, next.settings || {}),
      draft: Object.assign(blank().draft, next.draft || {}),
    });
    commit("favorites", "workouts", "history", "draft", "settings", "records", "recent");
  }

  function reset() {
    state = blank();
    commit("favorites", "workouts", "history", "draft", "settings", "records", "recent");
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));

  const pick = (cfg) =>
    ["sets", "reps", "weight", "rest"].reduce((out, key) => {
      if (cfg && cfg[key] !== undefined) out[key] = cfg[key];
      return out;
    }, {});

  return {
    get state() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    uid,
    config,
    setConfig,
    touchRecent,
    toggleFavorite,
    isFavorite,
    addToDraft,
    updateDraftItem,
    removeDraftItem,
    moveDraftItem,
    setDraftName,
    clearDraft,
    saveDraft,
    loadWorkout,
    duplicateWorkout,
    deleteWorkout,
    restoreWorkout,
    renameWorkout,
    logSession,
    applyRecords,
    deleteSession,
    lastPerformance,
    historyFor,
    setSetting,
    replace,
    reset,
  };
})();
