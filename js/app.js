const HomeView = (() => {
  function draftCard() {
    const draft = Store.state.draft;
    if (!draft.items.length) return "";
    const totals = draftTotals(draft.items);
    return `
      <section class="hero-card">
        <div class="hero-card-top">
          <p class="card-kicker mono">In progress</p>
          <h2 class="hero-card-title">${esc(draft.name || "Untitled Workout")}</h2>
          <p class="hero-card-meta mono">${draft.items.length} exercises · ${totals.sets} sets · ~${Fmt.duration(totals.duration)}</p>
        </div>
        <ul class="hero-card-list mono">
          ${draft.items.slice(0, 5).map((i) => `<li>${esc(EXERCISE_BY_ID[i.exId].name)}<span>${i.sets} × ${i.reps}</span></li>`).join("")}
          ${draft.items.length > 5 ? `<li class="is-more">+${draft.items.length - 5} more</li>` : ""}
        </ul>
        <div class="hero-card-actions">
          <button class="btn btn--primary" type="button" data-start-draft>${Icons.get("play")} Start Workout</button>
          <a class="btn" href="#/build">Edit</a>
        </div>
      </section>`;
  }

  function render() {
    const { history, workouts, recent } = Store.state;
    const last = history[0];

    return `
      <section class="hero">
        <p class="hero-kicker mono">Workout Guide &amp; Tracker</p>
        <h1 class="hero-title">Train smarter.<br />Track every set.</h1>
        <p class="hero-sub">Browse ${EXERCISES.length} movements, turn any of them into a real workout, then run it set by set with a rest timer that keeps you honest.</p>
        <div class="hero-actions">
          <button class="btn btn--primary btn--lg" type="button" data-start-draft>${Icons.get("play")} Start Workout</button>
          <a class="btn btn--lg" href="#/library">${Icons.get("library")} Browse Exercises</a>
        </div>
      </section>

      ${draftCard()}

      ${last
        ? `<section class="block">
            <h2 class="section-head"><span>Last workout</span><a class="link-btn mono" href="#/history">All history</a></h2>
            <article class="last-card" data-session="${last.id}" tabindex="0" role="button">
              <div>
                <p class="card-kicker mono">${Fmt.relative(last.endedAt)}</p>
                <h3 class="last-name">${esc(last.name)}</h3>
              </div>
              <dl class="last-stats mono">
                <div><dt>Sets</dt><dd>${last.stats.sets}</dd></div>
                <div><dt>Reps</dt><dd>${last.stats.reps}</dd></div>
                <div><dt>Volume</dt><dd>${Fmt.volume(last.stats.volume)}</dd></div>
                <div><dt>Time</dt><dd>${Fmt.duration(last.stats.duration)}</dd></div>
              </dl>
            </article>
          </section>`
        : ""}

      ${workouts.length
        ? `<section class="block">
            <h2 class="section-head"><span>Saved workouts</span><a class="link-btn mono" href="#/build">Manage</a></h2>
            <div class="quick-grid">
              ${workouts
                .slice(0, 4)
                .map(
                  (w) => `<button class="quick-card" type="button" data-quick="${w.id}">
                    <span class="quick-name">${esc(w.name)}</span>
                    <span class="quick-meta mono">${w.items.length} exercises</span>
                    <span class="quick-go mono">${Icons.get("play")} Start</span>
                  </button>`,
                )
                .join("")}
            </div>
          </section>`
        : ""}

      <section class="block">
        <h2 class="section-head"><span>Quick start</span><a class="link-btn mono" href="#/build">All templates</a></h2>
        <div class="template-grid">
          ${TEMPLATES.slice(0, 3)
            .map(
              (t) => `<button class="template-card" type="button" data-template="${t.id}">
                <span class="template-name">${t.name}</span>
                <span class="template-note mono">${t.note}</span>
                <span class="template-count mono">${t.exercises.length} exercises</span>
              </button>`,
            )
            .join("")}
        </div>
      </section>

      ${recent.length
        ? `<section class="block">
            <h2 class="section-head"><span>Recently used</span><a class="link-btn mono" href="#/library">Library</a></h2>
            <div class="ex-grid">${recent
              .slice(0, 4)
              .map((id) => EXERCISE_BY_ID[id])
              .filter(Boolean)
              .map(exerciseCard)
              .join("")}</div>
          </section>`
        : ""}`;
  }

  function mount(root) {
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-start-draft]")) {
        const draft = Store.state.draft;
        if (draft.items.length) return Session.start(draft);
        Toast.show("Build a workout first — pick a template to start fast");
        location.hash = "#/build";
        return;
      }
      const quick = e.target.closest("[data-quick]");
      if (quick) {
        Store.loadWorkout(quick.dataset.quick);
        return Session.start(Store.state.draft);
      }
      const template = e.target.closest("[data-template]");
      if (template) {
        const t = TEMPLATES.find((x) => x.id === template.dataset.template);
        Store.clearDraft();
        Store.setDraftName(t.name);
        t.exercises.forEach((id) => Store.addToDraft(id));
        Sound.play("set");
        location.hash = "#/build";
        return;
      }
      const session = e.target.closest("[data-session]");
      if (session) HistoryView.openSession(session.dataset.session);
    });
  }

  return { render, mount };
})();

const App = (() => {
  const ROUTES = {
    "/": { view: HomeView, nav: "home" },
    "/library": { view: LibraryView, nav: "library", favorites: false },
    "/favorites": { view: LibraryView, nav: "favorites", favorites: true },
    "/build": { view: BuildView, nav: "build" },
    "/history": { view: HistoryView, nav: "history" },
    "/progress": { view: ProgressView, nav: "progress" },
  };

  let currentPath = "/";

  function route() {
    const path = location.hash.replace(/^#/, "") || "/";
    return ROUTES[path] ? path : "/";
  }

  function paint(animate) {
    currentPath = route();
    const entry = ROUTES[currentPath];
    if (entry.favorites !== undefined) LibraryView.setFavoritesOnly(entry.favorites);

    // a fresh node each paint, or every view's delegated listener stacks up
    const stale = document.getElementById("view");
    const host = stale.cloneNode(false);
    host.innerHTML = entry.view.render();
    stale.replaceWith(host);
    entry.view.mount(host);

    document.querySelectorAll("[data-nav]").forEach((link) =>
      link.classList.toggle("is-active", link.dataset.nav === entry.nav),
    );
    syncBadges();

    if (animate !== false) {
      host.classList.remove("is-entering");
      void host.offsetWidth;
      host.classList.add("is-entering");
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    }
  }

  const repaint = () => paint(false);

  function syncBadges() {
    const count = Store.state.draft.items.length;
    document.querySelectorAll("[data-build-badge]").forEach((badge) => {
      badge.textContent = count;
      badge.hidden = count === 0;
    });
    const favs = Store.state.favorites.length;
    document.querySelectorAll("[data-fav-badge]").forEach((badge) => {
      badge.textContent = favs;
      badge.hidden = favs === 0;
    });
  }

  function applyTheme(mode) {
    const dark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.querySelectorAll("[data-theme-btn]").forEach((b) =>
      b.classList.toggle("is-on", b.dataset.themeBtn === mode),
    );
  }

  function syncSoundButtons() {
    const on = Sound.isEnabled();
    document.querySelectorAll("[data-sound-toggle]").forEach((b) => {
      b.innerHTML = Icons.get(on ? "sound" : "muted");
      b.classList.toggle("is-off", !on);
      b.setAttribute("aria-label", on ? "Mute sounds" : "Unmute sounds");
    });
  }

  function boot() {
    applyTheme(Store.state.settings.theme);
    Sound.restore(Store.state.settings.sound);
    syncSoundButtons();

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (Store.state.settings.theme === "system") applyTheme("system");
    });

    window.addEventListener("hashchange", () => paint(true));

    document.addEventListener("click", (e) => {
      const themeBtn = e.target.closest("[data-theme-btn]");
      if (themeBtn) {
        Store.setSetting("theme", themeBtn.dataset.themeBtn);
        applyTheme(themeBtn.dataset.themeBtn);
        Sound.play("tap");
      }

      const soundBtn = e.target.closest("[data-sound-toggle]");
      if (soundBtn) {
        const next = !Sound.isEnabled();
        Sound.setEnabled(next);
        Store.setSetting("sound", next);
        syncSoundButtons();
      }

      const fav = e.target.closest("[data-fav]");
      if (fav) {
        e.stopPropagation();
        const now = Store.toggleFavorite(fav.dataset.fav);
        fav.classList.toggle("is-on", now);
        fav.innerHTML = Icons.get(now ? "starFilled" : "star");
        Sound.play(now ? "set" : "tap");
        syncBadges();
        if (currentPath === "/favorites") repaint();
        return;
      }

      const card = e.target.closest(".ex-card");
      if (card) ExerciseSheet.open(card.dataset.ex);
    });

    document.addEventListener("keydown", (e) => {
      const card = e.target.closest(".ex-card");
      if (card && (e.key === "Enter" || e.code === "Space")) {
        e.preventDefault();
        ExerciseSheet.open(card.dataset.ex);
      }
    });

    document.getElementById("nav-toggle").addEventListener("click", () => {
      document.body.classList.toggle("nav-open");
      Sound.play("tap");
    });
    document
      .getElementById("nav-scrim")
      .addEventListener("click", () => document.body.classList.remove("nav-open"));

    document.querySelectorAll("[data-nav]").forEach((link) =>
      link.addEventListener("click", () => document.body.classList.remove("nav-open")),
    );

    paint(false);
    document.body.classList.add("is-ready");
  }

  return { boot, paint, repaint, syncSoundButtons, syncBadges };
})();

document.addEventListener("DOMContentLoaded", App.boot);
