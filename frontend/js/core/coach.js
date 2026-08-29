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
      return { split: sp, score, asks: fit.days };
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
    return bits.join(", ");
  }

  // exercises worth starting with at this level, biggest lifts first
  function starters(profile, limit = 6) {
    if (!profile) return [];
    const level = profile.experience || "Beginner";
    const allowed =
      level === "Beginner" ? ["Beginner"] : level === "Intermediate" ? ["Beginner", "Intermediate"] : LEVELS;
    const compound = ["squat", "bench-press", "deadlift", "overhead-press", "barbell-row", "lat-pulldown", "romanian-deadlift", "leg-press", "dumbbell-bench-press", "seated-cable-row"];
    const picked = compound
      .map((id) => EXERCISE_BY_ID[id])
      .filter((e) => e && allowed.includes(e.level));
    const extra = EXERCISES.filter(
      (e) => allowed.includes(e.level) && !picked.includes(e) && e.equipment !== "Band",
    );
    return picked.concat(extra).slice(0, limit);
  }

  // only meaningful next to a barbell lift, and only if a weight is on file
  function strengthRatio(profile, exId) {
    if (!profile || !profile.weightKg) return null;
    const rec = Store.state.records[exId];
    if (!rec || !rec.bestWeight) return null;
    return +(rec.bestWeight / profile.weightKg).toFixed(2);
  }

  return { LEVELS, recommend, why, starters, strengthRatio };
})();
