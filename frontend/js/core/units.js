const Units = (() => {
  const LB_PER_KG = 2.2046226218;
  let unit = "kg";

  const isLb = () => unit === "lb";

  function fromKg(kg) {
    if (!isLb()) return round(kg, 2.5);
    return round(kg * LB_PER_KG, 5);
  }

  function toKg(shown) {
    return isLb() ? +(shown / LB_PER_KG).toFixed(2) : shown;
  }

  function round(n, step) {
    const snapped = Math.round(n / step) * step;
    return +snapped.toFixed(1);
  }

  return {
    set(next) {
      unit = next === "lb" ? "lb" : "kg";
    },
    get: () => unit,
    label: () => unit,
    isLb,
    fromKg,
    toKg,
    step: () => (isLb() ? 5 : 2.5),
    max: () => (isLb() ? 880 : 400),
    plate: (equipment) => (equipment === "Bodyweight" ? (isLb() ? 2.5 : 1) : isLb() ? 5 : 2.5),
  };
})();
