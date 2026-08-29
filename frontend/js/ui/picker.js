// Shared exercise chooser. The library browses; this one picks and returns.
const Picker = (() => {
  const state = { q: "", groups: new Set(), equip: new Set(), levels: new Set(), only: "" };

  function matches(ex) {
    if (state.only === "fav" && !Store.isFavorite(ex.id)) return false;
    if (state.only === "recent" && !Store.state.recent.includes(ex.id)) return false;
    if (state.groups.size && !state.groups.has(ex.group)) return false;
    if (state.equip.size && !state.equip.has(ex.equipment)) return false;
    if (state.levels.size && !state.levels.has(ex.level)) return false;
    if (!state.q) return true;
    const hay = `${ex.name} ${ex.group} ${ex.equipment} ${ex.level} ${ex.primary
      .concat(ex.secondary)
      .map((m) => MUSCLES[m])
      .join(" ")}`.toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every((word) => hay.includes(word));
  }

  const chips = (label, values, active, key) => `
    <div class="filter-row">
      <span class="filter-key mono">${label}</span>
      <div class="chips">${values
        .map((v) => `<button type="button" class="chip mono${active.has(v) ? " is-on" : ""}" data-pf="${key}" data-value="${v}">${v}</button>`)
        .join("")}</div>
    </div>`;

  function results(onPick) {
    const list = EXERCISES.filter(matches);
    if (!list.length) {
      return `<div class="empty empty--tight">
        <p class="empty-title">Nothing matches</p>
        <p class="empty-sub">Try a different filter or search term.</p>
        <button class="btn btn--sm" type="button" data-pf-clear>Clear filters</button>
      </div>`;
    }
    return `<div class="pick-grid">${list.map(pickCard).join("")}</div>`;
  }

  function pickCard(ex) {
    const inDraft = Store.state.draft.items.some((i) => i.exId === ex.id);
    return `
      <button class="pick-card${inDraft ? " is-added" : ""}" type="button" data-pick="${ex.id}">
        <span class="pick-art">${Art.render(ex.id)}</span>
        <span class="pick-body">
          <span class="pick-name">${esc(ex.name)}</span>
          <span class="pick-meta mono">${ex.group} · ${ex.equipment}</span>
        </span>
        <span class="pick-add mono">${inDraft ? Icons.get("check") : Icons.get("plus")}</span>
      </button>`;
  }

  function body(onPick) {
    const counts = { fav: Store.state.favorites.length, recent: Store.state.recent.length };
    return `
      <header class="detail-head">
        <div>
          <h2 class="detail-title">Add an exercise</h2>
          <p class="detail-meta mono">${EXERCISES.length} movements</p>
        </div>
      </header>

      <div class="search-bar">
        <span class="search-icon">${Icons.get("search")}</span>
        <input class="search-input" type="search" placeholder="Search a movement or muscle"
               data-pf-search aria-label="Search exercises" />
      </div>

      <div class="filters">
        <div class="filter-row">
          <span class="filter-key mono">Show</span>
          <div class="chips">
            <button type="button" class="chip mono${state.only === "" ? " is-on" : ""}" data-only="">All</button>
            <button type="button" class="chip mono${state.only === "fav" ? " is-on" : ""}" data-only="fav" ${counts.fav ? "" : "disabled"}>Favorites</button>
            <button type="button" class="chip mono${state.only === "recent" ? " is-on" : ""}" data-only="recent" ${counts.recent ? "" : "disabled"}>Recent</button>
          </div>
        </div>
        ${chips("Muscle", GROUPS, state.groups, "groups")}
        ${chips("Equipment", EQUIPMENT, state.equip, "equip")}
        ${chips("Level", LEVELS, state.levels, "levels")}
      </div>

      <div data-pf-results>${results(onPick)}</div>`;
  }

  function open(onPick) {
    Sheet.open({
      title: "Add an exercise",
      size: "sheet-panel--wide",
      body: body(onPick),
      onMount(scope) {
        const repaint = () => {
          const box = scope.querySelector("[data-pf-results]");
          box.innerHTML = results(onPick);
          Art.scan(box);
        };

        scope.querySelector("[data-pf-search]").addEventListener("input", (e) => {
          state.q = e.target.value;
          repaint();
        });

        scope.addEventListener("click", (e) => {
          const chip = e.target.closest("[data-pf]");
          if (chip) {
            const set = state[chip.dataset.pf];
            const v = chip.dataset.value;
            set.has(v) ? set.delete(v) : set.add(v);
            chip.classList.toggle("is-on");
            return repaint();
          }

          const only = e.target.closest("[data-only]");
          if (only) {
            state.only = only.dataset.only;
            scope.querySelectorAll("[data-only]").forEach((b) => b.classList.toggle("is-on", b === only));
            return repaint();
          }

          if (e.target.closest("[data-pf-clear]")) {
            state.q = "";
            state.only = "";
            state.groups.clear();
            state.equip.clear();
            state.levels.clear();
            scope.innerHTML = body(onPick);
            return open.mounted(scope, onPick);
          }

          const pick = e.target.closest("[data-pick]");
          if (pick) {
            onPick(pick.dataset.pick);
            Sound.play("set");
            repaint();
          }
        });
      },
    });
  }

  open.mounted = (scope, onPick) => open(onPick);

  return { open };
})();
