const HistoryView = (() => {
  function sessionCard(s) {
    return `
      <article class="hist-card" data-session="${s.id}" tabindex="0" role="button">
        <div class="hist-top">
          <div>
            <p class="hist-date mono">${Fmt.date(s.endedAt)} · ${Fmt.relative(s.endedAt)}</p>
            <h3 class="hist-name">${esc(s.name)}</h3>
          </div>
          ${s.prs && s.prs.length ? `<span class="pr-badge mono">${Icons.get("flame")} ${s.prs.length} PR</span>` : ""}
        </div>
        <dl class="hist-stats mono">
          <div><dt>Exercises</dt><dd>${s.stats.exercises}</dd></div>
          <div><dt>Sets</dt><dd>${s.stats.sets}</dd></div>
          <div><dt>Reps</dt><dd>${s.stats.reps}</dd></div>
          <div><dt>Volume</dt><dd>${Fmt.volume(s.stats.volume)}</dd></div>
          <div><dt>Time</dt><dd>${Fmt.duration(s.stats.duration)}</dd></div>
        </dl>
      </article>`;
  }

  function openSession(id) {
    const s = Store.state.history.find((x) => x.id === id);
    if (!s) return;
    Sheet.open({
      title: s.name,
      size: "sheet-panel--wide",
      body: `
        <header class="detail-head">
          <div>
            <h2 class="detail-title">${esc(s.name)}</h2>
            <p class="detail-meta mono">${Fmt.date(s.endedAt)} · ${Fmt.duration(s.stats.duration)} · ${Fmt.volume(s.stats.volume)}</p>
          </div>
        </header>
        <ol class="log-list">
          ${s.exercises
            .map((ex) => {
              const meta = EXERCISE_BY_ID[ex.exId];
              const done = ex.sets.filter((x) => x.done);
              return `<li class="log-item">
                <div class="log-head">
                  <span class="log-name">${esc(meta.name)}</span>
                  <span class="log-meta mono">${done.length} set${done.length > 1 ? "s" : ""}</span>
                </div>
                <ul class="log-sets mono">
                  ${ex.sets
                    .map(
                      (x, i) =>
                        `<li class="${x.done ? "" : "is-skipped"}"><span class="log-n">${i + 1}</span> ${x.reps}${meta.unit === "sec" ? "s" : ""} × ${Fmt.weight(x.weight, meta.unit)}${x.done ? "" : " · skipped"}</li>`,
                    )
                    .join("")}
                </ul>
              </li>`;
            })
            .join("")}
        </ol>
        <div class="sheet-foot">
          <button class="btn" type="button" data-repeat="${s.id}">${Icons.get("copy")} Repeat this workout</button>
          <button class="btn btn--danger" type="button" data-delete-session="${s.id}">${Icons.get("trash")} Delete</button>
        </div>`,
      onMount(scope) {
        scope.querySelector("[data-repeat]").addEventListener("click", () => {
          Store.clearDraft();
          Store.setDraftName(s.name);
          s.exercises.forEach((ex) => {
            const top = ex.sets[0] || {};
            Store.addToDraft(ex.exId, {
              sets: ex.sets.length,
              reps: top.reps,
              weight: top.weight,
            });
          });
          Sheet.close();
          Sound.play("set");
          location.hash = "#/build";
        });
        scope.querySelector("[data-delete-session]").addEventListener("click", () => {
          Store.deleteSession(s.id);
          Sheet.close();
          Sound.play("remove");
          App.repaint();
          Toast.show("Workout deleted from history");
        });
      },
    });
  }

  function render() {
    const history = Store.state.history;
    if (!history.length)
      return `
        <div class="view-head"><div>
          <h1 class="view-title">History</h1>
          <p class="view-sub">Every finished workout lands here.</p>
        </div></div>
        <div class="empty">
          <p class="empty-title">No workouts logged yet</p>
          <p class="empty-sub">Finish a session and it will show up here with the full set-by-set breakdown.</p>
          <a class="btn btn--primary" href="#/build">${Icons.get("play")} Build a workout</a>
        </div>`;

    const totals = history.reduce(
      (t, s) => ({
        sets: t.sets + s.stats.sets,
        volume: t.volume + s.stats.volume,
        minutes: t.minutes + s.stats.duration / 60000,
      }),
      { sets: 0, volume: 0, minutes: 0 },
    );

    return `
      <div class="view-head"><div>
        <h1 class="view-title">History</h1>
        <p class="view-sub">${history.length} workout${history.length > 1 ? "s" : ""} logged.</p>
      </div></div>

      <dl class="summary-strip mono">
        <div><dt>Workouts</dt><dd>${history.length}</dd></div>
        <div><dt>Sets</dt><dd>${totals.sets}</dd></div>
        <div><dt>Volume</dt><dd>${Fmt.volume(totals.volume)}</dd></div>
        <div><dt>Time</dt><dd>${Fmt.duration(totals.minutes * 60000)}</dd></div>
      </dl>

      <div class="hist-list">${history.map(sessionCard).join("")}</div>`;
  }

  function mount(root) {
    root.addEventListener("click", (e) => {
      const card = e.target.closest("[data-session]");
      if (card) openSession(card.dataset.session);
    });
    root.addEventListener("keydown", (e) => {
      const card = e.target.closest("[data-session]");
      if (card && (e.key === "Enter" || e.code === "Space")) {
        e.preventDefault();
        openSession(card.dataset.session);
      }
    });
  }

  return { render, mount, openSession };
})();

const ProgressView = (() => {
  function row(exId) {
    const meta = EXERCISE_BY_ID[exId];
    const rec = Store.state.records[exId];
    const points = Store.historyFor(exId);
    const latest = points[points.length - 1];
    const prior = points.length > 1 ? points[points.length - 2] : null;
    const delta = prior ? latest.weight - prior.weight : 0;
    const volume = points.reduce((t, p) => t + p.volume, 0);
    const peak = Math.max(...points.map((p) => p.e1rm || 0));

    return `
      <article class="prog-row" data-ex="${exId}" tabindex="0" role="button">
        <div class="prog-main">
          <h3 class="prog-name">${esc(meta.name)}</h3>
          <p class="prog-meta mono">${meta.group} · ${points.length} session${points.length > 1 ? "s" : ""}</p>
        </div>

        <div class="prog-compare mono">
          ${prior
            ? `<span class="prog-prev">${Fmt.weight(prior.weight, meta.unit)} × ${prior.reps}</span>
               <span class="prog-arrow">${Icons.get("forward")}</span>`
            : ""}
          <span class="prog-now">${Fmt.weight(latest.weight, meta.unit)} × ${latest.reps}</span>
          ${delta > 0 ? `<span class="prog-delta is-up">+${Units.fromKg(delta)}</span>` : ""}
          ${latest.weight >= (rec ? rec.bestWeight : 0) && points.length > 1 && delta > 0 ? `<span class="pr-badge mono">PR</span>` : ""}
        </div>

        <div class="prog-spark">${Charts.spark(points)}</div>

        <dl class="prog-best mono">
          <div><dt>Best</dt><dd>${rec && rec.bestWeight ? Fmt.weight(rec.bestWeight, meta.unit) : "—"}</dd></div>
          <div><dt>Top ${meta.unit === "sec" ? "hold" : "reps"}</dt><dd>${rec ? rec.bestReps : "—"}</dd></div>
          ${peak && meta.unit !== "sec" && meta.equipment !== "Bodyweight"
            ? `<div><dt>Est. 1RM</dt><dd>${Fmt.weight(peak, meta.unit)}</dd></div>`
            : ""}
          <div><dt>Volume</dt><dd>${Fmt.volume(volume)}</dd></div>
        </dl>
      </article>`;
  }

  function lifetime() {
    const h = Store.state.history;
    const totals = h.reduce(
      (t, s) => {
        const st = Metrics.sessionStats(s);
        t.volume += st.volume;
        t.sets += st.sets;
        t.minutes += st.minutes;
        return t;
      },
      { volume: 0, sets: 0, minutes: 0 },
    );

    const cell = (label, value) =>
      `<div><dt>${label}</dt><dd>${value}</dd></div>`;

    return `<dl class="totals mono">
      ${cell("Workouts", h.length)}
      ${cell("Training time", Fmt.duration(totals.minutes * 60000))}
      ${cell("Total sets", totals.sets)}
      ${cell("Total volume", Fmt.volume(totals.volume))}
      ${cell("Streak", `${Store.weekStreak()} wk`)}
      ${cell("This week", Store.sessionsThisWeek())}
    </dl>`;
  }

  function volumeBlock() {
    const weeks = Metrics.weeklyVolume(8).map((w, i, all) => ({
      value: w.value,
      label: i === all.length - 1 ? "now" : `-${all.length - 1 - i}`,
    }));
    const trained = weeks.filter((w) => w.value > 0).length;

    return `<section class="block">
      <h2 class="section-head"><span>Weekly volume</span><span class="mono view-sub">${trained} of 8 weeks</span></h2>
      ${Charts.bars(weeks, { format: (v) => Fmt.volume(v) })}
    </section>`;
  }

  function strengthBlock() {
    const score = Metrics.strengthScore(Store.state.profile);
    if (!score) {
      return `<section class="block">
        <h2 class="section-head"><span>Strength score</span></h2>
        <p class="chart-empty mono">Add your bodyweight in Profile and log a main lift to see this.</p>
      </section>`;
    }

    return `<section class="block">
      <h2 class="section-head"><span>Strength score</span><span class="mono view-sub">${score.logged} of ${score.of} lifts</span></h2>
      <div class="score-row">
        <div class="score-dial">
          <span class="score-num" data-count="${score.score}">0</span>
          <span class="score-of mono">/ 1000</span>
        </div>
        <ul class="chart-split">
          ${score.lifts
            .map(
              (l) => `<li>
                <span class="split-key mono">${esc(l.name)}</span>
                <span class="split-track"><i style="width:${Math.round(l.share * 100)}%"></i></span>
                <span class="split-val mono">${l.ratio}×</span>
              </li>`,
            )
            .join("")}
        </ul>
      </div>
      <p class="rec-note">Best estimated 1RM as a multiple of your bodyweight, averaged across the main lifts. A yardstick for your own progress.</p>
    </section>`;
  }

  function balanceBlock() {
    const rows = Metrics.balance();
    if (!rows.length) return "";

    return `<section class="block">
      <h2 class="section-head"><span>Muscle balance</span><span class="mono view-sub">last 4 weeks</span></h2>
      <ul class="balance-list">
        ${rows
          .map(
            (r) => `<li class="balance-row is-${r.state}">
              <div class="balance-head mono">
                <span>${r.aName}</span>
                <span class="balance-state">${r.state === "even" ? "even" : r.state === "slight" ? "slightly off" : "lopsided"}</span>
                <span>${r.bName}</span>
              </div>
              <div class="balance-bar"><i style="width:${Math.round(r.share * 100)}%"></i></div>
            </li>`,
          )
          .join("")}
      </ul>
    </section>`;
  }

  function recoveryBlock() {
    return `<section class="block">
      <h2 class="section-head"><span>Muscle recovery</span></h2>
      ${RecoveryMap.render()}
      ${RecoveryMap.legend()}
      <ul class="chart-split rec-rows">${RecoveryMap.rows(8)}</ul>
      <p class="rec-note">Estimated from how much each muscle has been worked and how long ago. A planning aid, not medical advice.</p>
    </section>`;
  }

  function deloadBlock() {
    const hint = Metrics.deloadHint();
    if (!hint) return "";
    return `<section class="note-card is-${hint.tone}">
      <p class="card-kicker mono">Worth considering</p>
      <p>${hint.text}</p>
    </section>`;
  }

  function groupBlock() {
    const totals = Metrics.volumeByGroup(Store.state.history);
    const rows = Object.entries(totals).map(([label, value]) => ({ label, value }));
    if (!rows.length) return "";
    return `<section class="block">
      <h2 class="section-head"><span>Where the work goes</span></h2>
      ${Charts.split(rows)}
    </section>`;
  }

  function render() {
    const tracked = Object.keys(Store.state.records).filter(
      (id) => EXERCISE_BY_ID[id] && Store.historyFor(id).length,
    );

    if (!tracked.length)
      return `
        <div class="view-head"><div>
          <h1 class="view-title">Progress</h1>
          <p class="view-sub">Weight, reps and records per movement.</p>
        </div></div>
        <div class="empty">
          <p class="empty-title">Nothing to compare yet</p>
          <p class="empty-sub">Progress needs at least one finished workout. Train a session and your numbers start building here.</p>
          <a class="btn btn--primary" href="#/build">${Icons.get("play")} Build a workout</a>
        </div>`;

    tracked.sort(
      (a, b) => (Store.state.records[b].updatedAt || 0) - (Store.state.records[a].updatedAt || 0),
    );

    return `
      <div class="view-head"><div>
        <h1 class="view-title">Progress</h1>
        <p class="view-sub">${tracked.length} movement${tracked.length > 1 ? "s" : ""} tracked across your history.</p>
      </div></div>

      ${lifetime()}
      ${deloadBlock()}
      ${volumeBlock()}
      ${strengthBlock()}
      ${balanceBlock()}
      ${groupBlock()}
      ${recoveryBlock()}

      <section class="block">
        <h2 class="section-head"><span>Per movement</span></h2>
        <div class="prog-list">${tracked.map(row).join("")}</div>
      </section>`;
  }

  function mount(root) {
    root.querySelectorAll("[data-count]").forEach((el) =>
      countUp(el, +el.dataset.count),
    );
    root.addEventListener("click", (e) => {
      const r = e.target.closest("[data-ex]");
      if (r) ExerciseSheet.open(r.dataset.ex);
    });
  }

  return { render, mount };
})();
