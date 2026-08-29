const SettingsView = (() => {
  const VERSION = "1.0";

  function confirmThen(title, note, label, run) {
    Sheet.open({
      title,
      body: `<div class="confirm">
        <h2 class="confirm-title">${title}</h2>
        <p class="confirm-sub">${note}</p>
        <div class="confirm-actions">
          <button class="btn btn--danger" type="button" data-go>${label}</button>
          <button class="btn" type="button" data-close>Cancel</button>
        </div>
      </div>`,
      onMount(scope) {
        scope.querySelector("[data-go]").addEventListener("click", () => {
          run();
          Sheet.close();
          Sound.play("remove");
          App.repaint();
        });
      },
    });
  }

  function row(label, note, control) {
    return `<div class="set-row">
      <div class="set-label">
        <span>${label}</span>
        ${note ? `<span class="set-note mono">${note}</span>` : ""}
      </div>
      <div class="set-control">${control}</div>
    </div>`;
  }

  function render() {
    const s = Store.state;
    const installed = Shell.standalone();
    const themes = ["system", "light", "dark"];

    return `
      <div class="view-head">
        <div>
          <h1 class="view-title">Settings</h1>
          <p class="view-sub">Everything is stored on this device. Nothing is uploaded.</p>
        </div>
      </div>

      <section class="set-block">
        <h2 class="section-head"><span>Application</span></h2>
        ${row("Running as", installed ? "Installed app" : "Web version",
          `<span class="pill mono">${installed ? "Installed" : "Browser"}</span>`)}
        ${!installed
          ? row("Install", "Add it to your device for an app window and offline access",
              `<button class="btn btn--sm btn--primary" type="button" data-install ${Shell.canInstall() ? "" : "disabled"}>
                ${Shell.canInstall() ? "Install app" : "Not available here"}
              </button>`)
          : ""}
        ${row("Updates", "Version " + VERSION,
          `<button class="btn btn--sm" type="button" data-check-update>Check for updates</button>`)}
      </section>

      <section class="set-block">
        <h2 class="section-head"><span>Appearance</span></h2>
        ${row("Theme", "Follows your system unless you pick one",
          `<div class="seg mono">${themes
            .map((t) => `<button type="button" class="seg-btn${s.settings.theme === t ? " is-on" : ""}" data-theme-btn="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`)
            .join("")}</div>`)}
        ${row("Sound", "Short cues for sets, rest and records",
          `<button class="btn btn--sm" type="button" data-sound-toggle-label>${Sound.isEnabled() ? "On" : "Off"}</button>`)}
      </section>

      <section class="set-block">
        <h2 class="section-head"><span>Units</span></h2>
        ${row("Weight", "Stored in kilograms either way",
          `<div class="seg mono">
            <button type="button" class="seg-btn${!Units.isLb() ? " is-on" : ""}" data-unit-set="kg">KG</button>
            <button type="button" class="seg-btn${Units.isLb() ? " is-on" : ""}" data-unit-set="lb">LB</button>
          </div>`)}
      </section>

      <section class="set-block">
        <h2 class="section-head"><span>Data</span></h2>
        ${row("Favorites", `${s.favorites.length} saved`,
          `<button class="btn btn--sm" type="button" data-clear="favorites" ${s.favorites.length ? "" : "disabled"}>Clear</button>`)}
        ${row("Recently viewed", `${s.recent.length} exercises`,
          `<button class="btn btn--sm" type="button" data-clear="recent" ${s.recent.length ? "" : "disabled"}>Clear</button>`)}
        ${row("Fitness profile", s.profile ? "Set" : "Not set",
          `<button class="btn btn--sm" type="button" data-clear="profile" ${s.profile ? "" : "disabled"}>Reset</button>`)}
        ${row("Backup", "Export everything as a file, or restore one",
          `<button class="btn btn--sm" type="button" data-export>Export</button>`)}
        ${row("Everything", `${s.history.length} workouts, ${s.workouts.length} routines`,
          `<button class="btn btn--sm btn--danger" type="button" data-clear="all">Erase all</button>`)}
      </section>

      <section class="about">
        <img class="about-logo" src="./assets/brand/logo.svg" width="64" height="64" alt="" />
        <h2 class="about-name">REPS</h2>
        <p class="about-tag mono">Train. Track. Progress.</p>
        <p class="about-copy">A workout guide and training tracker. Browse ${EXERCISES.length} movements,
        build a workout, run it set by set with a rest timer, and watch the numbers move.
        Everything is stored on your device.</p>
        <dl class="about-meta mono">
          <div><dt>Version</dt><dd>${VERSION}</dd></div>
          <div><dt>Exercises</dt><dd>${EXERCISES.length}</dd></div>
          <div><dt>Splits</dt><dd>${SPLITS.length}</dd></div>
          <div><dt>Running as</dt><dd>${installed ? "Installed app" : "Web"}</dd></div>
        </dl>
        <p class="about-by mono">Made by Jake Cardenas</p>
        <details class="credits">
          <summary class="mono">Credits</summary>
          <p class="set-foot mono">Exercise illustrations by
            <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noopener">Bryl Lim</a>,
            used under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>
            and recoloured for this app.
          </p>
        </details>
      </section>`;
  }

  function mount(root) {
    root.addEventListener("click", async (e) => {
      if (e.target.closest("[data-install]")) {
        const ok = await Shell.install();
        if (ok) Toast.show("Installing…");
        return;
      }

      if (e.target.closest("[data-check-update]")) {
        Toast.show("Checking…");
        const state = await Shell.checkForUpdate();
        if (state === "ready") Toast.show("Update ready", { action: "Reload", onAction: Shell.applyUpdate });
        else if (state === "current") Toast.show("You are on the latest version");
        else Toast.show("Updates are not available here");
        return;
      }

      const unit = e.target.closest("[data-unit-set]");
      if (unit) {
        const next = unit.dataset.unitSet;
        Units.set(next);
        Store.setSetting("unit", next);
        App.syncShell();
        return App.repaint();
      }

      if (e.target.closest("[data-sound-toggle-label]")) {
        const next = !Sound.isEnabled();
        Sound.setEnabled(next);
        Store.setSetting("sound", next);
        return App.repaint();
      }

      if (e.target.closest("[data-export]")) {
        Backup.download();
        return Toast.show("Backup saved to your downloads");
      }

      const clear = e.target.closest("[data-clear]");
      if (!clear) return;
      const what = clear.dataset.clear;

      if (what === "all") {
        return confirmThen(
          "Erase everything?",
          "Every workout, routine, favorite and setting on this device. This cannot be undone.",
          "Erase all",
          () => {
            Store.reset();
            Workout.forget();
            Units.set(Store.state.settings.unit);
            App.syncShell();
          },
        );
      }

      const labels = { favorites: "favorites", recent: "recently viewed list", profile: "fitness profile" };
      confirmThen(
        `Clear your ${labels[what]}?`,
        "Your workouts and history are not affected.",
        "Clear",
        () => {
          if (what === "profile") Store.setProfile(null);
          else {
            Store.state[what] = [];
            Store.setSetting("unit", Store.state.settings.unit);
          }
        },
      );
    });
  }

  return { render, mount, VERSION };
})();
