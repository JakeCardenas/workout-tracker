const App = (() => {
  const ROUTES = {
    "/": { view: HomeView, nav: "home" },
    "/library": { view: LibraryView, nav: "library", favorites: false },
    "/favorites": { view: LibraryView, nav: "favorites", favorites: true },
    "/build": { view: BuildView, nav: "build" },
    "/plan": { view: PlanView, nav: "plan" },
    "/you": { view: YouView, nav: "you" },
    "/settings": { view: SettingsView, nav: "settings" },
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

    // moving focus to the new view is what tells a screen reader the page changed
    if (animate !== false) {
      host.focus({ preventScroll: true });
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

  function openDataSheet() {
    const { favorites, workouts, history, records } = Store.state;
    const bytes = new Blob([localStorage.getItem("reps.state.v1") || ""]).size;
    const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

    Sheet.open({
      title: "Your data",
      body: `
        <header class="detail-head">
          <div>
            <h2 class="detail-title">Your data</h2>
            <p class="detail-meta mono">Everything stays in this browser. Back it up before you clear site data.</p>
          </div>
        </header>
        <dl class="data-rows">
          ${row("Saved workouts", workouts.length)}
          ${row("Logged sessions", history.length)}
          ${row("Favorites", favorites.length)}
          ${row("Tracked movements", Object.keys(records).length)}
          ${row("Storage used", `${(bytes / 1024).toFixed(1)} KB`)}
        </dl>
        <div class="confirm-actions">
          <button class="btn btn--primary" type="button" data-export>${Icons.get("down")} Save a backup</button>
          <button class="btn" type="button" data-import>${Icons.get("up")} Restore</button>
          <button class="btn btn--danger" type="button" data-reset-all>${Icons.get("trash")} Erase</button>
        </div>
        <input type="file" accept="application/json,.json" hidden data-file />`,
      onMount(scope) {
        const file = scope.querySelector("[data-file]");

        scope.querySelector("[data-export]").addEventListener("click", () => {
          Backup.download();
          Toast.show("Backup saved to your downloads");
        });

        scope.querySelector("[data-import]").addEventListener("click", () => file.click());

        file.addEventListener("change", async () => {
          const chosen = file.files[0];
          if (!chosen) return;
          try {
            const next = await Backup.read(chosen);
            const count = Backup.summarise(next);
            Store.replace(next);
            Units.set(Store.state.settings.unit);
            applyTheme(Store.state.settings.theme);
            syncUnitButtons();
            Sheet.close();
            Sound.play("set");
            repaint();
            Toast.show(`Restored ${count.history} workouts and ${count.workouts} saved routines`);
          } catch (err) {
            Toast.show(err.message || "That backup could not be read");
          }
          file.value = "";
        });

        scope.querySelector("[data-reset-all]").addEventListener("click", () => {
          Store.reset();
          Units.set(Store.state.settings.unit);
          applyTheme(Store.state.settings.theme);
          syncUnitButtons();
          Sheet.close();
          Sound.play("remove");
          repaint();
          Toast.show("All data erased");
        });
      },
    });
  }

  function syncShell() {
    syncUnitButtons();
    syncSoundButtons();
    syncBadges();
    document.querySelectorAll("[data-install-cta]").forEach((el) => {
      el.hidden = Shell.standalone() || !Shell.canInstall();
    });
  }

  function syncUnitButtons() {
    document.querySelectorAll("[data-unit-toggle]").forEach((b) => {
      b.textContent = Units.label().toUpperCase();
      b.setAttribute(
        "aria-label",
        `Weight unit ${Units.label()}. Switch to ${Units.isLb() ? "kilograms" : "pounds"}`,
      );
    });
  }

  function syncSoundButtons() {
    const on = Sound.isEnabled();
    document.querySelectorAll("[data-sound-toggle]").forEach((b) => {
      b.innerHTML = Icons.get(on ? "sound" : "muted");
      b.classList.toggle("is-off", !on);
      b.setAttribute("aria-label", on ? "Mute sounds" : "Unmute sounds");
    });
  }

  const HOVERS =
    ".btn, .icon-btn, .chip, .rest-chip, .ctl-btn, .fav-btn, .step-btn, .link-btn," +
    " .nav-link, .tab, .art-flip, .toast-action, .ex-card, .template-card," +
    " .quick-card, .saved-card, .hist-card, .last-card, .prog-row, .build-main";

  // a link stays silent on click: the hover tick already acknowledged it
  const TAPS = "button, a.btn, .ex-card, .build-main, .hist-card, .last-card, .prog-row";
  const OWN_CUE = ".step-btn, [data-sound-toggle]";

  function wireSounds() {
    let hovered = null;

    document.addEventListener("pointerover", (e) => {
      if (e.pointerType === "touch") return;
      const el = e.target.closest(HOVERS);
      if (!el || el === hovered || el.disabled) return;
      hovered = el;
      Sound.play("hover");
    });

    document.addEventListener("pointerout", (e) => {
      if (hovered && !hovered.contains(e.relatedTarget)) hovered = null;
    });

    document.addEventListener(
      "click",
      (e) => {
        const el = e.target.closest(TAPS);
        if (!el || el.disabled || el.closest(OWN_CUE)) return;
        Sound.play("tap");
      },
      true,
    );
  }

  function offerResume() {
    const snapshot = Workout.saved();
    if (!snapshot) return;
    const done = snapshot.exercises.reduce(
      (t, e) => t + e.sets.filter((x) => x.done).length, 0,
    );
    const total = snapshot.exercises.reduce((t, e) => t + e.sets.length, 0);

    Sheet.open({
      title: "Continue workout",
      body: `<div class="confirm">
        <h2 class="confirm-title">Pick up where you left off?</h2>
        <p class="confirm-sub">${esc(snapshot.name)} — ${done} of ${total} sets done.</p>
        <div class="confirm-actions">
          <button class="btn btn--primary" type="button" data-resume>Continue</button>
          <button class="btn" type="button" data-discard>Discard</button>
        </div>
      </div>`,
      onMount(scope) {
        scope.querySelector("[data-resume]").addEventListener("click", () => {
          Sheet.close();
          Workout.resume(snapshot);
        });
        scope.querySelector("[data-discard]").addEventListener("click", () => {
          Workout.forget();
          Sheet.close();
        });
      },
    });
  }

  // desktop shortcuts, kept out of the browser's way
  function wireKeys() {
    document.addEventListener("keydown", (e) => {
      if (Workout.isLive()) return;
      const typing = e.target.matches("input, textarea, select");

      if (e.key === "/" && !typing) {
        const box = document.querySelector("[data-search]");
        if (box) {
          e.preventDefault();
          if (currentPath !== "/library") location.hash = "#/library";
          setTimeout(() => document.querySelector("[data-search]").focus(), 60);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        location.hash = "#/library";
        setTimeout(() => {
          const box = document.querySelector("[data-search]");
          if (box) box.focus();
        }, 80);
      }
    });
  }

  function boot() {
    applyTheme(Store.state.settings.theme);
    Units.set(Store.state.settings.unit);
    syncUnitButtons();
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
      }

      if (e.target.closest("[data-open-data]")) openDataSheet();

      const unitBtn = e.target.closest("[data-unit-toggle]");
      if (unitBtn) {
        const next = Units.isLb() ? "kg" : "lb";
        Units.set(next);
        Store.setSetting("unit", next);
        syncUnitButtons();
        repaint();
        Toast.show(`Weights now in ${next === "lb" ? "pounds" : "kilograms"}`);
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
        if (now) Sound.play("set");
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
    });
    document
      .getElementById("nav-scrim")
      .addEventListener("click", () => document.body.classList.remove("nav-open"));

    document.querySelectorAll("[data-nav]").forEach((link) =>
      link.addEventListener("click", () => document.body.classList.remove("nav-open")),
    );

    wireSounds();
    wireKeys();
    Shell.start();
    Splash.play();
    paint(false);
    document.body.classList.add("is-ready");
    syncShell();
    setTimeout(offerResume, Splash.isPlaying ? 2400 : 0);



    // needs http(s); opening index.html straight off the disk just skips it
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  return { boot, paint, repaint, syncSoundButtons, syncUnitButtons, syncBadges };
})();

document.addEventListener("DOMContentLoaded", App.boot);
