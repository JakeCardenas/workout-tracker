const MuscleMap = (() => {
  const HEAD = [
    [null, '<circle cx="60" cy="19" r="12"/>'],
    [null, '<rect x="53" y="28" width="14" height="9" rx="4"/>'],
  ];
  const ARMS_LOWER = [
    ["forearms", '<rect x="19" y="96" width="12" height="34" rx="6"/>'],
    ["forearms", '<rect x="89" y="96" width="12" height="34" rx="6"/>'],
    [null, '<circle cx="25" cy="136" r="5"/>'],
    [null, '<circle cx="95" cy="136" r="5"/>'],
  ];
  const LOWER_LEG = [
    [null, '<rect x="44" y="178" width="14" height="9" rx="4"/>'],
    [null, '<rect x="62" y="178" width="14" height="9" rx="4"/>'],
    ["calves", '<rect x="45" y="188" width="12" height="40" rx="6"/>'],
    ["calves", '<rect x="63" y="188" width="12" height="40" rx="6"/>'],
    [null, '<rect x="43" y="230" width="15" height="7" rx="3"/>'],
    [null, '<rect x="62" y="230" width="15" height="7" rx="3"/>'],
  ];

  const FRONT = [
    ...HEAD,
    [null, '<rect x="40" y="36" width="40" height="12" rx="6"/>'],
    ["side-delts", '<ellipse cx="27" cy="46" rx="6" ry="8"/>'],
    ["side-delts", '<ellipse cx="93" cy="46" rx="6" ry="8"/>'],
    ["front-delts", '<ellipse cx="34" cy="48" rx="10" ry="10"/>'],
    ["front-delts", '<ellipse cx="86" cy="48" rx="10" ry="10"/>'],
    ["chest", '<rect x="42" y="46" width="17" height="22" rx="6"/>'],
    ["chest", '<rect x="61" y="46" width="17" height="22" rx="6"/>'],
    ["obliques", '<rect x="41" y="72" width="9" height="36" rx="4"/>'],
    ["obliques", '<rect x="70" y="72" width="9" height="36" rx="4"/>'],
    ["abs", '<rect x="51" y="71" width="18" height="40" rx="6"/>'],
    ["biceps", '<rect x="21" y="58" width="14" height="36" rx="7"/>'],
    ["biceps", '<rect x="85" y="58" width="14" height="36" rx="7"/>'],
    ...ARMS_LOWER,
    [null, '<rect x="43" y="110" width="34" height="16" rx="7"/>'],
    ["quads", '<rect x="42" y="126" width="17" height="50" rx="8"/>'],
    ["quads", '<rect x="61" y="126" width="17" height="50" rx="8"/>'],
    ...LOWER_LEG,
  ];

  const BACK = [
    ...HEAD,
    ["traps", '<path d="M42 37 H78 L70 62 H50 Z"/>'],
    ["side-delts", '<ellipse cx="27" cy="46" rx="6" ry="8"/>'],
    ["side-delts", '<ellipse cx="93" cy="46" rx="6" ry="8"/>'],
    ["rear-delts", '<ellipse cx="34" cy="48" rx="10" ry="10"/>'],
    ["rear-delts", '<ellipse cx="86" cy="48" rx="10" ry="10"/>'],
    ["lats", '<path d="M41 56 L53 62 L51 98 L37 84 Z"/>'],
    ["lats", '<path d="M79 56 L67 62 L69 98 L83 84 Z"/>'],
    ["upper-back", '<rect x="53" y="60" width="14" height="24" rx="5"/>'],
    ["lower-back", '<rect x="50" y="86" width="20" height="24" rx="6"/>'],
    ["triceps", '<rect x="21" y="58" width="14" height="36" rx="7"/>'],
    ["triceps", '<rect x="85" y="58" width="14" height="36" rx="7"/>'],
    ...ARMS_LOWER,
    ["glutes", '<rect x="42" y="112" width="17" height="24" rx="8"/>'],
    ["glutes", '<rect x="61" y="112" width="17" height="24" rx="8"/>'],
    ["hamstrings", '<rect x="42" y="138" width="17" height="40" rx="8"/>'],
    ["hamstrings", '<rect x="61" y="138" width="17" height="40" rx="8"/>'],
    ...LOWER_LEG,
  ];

  function render(primary = [], secondary = [], view = "front", extraClass = "") {
    const parts = view === "back" ? BACK : FRONT;
    const p = new Set(primary);
    const s = new Set(secondary);
    const body = parts
      .map(([muscle, shape]) => {
        let cls = "mm-part";
        if (muscle && p.has(muscle)) cls += " is-primary";
        else if (muscle && s.has(muscle)) cls += " is-secondary";
        return shape.replace(/^<(\w+)/, `<$1 class="${cls}"`);
      })
      .join("");
    return `<svg class="mm ${extraClass}" viewBox="0 0 120 250" role="img" aria-hidden="true">${body}</svg>`;
  }

  // same shapes, shaded by how recovered each muscle is rather than by what an
  // exercise targets. 0 is freshly worked, 1 is ready to go again.
  function heat(readiness, view = "front", extraClass = "") {
    const parts = view === "back" ? BACK : FRONT;
    const body = parts
      .map(([muscle, shape]) => {
        if (!muscle) return shape.replace(/^<(\w+)/, '<$1 class="mm-part"');
        const state = readiness[muscle];
        const ready = state ? state.ready : 1;
        const opacity = (0.08 + (1 - ready) * 0.72).toFixed(2);
        return shape.replace(
          /^<(\w+)/,
          `<$1 class="mm-part is-heat" style="opacity:${opacity}"`,
        );
      })
      .join("");
    return `<svg class="mm ${extraClass}" viewBox="0 0 120 250" role="img" aria-label="${view === "back" ? "Back" : "Front"} recovery">${body}</svg>`;
  }

  return { render, heat };
})();
