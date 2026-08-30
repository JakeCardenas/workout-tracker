const Coach = (() => {
  const LEVELS = ["Beginner", "Intermediate", "Advanced"];

  // how many sessions a split actually asks for, and who it suits
  const FIT = {
    "fbeod": { days: 3, for: ["Beginner", "Intermediate"] },
    "upper-lower-x2": { days: 4, for: ["Beginner", "Intermediate", "Advanced"] },
    "anterior-posterior": { days: 4, for: ["Intermediate", "Advanced"] },
    "ppl-ul": { days: 5, for: ["Intermediate", "Advanced"] },
    "bro-split": { days: 5, for: ["Beginner", "Intermediate"] },
    "ppl-x2": { days: 6, for: ["Intermediate", "Advanced"] },
    "ppl-arnold": { days: 6, for: ["Advanced"] },
  };

  function recommend(profile) {
    if (!profile || !profile.experience || !profile.days) return null;
    const { experience, days } = profile;

    const scored = SPLITS.map((sp) => {
      const fit = FIT[sp.id];
      let score = 0;
      // matching the days you actually have matters more than anything else
      score -= Math.abs(fit.days - days) * 3;
      if (fit.for.includes(experience)) score += 4;
      if (experience === "Beginner" && fit.days >= 6) score -= 5;
      score += sp.rating;
      // a split you can only half-perform at home is not the right split
      const reach = coverage(sp, profile);
      score += reach * 4;
      return { split: sp, score, asks: fit.days, coverage: reach };
    }).sort((a, b) => b.score - a.score);

    return { best: scored[0], alt: scored[1] };
  }

  function why(profile, pick) {
    const gap = pick.asks - profile.days;
    const bits = [];
    if (gap === 0) bits.push(`fits your ${profile.days} days exactly`);
    else if (gap < 0) bits.push(`asks for ${pick.asks} days, leaving you room`);
    else bits.push(`asks for ${pick.asks} days, one more than you planned`);
    if (profile.experience === "Beginner") bits.push("and keeps the sessions simple enough to learn the lifts");
    if (profile.experience === "Advanced") bits.push("and gives you the frequency to keep progressing");
    if (pick.coverage !== undefined && pick.coverage < 0.999) {
      bits.push(`though about ${Math.round((1 - pick.coverage) * 100)}% of its lifts need kit you did not list`);
    }
    return bits.join(", ");
  }

  const canDo = (ex, profile) =>
    !profile || !profile.equipment || !profile.equipment.length
      ? true
      : profile.equipment.includes(ex.equipment);

  // exercises worth starting with at this level, biggest lifts first, and only
  // ones the equipment they told us about can actually deliver
  function starters(profile, limit = 6) {
    if (!profile) return [];
    const level = profile.experience || "Beginner";
    const allowed =
      level === "Beginner" ? ["Beginner"] : level === "Intermediate" ? ["Beginner", "Intermediate"] : LEVELS;
    const compound = ["squat", "bench-press", "deadlift", "overhead-press", "barbell-row", "lat-pulldown", "romanian-deadlift", "leg-press", "dumbbell-bench-press", "seated-cable-row", "goblet-squat", "push-ups", "dumbbell-row", "bulgarian-split-squat"];
    const ok = (e) => e && allowed.includes(e.level) && canDo(e, profile);
    const picked = compound.map((id) => EXERCISE_BY_ID[id]).filter(ok);
    const extra = EXERCISES.filter((e) => ok(e) && !picked.includes(e));
    return picked.concat(extra).slice(0, limit);
  }

  // Swap a lift you cannot equip for the nearest one you can: same muscle group
  // first, then the closest overlap of primary muscles, then anything for that
  // group. Returns the original when nothing better exists.
  function substitute(exId, profile, taken = new Set()) {
    const want = EXERCISE_BY_ID[exId];
    if (!want || canDo(want, profile)) return want;

    const pool = EXERCISES.filter((e) => e.group === want.group && canDo(e, profile));
    if (!pool.length) return want;

    const overlap = (e) => e.primary.filter((m) => want.primary.includes(m)).length;
    const ranked = pool
      .map((e) => ({
        e,
        score: overlap(e) * 10 + (e.level === want.level ? 3 : 0) + (e.unit === want.unit ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    // skip anything already in the session so a day never loses a movement
    const free = ranked.find((r) => !taken.has(r.e.id));
    return (free || ranked[0]).e;
  }

  // a day plan rewritten for the equipment on hand
  function adaptDay(dayKey, profile) {
    const day = DAY_PLANS[dayKey];
    if (!day) return null;
    const seen = new Set();
    const exercises = [];
    day.exercises.forEach((id) => {
      const pick = substitute(id, profile, seen);
      if (seen.has(pick.id)) return;
      seen.add(pick.id);
      exercises.push({ id: pick.id, swappedFrom: pick.id === id ? null : id });
    });
    return Object.assign({}, day, { exercises });
  }

  // how much of a split's work the user can actually perform with their kit
  function coverage(split, profile) {
    if (!profile || !profile.equipment || !profile.equipment.length) return 1;
    const ids = split.week.filter(Boolean).flatMap((k) => DAY_PLANS[k].exercises);
    if (!ids.length) return 1;
    const doable = ids.filter((id) => canDo(EXERCISE_BY_ID[id], profile)).length;
    return doable / ids.length;
  }

  // Rule-based, not a model. Three outcomes only: earn a jump by hitting every
  // target, hold when you fall short, and hold the first time you meet a lift.
  function suggest(exId, target) {
    const ex = EXERCISE_BY_ID[exId];
    if (!ex || ex.unit === "sec") return null;

    const last = Store.lastSetsFor(exId);
    if (!last || !last.sets.length) return null;

    const goalReps = target ? target.reps : last.sets[0].reps;
    const hitAll = last.sets.every((s) => s.reps >= goalReps);
    const beatAll = last.sets.every((s) => s.reps > goalReps);
    const top = last.sets.reduce((a, b) => (b.weight > a.weight ? b : a));

    const step = ex.equipment === "Bodyweight" ? 0 : Units.isLb() ? Units.toKg(5) : 2.5;
    const bump = beatAll ? step * 2 : step;

    if (!hitAll) {
      return {
        kind: "hold",
        weight: top.weight,
        reps: goalReps,
        why: `You managed ${Math.min(...last.sets.map((s) => s.reps))} on your lowest set last time. Stay here until every set hits ${goalReps}.`,
      };
    }
    if (!step) {
      return {
        kind: "reps",
        weight: top.weight,
        reps: goalReps + 1,
        why: `Bodyweight, so the progression is reps. You cleared ${goalReps} on every set last time.`,
      };
    }
    return {
      kind: "up",
      weight: +(top.weight + bump).toFixed(2),
      reps: goalReps,
      why: beatAll
        ? `You beat ${goalReps} on every set last time, so this jumps two increments.`
        : `You hit ${goalReps} on every set last time.`,
    };
  }


  // closest first: shares the most primary muscles, then the same group
  function alternatives(exId, { exclude = [], limit = 6 } = {}) {
    const meta = EXERCISE_BY_ID[exId];
    if (!meta) return [];
    return EXERCISES.filter((ex) => ex.id !== exId && !exclude.includes(ex.id))
      .map((ex) => {
        const shared = ex.primary.filter((m) => meta.primary.includes(m)).length;
        return { ex, score: shared * 3 + (ex.group === meta.group ? 1 : 0) };
      })
      .filter((row) => row.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((row) => row.ex);
  }

  // only meaningful next to a barbell lift, and only if a weight is on file
  function strengthRatio(profile, exId) {
    if (!profile || !profile.weightKg) return null;
    const rec = Store.state.records[exId];
    if (!rec || !rec.bestWeight) return null;
    return +(rec.bestWeight / profile.weightKg).toFixed(2);
  }

  return { LEVELS, recommend, why, starters, strengthRatio, suggest, coverage, canDo, substitute, adaptDay, alternatives };
})();
