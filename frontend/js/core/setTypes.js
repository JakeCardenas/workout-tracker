const SetTypes = (() => {
  const ORDER = ["warmup", "normal", "failure", "drop"];

  const META = {
    warmup: {
      key: "warmup",
      badge: "W",
      name: "Warm-up",
      hint: "Primes the movement. Left out of volume and records.",
    },
    normal: {
      key: "normal",
      badge: "",
      name: "Working",
      hint: "A normal working set.",
    },
    failure: {
      key: "failure",
      badge: "F",
      name: "To failure",
      hint: "Taken to the point the next rep will not move.",
    },
    drop: {
      key: "drop",
      badge: "D",
      name: "Drop set",
      hint: "Straight into a lighter load with no rest.",
    },
  };

  const of = (set) => META[set && set.type] || META.normal;
  const counts = (set) => (set.type || "normal") !== "warmup";

  // a drop set follows straight on, so it should not open a rest window
  const restsAfter = (set) => (set.type || "normal") !== "drop";

  return { ORDER, META, of, counts, restsAfter };
})();
