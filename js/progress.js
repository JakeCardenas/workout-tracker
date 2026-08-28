function sparkline(points, key = "weight") {
  if (points.length < 2) return `<span class="spark-empty mono">—</span>`;
  const values = points.map((p) => p[key]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 120;
  const hgt = 34;
  const step = w / (points.length - 1);
  const coords = values.map((v, i) => [i * step, hgt - ((v - min) / span) * (hgt - 6) - 3]);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = coords[coords.length - 1];
  const area = `0,${hgt} ${line} ${w},${hgt}`;
  return `<svg class="spark" viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none" aria-hidden="true">
    <polygon class="spark-area" points="${area}" />
    <polyline class="spark-line" points="${line}" />
    <circle class="spark-dot" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.6" />
  </svg>`;
}

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

    return `
      <article class="prog-row" data-ex="${exId}" tabindex="0" role="button">
        <div class="prog-main">
          <h3 class="prog-name">${esc(meta.name)}</h3>
          <p class="prog-meta mono">${meta.group} · ${points.length} session${points.length > 1 ? "s" : ""}</p>
        </div>

        <div class="prog-compare mono">
          ${prior
            ? `<span class="prog-prev">${prior.weight}${meta.unit === "sec" ? "s" : "kg"} × ${prior.reps}</span>
               <span class="prog-arrow">${Icons.get("forward")}</span>`
            : ""}
          <span class="prog-now">${latest.weight}${meta.unit === "sec" ? "s" : "kg"} × ${latest.reps}</span>
          ${delta > 0 ? `<span class="prog-delta is-up">+${(+delta.toFixed(1))}</span>` : ""}
          ${latest.weight >= (rec ? rec.bestWeight : 0) && points.length > 1 && delta > 0 ? `<span class="pr-badge mono">PR</span>` : ""}
        </div>

        <div class="prog-spark">${sparkline(points)}</div>

        <dl class="prog-best mono">
          <div><dt>Best</dt><dd>${rec && rec.bestWeight ? Fmt.weight(rec.bestWeight, meta.unit) : "—"}</dd></div>
          <div><dt>Top ${meta.unit === "sec" ? "hold" : "reps"}</dt><dd>${rec ? rec.bestReps : "—"}</dd></div>
          <div><dt>Volume</dt><dd>${Fmt.volume(volume)}</dd></div>
        </dl>
      </article>`;
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
      <div class="prog-list">${tracked.map(row).join("")}</div>`;
  }

  function mount(root) {
    root.addEventListener("click", (e) => {
      const r = e.target.closest("[data-ex]");
      if (r) ExerciseSheet.open(r.dataset.ex);
    });
  }

  return { render, mount };
})();
