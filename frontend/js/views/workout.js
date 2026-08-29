const Workout = (() => {
  const RING = 2 * Math.PI * 54;
  let live = null;
  let raf = null;

  const root = () => document.getElementById("session");

  function start(source) {
    if (!source.items || !source.items.length) {
      return Toast.show("Add an exercise before starting");
    }
    live = {
      name: source.name || "Workout",
      startedAt: Date.now(),
      exIndex: 0,
      setIndex: 0,
      finished: false,
      rest: null,
      exercises: source.items.map((item) => ({
        exId: item.exId,
        rest: item.rest,
        sets: Array.from({ length: item.sets }, () => ({
          reps: item.reps,
          weight: item.weight,
          done: false,
        })),
      })),
    };
    root().classList.add("is-on");
    document.body.classList.add("no-scroll");
    Sound.play("swell");
    paint();
  }

  const totalSets = () => live.exercises.reduce((t, e) => t + e.sets.length, 0);
  const doneSets = () =>
    live.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);

  function current() {
    const exercise = live.exercises[live.exIndex];
    return { exercise, set: exercise.sets[live.setIndex], meta: EXERCISE_BY_ID[exercise.exId] };
  }

  function upNext() {
    const rows = [];
    for (let e = live.exIndex; e < live.exercises.length && rows.length < 3; e++) {
      const start = e === live.exIndex ? live.setIndex + 1 : 0;
      const ex = live.exercises[e];
      if (start >= ex.sets.length) continue;
      rows.push({
        name: EXERCISE_BY_ID[ex.exId].name,
        detail: `${ex.sets.length - start} set${ex.sets.length - start > 1 ? "s" : ""} left`,
      });
    }
    return rows;
  }

  function paint() {
    if (live.finished) return paintSummary();
    const { exercise, set, meta } = current();
    const s = stepsFor(meta);
    const progress = (doneSets() / totalSets()) * 100;

    root().innerHTML = `
      <div class="session-shell">
        <header class="session-bar">
          <button class="icon-btn" type="button" data-exit aria-label="Leave workout">${Icons.get("close")}</button>
          <div class="session-title">
            <span class="mono session-name">${esc(live.name)}</span>
            <span class="mono session-count">${doneSets()} / ${totalSets()} sets</span>
          </div>
          <button class="icon-btn" type="button" data-sound aria-label="Toggle sound">${Icons.get(Sound.isEnabled() ? "sound" : "muted")}</button>
        </header>
        <div class="session-progress"><span style="width:${progress}%"></span></div>

        <main class="session-main">
          <p class="session-step mono">Exercise ${live.exIndex + 1} of ${live.exercises.length}</p>
          <h1 class="session-ex">${esc(meta.name)}</h1>
          <p class="session-set mono">Set ${live.setIndex + 1} of ${exercise.sets.length}</p>

          <div class="session-art">${Art.render(meta.id, "is-playing")}</div>

          <div class="session-dots" aria-hidden="true">
            ${exercise.sets
              .map(
                (x, i) =>
                  `<span class="set-dot${x.done ? " is-done" : ""}${i === live.setIndex ? " is-active" : ""}"></span>`,
              )
              .join("")}
          </div>

          <div class="session-config" data-config>
            ${Stepper.markup({ name: "reps", value: set.reps, min: s.repsMin, max: s.repsMax, step: s.repsStep, label: s.repsLabel, wide: true })}
            ${Stepper.markup({ name: "weight", value: Units.fromKg(set.weight), min: 0, max: s.weightMax, step: s.weightStep, label: s.weightLabel, suffix: ` ${Units.label()}`, wide: true })}
          </div>

          ${Plates.usesBar(meta) ? `<div class="session-bar-load" data-bar>${Plates.strip(set.weight)}</div>` : ""}

          <button class="btn btn--primary btn--xl" type="button" data-complete>${Icons.get("check")} Complete Set</button>
          <button class="link-btn mono" type="button" data-skip-set>Skip this set</button>

          ${upNext().length
            ? `<section class="up-next">
                <h2 class="section-label mono">Up next</h2>
                <ul>${upNext().map((r) => `<li><span>${esc(r.name)}</span><span class="mono">${r.detail}</span></li>`).join("")}</ul>
              </section>`
            : ""}
        </main>
      </div>`;

    const config = root().querySelector("[data-config]");
    config.addEventListener("stepper", (e) => {
      const { exercise: ex, set: active } = current();
      const value = e.detail.name === "weight" ? Units.toKg(e.detail.value) : e.detail.value;
      active[e.detail.name] = value;
      ex.sets.forEach((x, i) => {
        if (i > live.setIndex && !x.done) x[e.detail.name] = value;
      });
      const bar = root().querySelector("[data-bar]");
      if (bar && e.detail.name === "weight") bar.innerHTML = Plates.strip(value);
    });
  }

  function completeSet() {
    const { exercise, set } = current();
    if (set.done) return;
    set.done = true;
    set.at = Date.now();
    Sound.play("set");

    const card = root().querySelector(".session-main");
    if (card) {
      card.classList.add("is-banked");
      setTimeout(() => card.classList.remove("is-banked"), 320);
    }

    // the header sits behind the rest overlay, so nudge it now
    root().querySelector(".session-count").textContent = `${doneSets()} / ${totalSets()} sets`;
    root().querySelector(".session-progress span").style.width = `${(doneSets() / totalSets()) * 100}%`;
    const dot = root().querySelectorAll(".set-dot")[live.setIndex];
    if (dot) dot.classList.add("is-done");

    const last = live.exIndex === live.exercises.length - 1 && live.setIndex === exercise.sets.length - 1;
    if (last) return setTimeout(finish, 260);

    const rest = exercise.rest;
    if (rest > 0) setTimeout(() => startRest(rest), 240);
    else setTimeout(() => { advance(); paint(); }, 240);
  }

  function advance() {
    const exercise = live.exercises[live.exIndex];
    if (live.setIndex < exercise.sets.length - 1) live.setIndex++;
    else {
      live.exIndex++;
      live.setIndex = 0;
    }
  }

  function startRest(seconds) {
    live.rest = { total: seconds, endsAt: Date.now() + seconds * 1000, warned: new Set() };
    const next = live.exercises[live.exIndex].sets[live.setIndex + 1]
      ? EXERCISE_BY_ID[live.exercises[live.exIndex].exId].name
      : live.exercises[live.exIndex + 1]
        ? EXERCISE_BY_ID[live.exercises[live.exIndex + 1].exId].name
        : "";

    root().insertAdjacentHTML(
      "beforeend",
      `<div class="rest" data-rest-layer>
        <p class="rest-label mono">Rest</p>
        <div class="rest-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-track" cx="60" cy="60" r="54" />
            <circle class="ring-fill" cx="60" cy="60" r="54"
                    stroke-dasharray="${RING}" stroke-dashoffset="0" />
          </svg>
          <span class="rest-clock mono" data-clock>${Fmt.clock(seconds)}</span>
        </div>
        <p class="rest-next">Next up · <strong>${esc(next)}</strong></p>
        <div class="rest-actions">
          <button class="btn" type="button" data-add-rest>+30s</button>
          <button class="btn btn--primary" type="button" data-skip-rest>${Icons.get("skip")} Skip rest</button>
        </div>
      </div>`,
    );
    tick();
  }

  function tick() {
    cancelAnimationFrame(raf);
    const layer = root().querySelector("[data-rest-layer]");
    if (!layer || !live.rest) return;

    const remaining = (live.rest.endsAt - Date.now()) / 1000;
    const clock = layer.querySelector("[data-clock]");
    const ring = layer.querySelector(".ring-fill");
    clock.textContent = Fmt.clock(Math.max(0, remaining));
    ring.style.strokeDashoffset = String(RING * (1 - Math.max(0, remaining) / live.rest.total));

    const whole = Math.ceil(remaining);
    if (whole <= 3 && whole > 0 && !live.rest.warned.has(whole)) {
      live.rest.warned.add(whole);
      layer.classList.add("is-final");
      Sound.play("tick");
    }

    if (remaining <= 0) return endRest(true);
    raf = requestAnimationFrame(tick);
  }

  function endRest(rang) {
    if (!live.rest) return;
    cancelAnimationFrame(raf);
    if (rang) Sound.play("rest");
    live.rest = null;
    const layer = root().querySelector("[data-rest-layer]");
    if (layer) {
      layer.classList.add("is-leaving");
      setTimeout(() => layer.remove(), 200);
    }
    advance();
    paint();
  }

  function finish() {
    live.finished = true;
    live.endedAt = Date.now();
    cancelAnimationFrame(raf);
    const layer = root().querySelector("[data-rest-layer]");
    if (layer) layer.remove();

    const trained = live.exercises.filter((e) => e.sets.some((s) => s.done));
    if (!trained.length) {
      close();
      return Toast.show("Nothing completed, so nothing logged");
    }
    const prs = Store.applyRecords(trained, live.endedAt);
    const done = trained.flatMap((e) => e.sets.filter((s) => s.done));

    live.summary = {
      exercises: trained.length,
      sets: done.length,
      reps: done.reduce((t, s) => t + s.reps, 0),
      volume: done.reduce((t, s) => t + s.reps * s.weight, 0),
      duration: live.endedAt - live.startedAt,
      prs,
    };

    Store.logSession({
      name: live.name,
      startedAt: live.startedAt,
      endedAt: live.endedAt,
      durationMs: live.summary.duration,
      exercises: trained,
      stats: live.summary,
      prs,
    });

    Sound.play("done");
    if (prs.length) setTimeout(() => Sound.play("pr"), 700);
    paintSummary();
  }

  function prLabel(p) {
    const meta = EXERCISE_BY_ID[p.exId];
    if (p.kind === "first") return `${Fmt.weight(p.value, meta.unit)} × ${p.reps}`;
    if (p.kind === "weight") return Fmt.weight(p.value, meta.unit);
    return Fmt.reps(p.value, meta.unit);
  }

  function paintSummary() {
    const s = live.summary;
    const stat = (label, value, decimals) =>
      `<div class="done-stat"><dt class="mono">${label}</dt><dd data-count="${value}" data-decimals="${decimals || 0}">0</dd></div>`;

    root().innerHTML = `
      <div class="session-shell done">
        <main class="done-main">
          <p class="done-kicker mono">${esc(live.name)} · ${Fmt.date(live.endedAt)}</p>
          <h1 class="done-title">Workout Complete <span class="done-emoji">🎉</span></h1>

          <dl class="done-stats">
            ${stat("Exercises", s.exercises)}
            ${stat("Sets", s.sets)}
            ${stat("Total reps", s.reps)}
            ${stat(`Volume ${Units.label()}`, Math.round(Units.fromKg(s.volume)))}
            ${stat("Minutes", Math.max(1, Math.round(s.duration / 60000)))}
          </dl>

          ${s.prs.length
            ? `<section class="pr-block">
                <h2 class="section-label mono">Personal records</h2>
                <ul class="pr-list">
                  ${s.prs
                    .map(
                      (p) => `<li class="pr-item">
                        <span class="pr-name">${esc(EXERCISE_BY_ID[p.exId].name)}</span>
                        <span class="pr-value mono">${prLabel(p)}</span>
                        <span class="pr-prev mono">${p.kind === "first" ? "first logged" : p.prev ? `was ${p.prev}` : "new best"}</span>
                      </li>`,
                    )
                    .join("")}
                </ul>
              </section>`
            : `<p class="done-note">No records this time — consistency still counts.</p>`}

          <div class="done-actions">
            <button class="btn btn--primary btn--lg" type="button" data-close-session>Done</button>
            <button class="btn" type="button" data-see-history>View history</button>
          </div>
        </main>
      </div>`;

    root()
      .querySelectorAll("[data-count]")
      .forEach((el, i) =>
        setTimeout(() => countUp(el, +el.dataset.count, { decimals: +el.dataset.decimals }), 90 * i),
      );
  }

  function exit(force) {
    if (!force && !live.finished && doneSets() > 0) {
      return Sheet.open({
        title: "Leave workout",
        body: `<div class="confirm">
          <h2 class="confirm-title">Leave this workout?</h2>
          <p class="confirm-sub">You have finished ${doneSets()} set${doneSets() > 1 ? "s" : ""}. Saving keeps them in your history.</p>
          <div class="confirm-actions">
            <button class="btn btn--primary" type="button" data-confirm-save>Save and finish</button>
            <button class="btn btn--danger" type="button" data-confirm-discard>Discard</button>
            <button class="btn" type="button" data-close>Keep training</button>
          </div>
        </div>`,
        onMount(scope) {
          scope.querySelector("[data-confirm-save]").addEventListener("click", () => {
            Sheet.close();
            finish();
          });
          scope.querySelector("[data-confirm-discard]").addEventListener("click", () => {
            Sheet.close();
            close();
          });
        },
      });
    }
    close();
  }

  function close() {
    cancelAnimationFrame(raf);
    root().classList.remove("is-on");
    root().innerHTML = "";
    document.body.classList.remove("no-scroll");
    live = null;
    App.repaint();
  }

  document.addEventListener("click", (e) => {
    if (!live) return;
    if (e.target.closest("[data-complete]")) return completeSet();
    if (e.target.closest("[data-skip-set]")) {
      if (live.exIndex === live.exercises.length - 1 && live.setIndex === live.exercises[live.exIndex].sets.length - 1)
        return finish();
      advance();
      return paint();
    }
    if (e.target.closest("[data-skip-rest]")) return endRest(false);
    if (e.target.closest("[data-add-rest]")) {
      live.rest.endsAt += 30000;
      live.rest.total += 30;
      live.rest.warned.clear();
      root().querySelector("[data-rest-layer]").classList.remove("is-final");
      return;
    }
    if (e.target.closest("[data-exit]")) return exit(false);
    if (e.target.closest("[data-close-session]")) return close();
    if (e.target.closest("[data-see-history]")) {
      close();
      location.hash = "#/history";
      return;
    }
    if (e.target.closest("[data-sound]")) {
      Sound.setEnabled(!Sound.isEnabled());
      App.syncSoundButtons();
      paint();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!live || Sheet.isOpen()) return;
    if (e.target.matches("input, textarea")) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (live.finished) return;
      if (live.rest) return endRest(false);
      completeSet();
    }
    if (e.key === "Escape" && !live.finished) exit(false);
  });

  // a backgrounded tab freezes rAF; catch up the moment it returns
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && live && live.rest) tick();
  });

  return { start, isLive: () => !!live };
})();
