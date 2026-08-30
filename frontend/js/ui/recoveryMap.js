const RecoveryMap = (() => {
  function render(extraClass = "") {
    const readiness = Recovery.map();
    return `<div class="mmap ${extraClass}">
      <figure class="mmap-side">
        ${MuscleMap.heat(readiness, "front")}
        <figcaption class="mono">Front</figcaption>
      </figure>
      <figure class="mmap-side">
        ${MuscleMap.heat(readiness, "back")}
        <figcaption class="mono">Back</figcaption>
      </figure>
    </div>`;
  }

  function legend() {
    return `<div class="mm-legend mono">
      <span><i class="mm-dot" style="opacity:0.12"></i>Fresh</span>
      <span><i class="mm-dot" style="opacity:0.45"></i>Recovering</span>
      <span><i class="mm-dot" style="opacity:0.8"></i>Worked</span>
    </div>`;
  }

  function rows(limit = 6) {
    const readiness = Recovery.map();
    return Object.entries(readiness)
      .sort((a, b) => a[1].ready - b[1].ready)
      .slice(0, limit)
      .map(([key, state]) => {
        const pct = Math.round(state.ready * 100);
        return `<li>
          <span class="split-key mono">${MUSCLES[key]}</span>
          <span class="split-track"><i style="width:${pct}%"></i></span>
          <span class="split-val mono">${Recovery.label(state.ready)}</span>
        </li>`;
      })
      .join("");
  }

  return { render, legend, rows };
})();
