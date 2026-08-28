const Plates = (() => {
  const KG = { bar: 20, sizes: [25, 20, 15, 10, 5, 2.5, 1.25] };
  const LB = { bar: 45, sizes: [45, 35, 25, 10, 5, 2.5] };

  const kit = () => (Units.isLb() ? LB : KG);

  function load(kg) {
    const k = kit();
    const total = Units.fromKg(kg);
    if (total < k.bar) return null;

    let side = (total - k.bar) / 2;
    const perSide = [];
    for (const size of k.sizes) {
      while (side >= size - 0.001) {
        perSide.push(size);
        side = +(side - size).toFixed(3);
      }
    }
    return { bar: k.bar, perSide, short: +side.toFixed(2), total };
  }

  function warmup(kg, reps) {
    const k = kit();
    const top = Units.fromKg(kg);
    if (top <= k.bar) return [];

    const step = Units.step();
    const snap = (n) => Math.max(k.bar, Math.round(n / step) * step);
    const rows = [
      { weight: k.bar, reps: Math.min(10, reps + 3) },
      { weight: snap(top * 0.55), reps: Math.max(4, Math.round(reps * 0.6)) },
      { weight: snap(top * 0.75), reps: Math.max(3, Math.round(reps * 0.4)) },
      { weight: snap(top * 0.9), reps: Math.max(1, Math.round(reps * 0.25)) },
    ];

    const seen = new Set();
    return rows.filter((r) => {
      if (r.weight >= top || seen.has(r.weight)) return false;
      seen.add(r.weight);
      return true;
    });
  }

  // Epley, and honest about it: a five-rep set predicts far better than twenty
  function oneRepMax(kg, reps) {
    if (!kg || !reps) return 0;
    if (reps === 1) return kg;
    return kg * (1 + reps / 30);
  }

  const usesBar = (ex) => ex.equipment === "Barbell";

  function strip(kg) {
    const rack = load(kg);
    if (!rack) return "";
    const chips = rack.perSide.length
      ? rack.perSide.map((p) => `<span class="plate-chip mono">${p}</span>`).join("")
      : `<span class="plate-chip mono is-empty">bar only</span>`;
    return `<div class="plates">
      <span class="field-label mono">Per side</span>
      <div class="plate-row">${chips}</div>
      <span class="plate-note mono">${rack.bar} ${Units.label()} bar${rack.short ? ` · ${rack.short} over` : ""}</span>
    </div>`;
  }

  return { load, warmup, oneRepMax, usesBar, strip };
})();
