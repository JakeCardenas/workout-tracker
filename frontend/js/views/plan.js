const PlanView = (() => {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let cursor = new Date();

  const monthName = (d) =>
    d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function grid(month) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const lead = (first.getDay() + 6) % 7;
    const today = Store.dayKey(Date.now());
    const cells = [];

    for (let i = 0; i < lead; i++) cells.push('<span class="day is-blank"></span>');

    for (let n = 1; n <= last.getDate(); n++) {
      const date = new Date(month.getFullYear(), month.getMonth(), n);
      const key = Store.dayKey(date);
      const done = Store.sessionsOn(key).length;
      const plan = Store.plannedOn(key);
      const missed = plan && !done && key < today;

      const marks = [
        done ? "is-done" : "",
        plan && !done ? "is-planned" : "",
        missed ? "is-missed" : "",
        key === today ? "is-today" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const label = done
        ? `${done} session${done > 1 ? "s" : ""}`
        : plan
          ? esc(plan.name)
          : "";

      cells.push(`
        <button class="day ${marks}" type="button" data-day="${key}"
                aria-label="${key}${label ? ` — ${label}` : ""}">
          <span class="day-n mono">${n}</span>
          ${done ? '<span class="day-dot"></span>' : plan ? '<span class="day-ring"></span>' : ""}
        </button>`);
    }
    return cells.join("");
  }

  function render() {
    const streak = Store.weekStreak();
    const week = Store.sessionsThisWeek();
    const missed = Store.missedDays();
    const next = Store.nextPlanned();

    return `
      <div class="view-head">
        <div>
          <h1 class="view-title">Plan</h1>
          <p class="view-sub">Put sessions on the calendar so the week decides itself.</p>
        </div>
      </div>

      <dl class="summary-strip mono">
        <div><dt>This week</dt><dd>${week} session${week === 1 ? "" : "s"}</dd></div>
        <div><dt>Streak</dt><dd>${streak} week${streak === 1 ? "" : "s"}</dd></div>
        <div><dt>Planned</dt><dd>${Object.keys(Store.state.schedule).length}</dd></div>
        <div><dt>Missed</dt><dd>${missed.length}</dd></div>
      </dl>

      ${next
        ? `<article class="next-up">
            <div>
              <p class="card-kicker mono">${next.key === Store.dayKey(Date.now()) ? "Today" : Fmt.relativeAhead(next.key)}</p>
              <h2 class="next-name">${esc(next.plan.name)}</h2>
            </div>
            <button class="btn btn--primary" type="button" data-start-plan="${next.key}">${Icons.get("play")} Start</button>
          </article>`
        : ""}

      ${missed.length
        ? `<article class="missed">
            <p class="missed-title">${missed.length} session${missed.length > 1 ? "s" : ""} slipped by</p>
            <p class="missed-sub mono">${missed.slice(-3).map((k) => `${Fmt.shortDate(new Date(k + "T00:00:00"))} · ${esc(Store.plannedOn(k).name)}`).join("  ·  ")}</p>
            <button class="link-btn mono" type="button" data-clear-missed>Clear them</button>
          </article>`
        : ""}

      <section class="cal">
        <header class="cal-head">
          <button class="icon-btn" type="button" data-month="-1" aria-label="Previous month">${Icons.get("back")}</button>
          <h2 class="cal-title">${monthName(cursor)}</h2>
          <button class="icon-btn" type="button" data-month="1" aria-label="Next month">${Icons.get("forward")}</button>
        </header>
        <div class="cal-days mono">${DAYS.map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="cal-grid">${grid(cursor)}</div>
        <p class="cal-key mono">
          <span class="key-item"><span class="day-dot"></span> trained</span>
          <span class="key-item"><span class="day-ring"></span> planned</span>
          <span class="key-item"><span class="day-ring is-missed"></span> missed</span>
        </p>
      </section>`;
  }

  function openDay(key) {
    const done = Store.sessionsOn(key);
    const plan = Store.plannedOn(key);
    const nice = new Date(key + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
    const options = Store.state.workouts
      .map((w) => `<option value="w:${w.id}">${esc(w.name)}</option>`)
      .join("");
    const dayOptions = Object.entries(DAY_PLANS)
      .map(([k, d]) => `<option value="d:${k}">${d.name} — ${d.focus}</option>`)
      .join("");

    Sheet.open({
      title: nice,
      body: `
        <header class="detail-head">
          <div>
            <h2 class="detail-title">${nice}</h2>
            <p class="detail-meta mono">${done.length ? `${done.length} session${done.length > 1 ? "s" : ""} logged` : plan ? "Planned" : "Nothing here yet"}</p>
          </div>
        </header>

        ${done.length
          ? `<ul class="log-sets mono">${done.map((h) => `<li>${esc(h.name)} · ${h.stats.sets} sets · ${Fmt.volume(h.stats.volume)}</li>`).join("")}</ul>`
          : ""}

        <div class="field">
          <span class="field-label mono">Plan a session</span>
          <select class="text-input" data-plan-pick>
            <option value="">Choose a workout…</option>
            ${options ? `<optgroup label="Saved">${options}</optgroup>` : ""}
            <optgroup label="Split days">${dayOptions}</optgroup>
          </select>
        </div>

        <div class="confirm-actions">
          <button class="btn btn--primary" type="button" data-save-plan="${key}">${Icons.get("check")} Save to calendar</button>
          ${plan ? `<button class="btn btn--danger" type="button" data-drop-plan="${key}">${Icons.get("trash")} Remove</button>` : ""}
          <button class="btn" type="button" data-close>Close</button>
        </div>`,
      onMount(scope) {
        const pick = scope.querySelector("[data-plan-pick]");
        if (plan && plan.ref) pick.value = plan.ref;

        scope.querySelector("[data-save-plan]").addEventListener("click", () => {
          if (!pick.value) return Toast.show("Pick a workout first");
          const name = pick.options[pick.selectedIndex].textContent;
          Store.planSession(key, { ref: pick.value, name });
          Sheet.close();
          Sound.play("set");
          App.repaint();
          Toast.show(`${name} planned for ${Fmt.shortDate(new Date(key + "T00:00:00"))}`);
        });

        const drop = scope.querySelector("[data-drop-plan]");
        if (drop)
          drop.addEventListener("click", () => {
            Store.planSession(key, null);
            Sheet.close();
            Sound.play("remove");
            App.repaint();
          });
      },
    });
  }

  function loadPlan(key) {
    const plan = Store.plannedOn(key);
    if (!plan) return;
    const [kind, id] = plan.ref.split(":");
    if (kind === "w") {
      Store.loadWorkout(id);
    } else {
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
      const step = e.target.closest("[data-month]");
      if (step) {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + +step.dataset.month, 1);
        return App.repaint();
      }
      const day = e.target.closest("[data-day]");
      if (day) return openDay(day.dataset.day);

      const start = e.target.closest("[data-start-plan]");
      if (start) return loadPlan(start.dataset.startPlan);

      if (e.target.closest("[data-clear-missed]")) {
        Store.missedDays().forEach((k) => Store.planSession(k, null));
        Sound.play("remove");
        App.repaint();
        Toast.show("Calendar tidied — start again from today");
      }
    });
  }

  return { render, mount };
})();
