const HomeView = (() => {
  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  const LINES = [
    "Show up and the rest sorts itself out.",
    "The set you do not feel like doing is usually the one that counts.",
    "Small jumps, kept up, beat big jumps abandoned.",
    "Form first. The weight will follow.",
    "You do not have to be fresh. You have to start.",
    "Log it honestly and the numbers will tell you the truth.",
    "Rest is part of the programme, not a break from it.",
  ];

  // fixed for the day, so a repaint does not shuffle the words under you
  function line() {
    const day = Math.floor(Date.now() / 86400000);
    return LINES[day % LINES.length];
  }

  function week() {
    const today = new Date();
    const cells = [];
    for (let back = 6; back >= 0; back--) {
      const d = new Date(today);
      d.setDate(today.getDate() - back);
      const key = Store.dayKey(d.getTime());
      const trained = Store.sessionsOn(key).length > 0;
      const planned = !!Store.plannedOn(key);
      cells.push(`<div class="wk-cell${trained ? " is-done" : planned ? " is-planned" : ""}${back === 0 ? " is-today" : ""}">
        <span class="mono wk-day">${"SMTWTFS"[d.getDay()]}</span>
        <span class="wk-dot"></span>
      </div>`);
    }
    return `<section class="block week-strip">
      <h2 class="section-head"><span>This week</span><a class="link-btn mono" href="#/plan">Plan</a></h2>
      <div class="wk-row">${cells.join("")}</div>
    </section>`;
  }

  function recoveryPreview() {
    if (!Store.state.history.length) return "";
    const needy = Recovery.neediest(3).filter((m) => m.ready < 0.95);
    return `<section class="block">
      <h2 class="section-head"><span>Recovery</span><a class="link-btn mono" href="#/progress">Detail</a></h2>
      <div class="rec-preview">
        ${RecoveryMap.render("is-compact")}
        <div class="rec-copy">
          ${needy.length
            ? `<ul class="rec-list mono">${needy
                .map((m) => `<li><span>${m.name}</span><span>${Recovery.label(m.ready)}</span></li>`)
                .join("")}</ul>`
            : `<p class="rec-fresh mono">Everything is fresh. Good day to go hard.</p>`}
          <p class="rec-note">A training estimate from recent volume, not medical advice.</p>
        </div>
      </div>
    </section>`;
  }

  function readyLine(items) {
    if (!items.length || !Store.state.history.length) return "";
    const ready = Recovery.forWorkout(items);
    const text =
      ready > 0.85
        ? "Everything this hits is fresh."
        : ready > 0.55
          ? "Mostly recovered — expect a solid session."
          : "Some of this is still recovering. Go by feel.";
    return `<p class="ready-line mono">${text}</p>`;
  }

  function estimate(items) {
    return Fmt.duration(draftTotals(items).duration);
  }

  function muscles(items) {
    const seen = [];
    items.forEach((i) => {
      const g = EXERCISE_BY_ID[i.exId].group;
      if (!seen.includes(g)) seen.push(g);
    });
    return seen.slice(0, 3).join(" · ");
  }

  // an unfinished session outranks anything else on the page
  function resumeCard() {
    const snap = Workout.saved();
    if (!snap) return "";
    const done = snap.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);
    const total = snap.exercises.reduce((t, e) => t + e.sets.length, 0);

    return `
      <section class="hero-card is-live">
        <p class="card-kicker mono">Workout in progress</p>
        <h2 class="hero-card-title">${esc(snap.name)}</h2>
        <p class="hero-card-meta mono">${done} of ${total} sets completed</p>
        <div class="bar"><span style="width:${total ? (done / total) * 100 : 0}%"></span></div>
        <div class="hero-card-actions">
          <button class="btn btn--primary" type="button" data-resume-home>${Icons.get("play")} Continue</button>
          <button class="btn" type="button" data-discard-home>Discard</button>
        </div>
      </section>`;
  }

  function todayCard() {
    if (Workout.saved()) return "";
    const key = Store.dayKey(Date.now());
    const planned = Store.plannedOn(key);
    const draft = Store.state.draft;

    if (planned) {
      const [kind, id] = planned.ref.split(":");
      const day = kind === "d" ? DAY_PLANS[id] : null;
      const items = day ? day.exercises : (Store.state.workouts.find((w) => w.id === id) || {}).items || [];
      const asDraft = day
        ? Coach.adaptDay(id, Store.state.profile).exercises.map((x) =>
            Object.assign({ exId: x.id }, Store.config(x.id)),
          )
        : items;

      return `
        <section class="hero-card">
          <p class="card-kicker mono">Today</p>
          <h2 class="hero-card-title">${esc(planned.name)}</h2>
          <p class="hero-card-meta mono">${day ? day.focus : muscles(asDraft)}</p>
          ${readyLine(asDraft)}
          <dl class="mini-stats mono">
            <div><dt>Exercises</dt><dd>${asDraft.length}</dd></div>
            <div><dt>Sets</dt><dd>${draftTotals(asDraft).sets}</dd></div>
            <div><dt>Time</dt><dd>~${estimate(asDraft)}</dd></div>
          </dl>
          <div class="hero-card-actions">
            <button class="btn btn--primary btn--lg" type="button" data-start-planned="${key}">${Icons.get("play")} Start workout</button>
            <a class="btn" href="#/plan">View plan</a>
          </div>
        </section>`;
    }

    if (draft.items.length) {
      return `
        <section class="hero-card">
          <p class="card-kicker mono">Ready to go</p>
          <h2 class="hero-card-title">${esc(draft.name || "Untitled workout")}</h2>
          <p class="hero-card-meta mono">${muscles(draft.items)}</p>
          ${readyLine(draft.items)}
          <dl class="mini-stats mono">
            <div><dt>Exercises</dt><dd>${draft.items.length}</dd></div>
            <div><dt>Sets</dt><dd>${draftTotals(draft.items).sets}</dd></div>
            <div><dt>Time</dt><dd>~${estimate(draft.items)}</dd></div>
          </dl>
          <div class="hero-card-actions">
            <button class="btn btn--primary btn--lg" type="button" data-start-draft>${Icons.get("play")} Start workout</button>
            <a class="btn" href="#/build">Edit</a>
          </div>
        </section>`;
    }

    return `
      <section class="hero-card is-empty">
        <p class="card-kicker mono">Today</p>
        <h2 class="hero-card-title">Nothing planned</h2>
        <p class="hero-card-meta mono">Build a workout, or let REPS suggest a split that fits your week.</p>
        <div class="hero-card-actions">
          <a class="btn btn--primary btn--lg" href="#/build">${Icons.get("build")} Build workout</a>
          <a class="btn" href="#/you">Find my plan</a>
        </div>
      </section>`;
  }

  function stats() {
    const week = Store.sessionsThisWeek();
    const streak = Store.weekStreak();
    const history = Store.state.history;
    const volume = history.slice(0, 7).reduce((t, h) => t + h.stats.volume, 0);
    const minutes = Math.round(history.slice(0, 7).reduce((t, h) => t + h.stats.duration, 0) / 60000);

    return `
      <dl class="stat-strip mono">
        <div><dt>This week</dt><dd>${week}</dd></div>
        <div><dt>Streak</dt><dd>${streak} wk</dd></div>
        <div><dt>Recent volume</dt><dd>${volume ? Fmt.volume(volume) : "—"}</dd></div>
        <div><dt>Time trained</dt><dd>${minutes ? Fmt.duration(minutes * 60000) : "—"}</dd></div>
      </dl>`;
  }

  function render() {
    const { history, workouts, recent } = Store.state;
    const last = history[0];

    return `
      <header class="home-head">
        <p class="home-greet mono">${greeting()} · ${Fmt.date(Date.now())}</p>
        <h1 class="home-title">Ready to train?</h1>
        <p class="home-line">${line()}</p>
      </header>

      ${resumeCard()}
      ${todayCard()}
      ${stats()}
      ${week()}

      ${workouts.length
        ? `<section class="block">
            <h2 class="section-head"><span>Your workouts</span><a class="link-btn mono" href="#/build">Manage</a></h2>
            <div class="quick-grid">
              ${workouts.slice(0, 4).map((w) => `
                <button class="quick-card" type="button" data-quick="${w.id}">
                  <span class="quick-name">${esc(w.name)}</span>
                  <span class="quick-meta mono">${w.items.length} exercises</span>
                  <span class="quick-go mono">${Icons.get("play")} Start</span>
                </button>`).join("")}
            </div>
          </section>`
        : ""}

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

      ${recoveryPreview()}

      ${recent.length
        ? `<section class="block">
            <h2 class="section-head"><span>Recently used</span><a class="link-btn mono" href="#/library">Library</a></h2>
            <div class="ex-grid">${recent.slice(0, 4).map((id) => EXERCISE_BY_ID[id]).filter(Boolean).map((e, i) => exerciseCard(e, i)).join("")}</div>
          </section>`
        : ""}`;
  }

  function startPlanned(key) {
    const plan = Store.plannedOn(key);
    if (!plan) return;
    const [kind, id] = plan.ref.split(":");
    if (kind === "w") Store.loadWorkout(id);
    else {
      const day = DAY_PLANS[id];
      if (!day) return;
      Store.clearDraft();
      Store.setDraftName(day.name);
      Coach.adaptDay(id, Store.state.profile).exercises.forEach((x) => Store.addToDraft(x.id));
    }
    Workout.start(Store.state.draft);
  }

  function mount(root) {
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-resume-home]")) {
        const snap = Workout.saved();
        if (snap) Workout.resume(snap);
        return;
      }
      if (e.target.closest("[data-discard-home]")) {
        Workout.forget();
        Sound.play("remove");
        return App.repaint();
      }

      const planned = e.target.closest("[data-start-planned]");
      if (planned) return startPlanned(planned.dataset.startPlanned);

      if (e.target.closest("[data-start-draft]")) {
        if (Store.state.draft.items.length) return Workout.start(Store.state.draft);
        return (location.hash = "#/build");
      }

      const quick = e.target.closest("[data-quick]");
      if (quick) {
        Store.loadWorkout(quick.dataset.quick);
        return Workout.start(Store.state.draft);
      }

      const session = e.target.closest("[data-session]");
      if (session) HistoryView.openSession(session.dataset.session);
    });
  }

  return { render, mount };
})();
