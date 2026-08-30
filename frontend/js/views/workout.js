const Workout = (() => {
  const RING = 2 * Math.PI * 54;
  const SAVE = "reps.live.v1";
  let live = null;
  let raf = null;

  const root = () => document.getElementById("session");

  // the rest timer holds a Set and a wall-clock deadline, neither of which
  // survives a reload, so it is left behind and you come back between sets
  function remember() {
    if (!live || live.finished) return localStorage.removeItem(SAVE);
    const { rest, ...rest_of } = live;
    try {
      localStorage.setItem(SAVE, JSON.stringify(rest_of));
    } catch {
      // a full disk should never take the workout down
    }
  }

  const forget = () => localStorage.removeItem(SAVE);

  function saved() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE));
      if (!raw || !raw.exercises || !raw.exercises.length) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function resume(snapshot) {
    live = Object.assign({ rest: null, finished: false }, snapshot);
    root().classList.add("is-on");
    document.body.classList.add("no-scroll");
    paint();
  }

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
        note: item.note || "",
        sets: Store.setsOf(item).map((row) => ({
          reps: row.reps,
          weight: row.weight,
          type: row.type || "normal",
          done: false,
        })),
      })),
    };
    root().classList.add("is-on");
    document.body.classList.add("no-scroll");
    Sound.play("begin");
    Haptics.fire("tap");
    remember();
    paint();
  }

  const totalSets = () => live.exercises.reduce((t, e) => t + e.sets.length, 0);
  const doneSets = () =>
    live.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);

  function current() {
    const exercise = live.exercises[live.exIndex];
    const set = exercise.sets[live.setIndex] || exercise.sets[exercise.sets.length - 1];
    return { exercise, set, meta: EXERCISE_BY_ID[exercise.exId] };
  }

  function upNext() {
    const rows = [];
    for (let e = live.exIndex; e < live.exercises.length && rows.length < 3; e++) {
      const from = e === live.exIndex ? live.setIndex + 1 : 0;
      const ex = live.exercises[e];
      const left = ex.sets.length - from;
      if (left <= 0) continue;
      rows.push({
        name: EXERCISE_BY_ID[ex.exId].name,
        detail: `${left} set${left > 1 ? "s" : ""} left`,
      });
    }
    return rows;
  }

  // shown only on the first working set, where changing the load still makes sense
  function suggestionBlock(meta, set) {
    if (set.done || SetTypes.of(set).key === "warmup") return "";
    const earlier = live.exercises[live.exIndex].sets
      .slice(0, live.setIndex)
      .some((s) => s.done && SetTypes.counts(s));
    if (earlier) return "";

    const tip = Coach.suggest(meta.id, { reps: set.reps });
    if (!tip) return "";
    if (Math.abs(tip.weight - set.weight) < 0.01 && tip.reps === set.reps) return "";

    return `
      <div class="suggest" data-suggest>
        <div class="suggest-line">
          <span class="mono suggest-now">${Fmt.weight(tip.weight, meta.unit)} × ${tip.reps}</span>
        </div>
        <p class="suggest-why">${esc(tip.why)}</p>
        <button class="btn btn--sm" type="button" data-use-suggestion
                data-w="${tip.weight}" data-r="${tip.reps}">Use this</button>
      </div>`;
  }

  function paint() {
    if (live.finished) return paintSummary();
    const { exercise, set, meta } = current();
    const s = stepsFor(meta);
    const type = SetTypes.of(set);
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

          <div class="session-art">${Art.render(meta.id, "is-playing")}</div>

          ${WorkoutSets.previousBlock(meta.id, meta.unit)}

          ${WorkoutSets.rail(exercise, live.setIndex)}

          <button class="set-type-btn mono" type="button" data-set-type>
            ${SetTypes.counts(set)
              ? `Set ${WorkoutSets.workingNumber(exercise, live.setIndex)} · ${type.name}`
              : type.name}
          </button>

          ${suggestionBlock(meta, set)}

          <div class="session-config" data-config>
            ${Stepper.markup({ name: "reps", value: set.reps, min: s.repsMin, max: s.repsMax, step: s.repsStep, label: s.repsLabel, wide: true })}
            ${Stepper.markup({ name: "weight", value: Units.fromKg(set.weight), min: 0, max: s.weightMax, step: s.weightStep, label: s.weightLabel, suffix: ` ${Units.label()}`, wide: true })}
          </div>

          ${Plates.usesBar(meta) ? `<div class="session-bar-load" data-bar>${Plates.strip(set.weight)}</div>` : ""}

          <button class="btn btn--primary btn--xl" type="button" data-complete>
            ${Icons.get("check")} ${set.done ? "Set banked" : "Complete Set"}
          </button>

          <div class="session-tools">
            <button class="tool-btn mono" type="button" data-notes>${exercise.note ? "Note ✓" : "Note"}</button>
            <button class="tool-btn mono" type="button" data-warmup>Warm-up</button>
            <button class="tool-btn mono" type="button" data-replace>Replace</button>
            <button class="tool-btn mono" type="button" data-skip-exercise>Skip exercise</button>
          </div>

          ${exercise.note ? `<p class="session-note">${esc(exercise.note)}</p>` : ""}

          <button class="link-btn mono" type="button" data-skip-set>Skip this set</button>

          ${upNext().length
            ? `<section class="up-next">
                <h2 class="section-label mono">Up next</h2>
                <ul>${upNext().map((r) => `<li><span>${esc(r.name)}</span><span class="mono">${r.detail}</span></li>`).join("")}</ul>
              </section>`
            : ""}
        </main>
      </div>`;

    Art.scan(root());
    const config = root().querySelector("[data-config]");
    config.addEventListener("stepper", (e) => {
      const { exercise: ex, set: active } = current();
      const value = e.detail.name === "weight" ? Units.toKg(e.detail.value) : e.detail.value;
      active[e.detail.name] = value;
      ex.sets.forEach((x, i) => {
        if (i > live.setIndex && !x.done && SetTypes.counts(x)) x[e.detail.name] = value;
      });
      const bar = root().querySelector("[data-bar]");
      if (bar && e.detail.name === "weight") bar.innerHTML = Plates.strip(value);
      remember();
    });
  }

  function checkRecord(exId, set) {
    if (!SetTypes.counts(set)) return null;
    const rec = Store.state.records[exId];
    if (!rec) return null;
    if (set.weight > 0 && set.weight > rec.bestWeight) return { kind: "weight", value: set.weight };
    if (set.reps > rec.bestReps) return { kind: "reps", value: set.reps };
    return null;
  }

  function flashRecord(meta, hit) {
    const el = root().querySelector(".session-main");
    if (!el) return;
    const label = hit.kind === "weight" ? Fmt.weight(hit.value, meta.unit) : `${hit.value} reps`;
    el.insertAdjacentHTML(
      "beforeend",
      `<div class="pr-flash" role="status"><span class="pr-flash-tag mono">Personal record</span><span class="pr-flash-val">${label}</span></div>`,
    );
    Sound.play("pr");
    Haptics.fire("pr");
    setTimeout(() => {
      const f = root().querySelector(".pr-flash");
      if (f) f.remove();
    }, 2200);
  }

  function completeSet() {
    const { exercise, set, meta } = current();
    if (set.done) return;
    const hit = checkRecord(exercise.exId, set);
    set.done = true;
    set.at = Date.now();
    Sound.play("set");
    Haptics.fire("set");
    if (hit) flashRecord(meta, hit);

    const card = root().querySelector(".session-main");
    if (card) {
      card.classList.add("is-banked");
      setTimeout(() => card.classList.remove("is-banked"), 320);
    }

    // the header sits behind the rest overlay, so nudge it now
    root().querySelector(".session-count").textContent = `${doneSets()} / ${totalSets()} sets`;
    root().querySelector(".session-progress span").style.width = `${(doneSets() / totalSets()) * 100}%`;
    remember();

    if (!nextUndone()) return setTimeout(finish, 260);

    const lastOfExercise = live.setIndex === exercise.sets.length - 1;
    if (lastOfExercise && live.exIndex < live.exercises.length - 1) {
      Sound.play("exercise");
    }

    const rest = SetTypes.restsAfter(set) ? exercise.rest : 0;
    if (rest > 0 && Store.state.settings.autoRest !== false) {
      setTimeout(() => startRest(rest), 240);
    } else {
      setTimeout(() => {
        advance();
        paint();
      }, 240);
    }
  }

  function nextUndone() {
    for (let e = live.exIndex; e < live.exercises.length; e++) {
      const from = e === live.exIndex ? live.setIndex : 0;
      for (let i = from; i < live.exercises[e].sets.length; i++) {
        if (!live.exercises[e].sets[i].done) return { e, i };
      }
    }
    return null;
  }

  function advance() {
    const spot = nextUndone();
    if (!spot) return;
    live.exIndex = spot.e;
    live.setIndex = spot.i;
  }

  function addSet() {
    const { exercise, set } = current();
    const copy = {
      reps: set.reps,
      weight: set.weight,
      type: SetTypes.counts(set) ? set.type || "normal" : "normal",
      done: false,
    };
    exercise.sets.push(copy);
    live.setIndex = exercise.sets.length - 1;
    Sound.play("tap");
    remember();
    paint();
  }

  function removeSet(index) {
    const { exercise } = current();
    if (exercise.sets.length <= 1) return Toast.show("An exercise needs at least one set");
    exercise.sets.splice(index, 1);
    if (live.setIndex >= exercise.sets.length) live.setIndex = exercise.sets.length - 1;
    Sound.play("remove");
    remember();
    paint();
    Toast.show("Set removed");
  }

  function usePrevious() {
    const { exercise, meta } = current();
    const last = Store.lastSetsFor(meta.id);
    if (!last) return Toast.show("No earlier session to copy");

    const working = last.sets.filter(SetTypes.counts);
    if (!working.length) return Toast.show("Nothing worth copying from last time");

    const kept = exercise.sets.filter((s) => s.done);
    exercise.sets = kept.concat(
      working.map((s) => ({ reps: s.reps, weight: s.weight, type: "normal", done: false })),
    );
    live.setIndex = kept.length;
    Sound.play("tap");
    remember();
    paint();
    Toast.show(`Copied ${working.length} sets from last time`);
  }

  function applyWarmup(plan) {
    const { exercise } = current();
    const done = exercise.sets.filter((s) => s.done);
    const pending = exercise.sets.filter((s) => !s.done);
    exercise.sets = done.concat(plan, pending);
    live.setIndex = done.length;
    Sound.play("tap");
    remember();
    paint();
    Toast.show("Warm-up added");
  }

  function editNote() {
    const { exercise, meta } = current();
    Sheet.open({
      title: "Exercise note",
      body: `<div class="note-edit">
        <p class="sheet-lede">${esc(meta.name)} — cues, settings, anything worth remembering next time.</p>
        <textarea class="note-field" rows="4" data-note-field
                  placeholder="Seat at 4, elbows tucked…">${esc(exercise.note || "")}</textarea>
        <button class="btn btn--primary btn--lg" type="button" data-save-note>Save note</button>
      </div>`,
      onMount(scope) {
        const field = scope.querySelector("[data-note-field]");
        field.focus();
        scope.querySelector("[data-save-note]").addEventListener("click", () => {
          exercise.note = field.value.trim();
          Sheet.close();
          remember();
          paint();
        });
      },
    });
  }

  function replaceExercise() {
    const { exercise, meta } = current();
    const taken = live.exercises.map((e) => e.exId);
    const options = Coach.alternatives(meta.id, { exclude: taken });
    if (!options.length) return Toast.show("No close alternative available");

    Sheet.open({
      title: "Replace exercise",
      body: `<div class="swap-list">
        <p class="sheet-lede">Same muscles, different tool. Your finished sets stay on ${esc(meta.name)}.</p>
        ${options
          .map(
            (alt) => `<button class="swap-option" type="button" data-swap="${alt.id}">
              <span class="swap-art">${Art.render(alt.id)}</span>
              <span class="swap-copy">
                <strong>${esc(alt.name)}</strong>
                <span class="mono">${alt.equipment} · ${alt.primary.map((m) => MUSCLES[m]).join(", ")}</span>
              </span>
            </button>`,
          )
          .join("")}
      </div>`,
      onMount(scope) {
        Art.scan(scope);
        scope.querySelectorAll("[data-swap]").forEach((btn) =>
          btn.addEventListener("click", () => {
            Sheet.close();
            swapTo(btn.dataset.swap);
          }),
        );
      },
    });
  }

  function swapTo(exId) {
    const { exercise } = current();
    const done = exercise.sets.filter((s) => s.done);

    if (done.length) {
      // finished work belongs to the lift it was done on, so it stays behind
      live.exercises.splice(live.exIndex, 1, { ...exercise, sets: done }, {
        exId,
        rest: exercise.rest,
        note: "",
        sets: exercise.sets
          .filter((s) => !s.done)
          .map((s) => ({ reps: s.reps, weight: s.weight, type: s.type || "normal", done: false })),
      });
      live.exIndex++;
      live.setIndex = 0;
    } else {
      exercise.exId = exId;
      exercise.note = "";
      live.setIndex = 0;
    }

    Sound.play("tap");
    remember();
    paint();
    Toast.show(`Swapped to ${EXERCISE_BY_ID[exId].name}`);
  }

  function skipExercise() {
    const exercise = live.exercises[live.exIndex];
    exercise.sets.forEach((s) => {
      if (!s.done) s.skipped = true;
    });
    exercise.sets = exercise.sets.filter((s) => s.done);

    if (!exercise.sets.length) live.exercises.splice(live.exIndex, 1);
    else live.exIndex++;

    if (live.exIndex >= live.exercises.length || !nextUndone()) return finish();
    live.setIndex = 0;
    advance();
    remember();
    paint();
    Toast.show("Exercise skipped");
  }

  function startRest(seconds) {
    live.rest = {
      total: seconds,
      endsAt: Date.now() + seconds * 1000,
      warned: new Set(),
      pausedAt: null,
    };
    const spot = nextUndone();
    const next = spot ? EXERCISE_BY_ID[live.exercises[spot.e].exId].name : "";

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
          <button class="btn" type="button" data-pause-rest>Pause</button>
          <button class="btn btn--primary" type="button" data-skip-rest>${Icons.get("skip")} Skip</button>
        </div>
        <button class="link-btn mono" type="button" data-custom-rest>Change rest for this exercise</button>
      </div>`,
    );
    tick();
  }

  function tick() {
    cancelAnimationFrame(raf);
    const layer = root().querySelector("[data-rest-layer]");
    if (!layer || !live.rest) return;
    if (live.rest.pausedAt) return;

    const remaining = (live.rest.endsAt - Date.now()) / 1000;
    const clock = layer.querySelector("[data-clock]");
    const ring = layer.querySelector(".ring-fill");
    clock.textContent = Fmt.clock(Math.max(0, remaining));
    ring.style.strokeDashoffset = String(RING * (1 - Math.max(0, remaining) / live.rest.total));

    const whole = Math.ceil(remaining);
    if (whole <= 3 && whole > 0 && !live.rest.warned.has(whole)) {
      live.rest.warned.add(whole);
      layer.classList.add("is-final");
      Sound.play("countdown", whole);
      Haptics.fire("tick");
    }

    if (remaining <= 0) return endRest(true);
    raf = requestAnimationFrame(tick);
  }

  function togglePause() {
    if (!live.rest) return;
    const layer = root().querySelector("[data-rest-layer]");
    const btn = layer && layer.querySelector("[data-pause-rest]");

    if (live.rest.pausedAt) {
      live.rest.endsAt += Date.now() - live.rest.pausedAt;
      live.rest.pausedAt = null;
      if (layer) layer.classList.remove("is-paused");
      if (btn) btn.textContent = "Pause";
      tick();
    } else {
      live.rest.pausedAt = Date.now();
      cancelAnimationFrame(raf);
      if (layer) layer.classList.add("is-paused");
      if (btn) btn.textContent = "Resume";
    }
    Sound.play("tap");
  }

  function customRest() {
    const exercise = live.exercises[live.exIndex];
    RestPicker.open(exercise.rest, (seconds) => {
      exercise.rest = seconds;
      if (live.rest) {
        live.rest.total = seconds;
        live.rest.endsAt = Date.now() + seconds * 1000;
        live.rest.warned.clear();
        const layer = root().querySelector("[data-rest-layer]");
        if (layer) layer.classList.remove("is-final");
        tick();
      }
      remember();
      Toast.show(`Rest set to ${Fmt.clock(seconds)}`);
    });
  }

  function endRest(rang) {
    if (!live.rest) return;
    cancelAnimationFrame(raf);
    if (rang) {
      Sound.play("rest");
      Haptics.fire("rest");
    }
    live.rest = null;
    const layer = root().querySelector("[data-rest-layer]");
    if (layer) {
      layer.classList.add("is-leaving");
      setTimeout(() => layer.remove(), 200);
    }
    advance();
    remember();
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
    const working = done.filter(SetTypes.counts);

    live.summary = {
      exercises: trained.length,
      sets: done.length,
      working: working.length,
      reps: working.reduce((t, s) => t + s.reps, 0),
      volume: working.reduce((t, s) => t + s.reps * s.weight, 0),
      duration: live.endedAt - live.startedAt,
      prs,
      gains: improvements(trained),
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

    forget();
    Sound.play("done");
    Haptics.fire("done");
    if (prs.length) setTimeout(() => Sound.play("pr"), 700);
    paintSummary();
  }

  // volume beaten on a lift you have done before is worth saying out loud, even
  // when no single set was a record
  function improvements(trained) {
    const out = [];
    trained.forEach((entry) => {
      const now = Metrics.volumeOf(entry.sets.filter(SetTypes.counts));
      if (!now) return;
      const past = Store.state.history.find((s) =>
        s.exercises.some((e) => e.exId === entry.exId),
      );
      if (!past) return;
      const before = Metrics.volumeOf(
        past.exercises.find((e) => e.exId === entry.exId).sets.filter(SetTypes.counts),
      );
      if (before && now > before * 1.02) {
        out.push({
          exId: entry.exId,
          pct: Math.round(((now - before) / before) * 100),
        });
      }
    });
    return out.sort((a, b) => b.pct - a.pct).slice(0, 3);
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
          <h1 class="done-title">Workout complete</h1>

          <dl class="done-stats">
            ${stat("Minutes", Math.max(1, Math.round(s.duration / 60000)))}
            ${stat(`Volume ${Units.label()}`, Math.round(Units.fromKg(s.volume)))}
            ${stat("Working sets", s.working)}
            ${stat("Exercises", s.exercises)}
            ${stat("Total reps", s.reps)}
          </dl>

          ${s.prs.length
            ? `<section class="pr-block is-celebrating">
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
            : ""}

          ${s.gains.length
            ? `<section class="gain-block">
                <h2 class="section-label mono">More than last time</h2>
                <ul class="gain-list">
                  ${s.gains
                    .map(
                      (g) => `<li><span>${esc(EXERCISE_BY_ID[g.exId].name)}</span><span class="mono">+${g.pct}% volume</span></li>`,
                    )
                    .join("")}
                </ul>
              </section>`
            : ""}

          ${!s.prs.length && !s.gains.length
            ? `<p class="done-note">No records this time — consistency still counts.</p>`
            : ""}

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
    forget();
    root().classList.remove("is-on");
    root().innerHTML = "";
    document.body.classList.remove("no-scroll");
    live = null;
    App.repaint();
  }

  document.addEventListener("click", (e) => {
    if (!live) return;

    const use = e.target.closest("[data-use-suggestion]");
    if (use) {
      const { exercise } = current();
      const w = +use.dataset.w;
      const r = +use.dataset.r;
      exercise.sets.forEach((x, i) => {
        if (i >= live.setIndex && !x.done && SetTypes.counts(x)) {
          x.weight = w;
          x.reps = r;
        }
      });
      Sound.play("tap");
      remember();
      paint();
      return Toast.show("Applied to the remaining sets");
    }

    const jump = e.target.closest("[data-jump-set]");
    if (jump) {
      live.setIndex = +jump.dataset.jumpSet;
      Sound.play("tap");
      return paint();
    }

    if (e.target.closest("[data-add-set]")) return addSet();
    if (e.target.closest("[data-use-previous]")) return usePrevious();
    if (e.target.closest("[data-notes]")) return editNote();
    if (e.target.closest("[data-replace]")) return replaceExercise();
    if (e.target.closest("[data-skip-exercise]")) return skipExercise();
    if (e.target.closest("[data-custom-rest]")) return customRest();
    if (e.target.closest("[data-pause-rest]")) return togglePause();

    if (e.target.closest("[data-warmup]")) {
      const { exercise, meta } = current();
      return WorkoutSets.offerWarmup(exercise, meta, applyWarmup);
    }

    if (e.target.closest("[data-set-type]")) {
      return WorkoutSets.typeSheet((type) => {
        const { set } = current();
        set.type = type;
        remember();
        paint();
      });
    }

    if (e.target.closest("[data-complete]")) return completeSet();

    if (e.target.closest("[data-skip-set]")) {
      const { exercise } = current();
      if (exercise.sets.length > 1) return removeSet(live.setIndex);
      if (!nextUndone()) return finish();
      advance();
      return paint();
    }

    if (e.target.closest("[data-skip-rest]")) return endRest(false);
    if (e.target.closest("[data-add-rest]")) {
      live.rest.endsAt += 30000;
      live.rest.total += 30;
      live.rest.warned.clear();
      root().querySelector("[data-rest-layer]").classList.remove("is-final");
      Sound.play("tap");
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

  return { start, resume, saved, forget, isLive: () => !!live };
})();
