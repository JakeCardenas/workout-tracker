function stepsFor(ex) {
  return {
    weightStep: ex.equipment === "Bodyweight" ? 1 : 2.5,
    weightMax: 400,
    repsStep: ex.unit === "sec" ? 5 : 1,
    repsMin: ex.unit === "sec" ? 5 : 1,
    repsMax: ex.unit === "sec" ? 600 : 100,
    repsLabel: ex.unit === "sec" ? "Sec" : "Reps",
    weightLabel: ex.equipment === "Bodyweight" ? "Added" : "Weight",
  };
}

function levelClass(level) {
  return `level level--${level.toLowerCase()}`;
}

function exerciseCard(ex, index = 0) {
  const fav = Store.isFavorite(ex.id);
  return `
    <article class="ex-card" data-ex="${ex.id}" tabindex="0" role="button" aria-label="${esc(ex.name)}"
             style="--i:${Math.min(index, 14)}">
      <button class="fav-btn${fav ? " is-on" : ""}" type="button" data-fav="${ex.id}"
              aria-label="${fav ? "Remove from" : "Add to"} favorites">${Icons.get(fav ? "starFilled" : "star")}</button>
      <div class="ex-art">
        <span class="ex-equip" title="${ex.equipment}">${Icons.equipment(ex.equipment)}</span>
        ${Figure.render(ex.id)}
      </div>
      <div class="ex-info">
        <h3 class="ex-name">${esc(ex.name)}</h3>
        <p class="ex-meta mono">${ex.group} · ${ex.equipment}</p>
        <span class="${levelClass(ex.level)} mono">${ex.level}</span>
      </div>
    </article>`;
}

const ExerciseSheet = (() => {
  function statsBlock(ex) {
    const rec = Store.state.records[ex.id];
    const last = Store.lastPerformance(ex.id);
    if (!rec && !last) return "";
    const cells = [];
    if (last)
      cells.push(
        `<div class="stat"><dt class="mono">Last time</dt><dd>${Fmt.reps(last.reps, ex.unit)} × ${Fmt.weight(last.weight, ex.unit)}<span class="stat-sub mono">${Fmt.relative(last.at)}</span></dd></div>`,
      );
    if (rec && rec.bestWeight)
      cells.push(
        `<div class="stat"><dt class="mono">Best weight</dt><dd>${Fmt.weight(rec.bestWeight, ex.unit)}</dd></div>`,
      );
    if (rec && rec.bestReps)
      cells.push(
        `<div class="stat"><dt class="mono">Best ${ex.unit === "sec" ? "hold" : "reps"}</dt><dd>${Fmt.reps(rec.bestReps, ex.unit)}</dd></div>`,
      );
    return `<dl class="stat-row">${cells.join("")}</dl>`;
  }

  function body(ex) {
    const cfg = Store.config(ex.id);
    const s = stepsFor(ex);
    const fav = Store.isFavorite(ex.id);
    const muscles = (list) =>
      list.length ? list.map((m) => `<span class="muscle-chip mono">${MUSCLES[m]}</span>`).join("") : `<span class="muscle-chip mono is-none">—</span>`;

    return `
      <header class="detail-head">
        <div>
          <h2 class="detail-title">${esc(ex.name)}</h2>
          <p class="detail-meta mono">${ex.group} · ${ex.equipment} · ${ex.level}</p>
        </div>
        <button class="fav-btn fav-btn--inline${fav ? " is-on" : ""}" type="button" data-fav="${ex.id}"
                aria-label="Toggle favorite">${Icons.get(fav ? "starFilled" : "star")}</button>
      </header>

      <div class="detail-grid">
        <figure class="detail-art">
          <span class="ex-equip" title="${ex.equipment}">${Icons.equipment(ex.equipment)}</span>
          ${Figure.render(ex.id, "fig--draw")}
        </figure>

        <div class="detail-side">
          <p class="detail-summary">${esc(ex.summary)}</p>
          <div class="worked" data-art data-view="${ex.view}">
            ${MuscleMap.render(ex.primary, ex.secondary, ex.view, "mm--md")}
            <div class="worked-lists">
              <div class="muscle-block">
                <span class="field-label mono">Primary</span>
                <div class="muscle-list">${muscles(ex.primary)}</div>
              </div>
              <div class="muscle-block">
                <span class="field-label mono">Secondary</span>
                <div class="muscle-list is-secondary">${muscles(ex.secondary)}</div>
              </div>
              <button class="art-flip mono" type="button" data-flip>${Icons.get("flip")} <span data-flip-label>${ex.view === "front" ? "Back" : "Front"}</span></button>
            </div>
          </div>
          ${statsBlock(ex)}
        </div>
      </div>

      <section class="detail-section">
        <h3 class="section-label mono">How to perform</h3>
        <ol class="steps">${ex.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      </section>

      ${ex.tips.length ? `<section class="detail-section">
        <h3 class="section-label mono">Tips</h3>
        <ul class="notes">${ex.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </section>` : ""}

      ${ex.mistakes.length ? `<section class="detail-section">
        <h3 class="section-label mono">Common mistakes</h3>
        <ul class="notes notes--warn">${ex.mistakes.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </section>` : ""}

      <section class="config" data-config="${ex.id}">
        <h3 class="section-label mono">Your workout</h3>
        <div class="config-grid">
          ${Stepper.markup({ name: "sets", value: cfg.sets, min: 1, max: 12, step: 1, label: "Sets" })}
          ${Stepper.markup({ name: "reps", value: cfg.reps, min: s.repsMin, max: s.repsMax, step: s.repsStep, label: s.repsLabel })}
          ${Stepper.markup({ name: "weight", value: cfg.weight, min: 0, max: s.weightMax, step: s.weightStep, label: s.weightLabel, suffix: " kg" })}
        </div>
        ${RestPicker.markup(cfg.rest)}
        <button class="btn btn--primary btn--block" type="button" data-add="${ex.id}">
          ${Icons.get("plus")} Add to Workout
        </button>
      </section>`;
  }

  function open(exId) {
    const ex = EXERCISE_BY_ID[exId];
    if (!ex) return;
    Store.touchRecent(exId);
    Sheet.open({
      title: ex.name,
      size: "sheet-panel--wide",
      body: body(ex),
      onMount(scope) {
        scope.querySelector("[data-flip]").addEventListener("click", () => {
          const fig = scope.querySelector("[data-art]");
          const next = fig.dataset.view === "front" ? "back" : "front";
          fig.dataset.view = next;
          fig.querySelector(".mm").outerHTML = MuscleMap.render(ex.primary, ex.secondary, next, "mm--md");
          scope.querySelector("[data-flip-label]").textContent = next === "front" ? "Back" : "Front";
        });

        const config = scope.querySelector("[data-config]");
        const readConfig = () => ({
          sets: Stepper.read(config, "sets"),
          reps: Stepper.read(config, "reps"),
          weight: Stepper.read(config, "weight"),
          rest: +config.querySelector("[data-rest-picker]").dataset.value,
        });

        config.addEventListener("stepper", () => Store.setConfig(ex.id, readConfig()));
        config.addEventListener("restchange", () => Store.setConfig(ex.id, readConfig()));

        scope.querySelector("[data-add]").addEventListener("click", () => {
          const count = Store.addToDraft(ex.id, readConfig());
          Sound.play("set");
          Sheet.close();
          Toast.show(`${ex.name} added — ${count} exercise${count > 1 ? "s" : ""} in your workout`, {
            action: "View",
            onAction: () => (location.hash = "#/build"),
          });
        });
      },
    });
  }

  return { open };
})();

const LibraryView = (() => {
  const filters = { q: "", groups: new Set(), equip: new Set(), levels: new Set() };
  let favoritesOnly = false;

  function matches(ex) {
    if (favoritesOnly && !Store.isFavorite(ex.id)) return false;
    if (filters.groups.size && !filters.groups.has(ex.group)) return false;
    if (filters.equip.size && !filters.equip.has(ex.equipment)) return false;
    if (filters.levels.size && !filters.levels.has(ex.level)) return false;
    if (!filters.q) return true;
    const hay = `${ex.name} ${ex.group} ${ex.equipment} ${ex.level} ${ex.primary
      .concat(ex.secondary)
      .map((m) => MUSCLES[m])
      .join(" ")}`.toLowerCase();
    return filters.q
      .toLowerCase()
      .split(/\s+/)
      .every((word) => hay.includes(word));
  }

  function chipRow(label, values, active, key) {
    return `<div class="filter-row">
      <span class="filter-key mono">${label}</span>
      <div class="chips">${values
        .map(
          (v) =>
            `<button type="button" class="chip mono${active.has(v) ? " is-on" : ""}" data-filter="${key}" data-value="${v}">${v}</button>`,
        )
        .join("")}</div>
    </div>`;
  }

  function results() {
    const list = EXERCISES.filter(matches);
    if (!list.length)
      return `<div class="empty">
        <p class="empty-title">Nothing matches that</p>
        <p class="empty-sub">Try clearing a filter or searching a muscle group instead.</p>
        <button class="btn" type="button" data-clear>Clear filters</button>
      </div>`;

    if (filters.groups.size || filters.q || favoritesOnly)
      return `<div class="ex-grid">${list.map(exerciseCard).join("")}</div>`;

    return GROUPS.map((group) => {
      const inGroup = list.filter((e) => e.group === group);
      if (!inGroup.length) return "";
      return `<section class="group-block">
        <h2 class="group-head"><span>${group}</span><span class="group-count mono">${inGroup.length}</span></h2>
        <div class="ex-grid">${inGroup.map(exerciseCard).join("")}</div>
      </section>`;
    }).join("");
  }

  function render() {
    const active = filters.groups.size + filters.equip.size + filters.levels.size;
    return `
      <div class="view-head">
        <div>
          <h1 class="view-title">${favoritesOnly ? "Favorites" : "Exercise Library"}</h1>
          <p class="view-sub">${favoritesOnly
            ? "The movements you keep coming back to."
            : `${EXERCISES.length} movements across ${GROUPS.length} muscle groups.`}</p>
        </div>
      </div>

      <div class="search-bar">
        <span class="search-icon">${Icons.get("search")}</span>
        <input class="search-input" type="search" placeholder="Search a movement or muscle"
               value="${esc(filters.q)}" data-search aria-label="Search exercises" />
        ${filters.q ? `<button class="search-clear" type="button" data-clear-q aria-label="Clear search">${Icons.get("close")}</button>` : ""}
      </div>

      <div class="filters">
        ${chipRow("Muscle", GROUPS, filters.groups, "groups")}
        ${chipRow("Equipment", EQUIPMENT, filters.equip, "equip")}
        ${chipRow("Level", LEVELS, filters.levels, "levels")}
        ${active ? `<button class="link-btn mono" type="button" data-clear>Clear ${active} filter${active > 1 ? "s" : ""}</button>` : ""}
      </div>

      <div data-results>${results()}</div>`;
  }

  function repaintResults(root) {
    const box = root.querySelector("[data-results]");
    box.innerHTML = results();
  }

  function mount(root) {
    const input = root.querySelector("[data-search]");

    input.addEventListener("input", () => {
      filters.q = input.value;
      repaintResults(root);
      const clear = root.querySelector("[data-clear-q]");
      if (!!filters.q !== !!clear) refreshChrome(root);
    });

    root.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (chip) {
        const set = filters[chip.dataset.filter];
        const value = chip.dataset.value;
        set.has(value) ? set.delete(value) : set.add(value);
        chip.classList.toggle("is-on");
        repaintResults(root);
        refreshChrome(root, true);
        return;
      }
      if (e.target.closest("[data-clear]")) {
        filters.groups.clear();
        filters.equip.clear();
        filters.levels.clear();
        filters.q = "";
        App.repaint();
        return;
      }
      if (e.target.closest("[data-clear-q]")) {
        filters.q = "";
        App.repaint();
      }
    });
  }

  // only the bar above the results, so typing never loses focus
  function refreshChrome(root, chipsOnly) {
    const bar = root.querySelector(".filters .link-btn");
    const active = filters.groups.size + filters.equip.size + filters.levels.size;
    if (bar) bar.remove();
    if (active) {
      root
        .querySelector(".filters")
        .insertAdjacentHTML(
          "beforeend",
          `<button class="link-btn mono" type="button" data-clear>Clear ${active} filter${active > 1 ? "s" : ""}</button>`,
        );
    }
    if (chipsOnly) return;
    const search = root.querySelector(".search-bar");
    const existing = search.querySelector("[data-clear-q]");
    if (filters.q && !existing)
      search.insertAdjacentHTML(
        "beforeend",
        `<button class="search-clear" type="button" data-clear-q aria-label="Clear search">${Icons.get("close")}</button>`,
      );
    if (!filters.q && existing) existing.remove();
  }

  return {
    render,
    mount,
    setFavoritesOnly(v) {
      favoritesOnly = v;
    },
  };
})();
