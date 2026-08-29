const YouView = (() => {
  const GOALS = ["Build muscle", "Get stronger", "Stay in shape"];

  const cmToFtIn = (cm) => {
    const total = Math.round(cm / 2.54);
    return { ft: Math.floor(total / 12), inch: total % 12 };
  };

  function form(p) {
    const lb = Units.isLb();
    const h = p && p.heightCm ? (lb ? cmToFtIn(p.heightCm) : { cm: Math.round(p.heightCm) }) : null;
    const shownWeight = p && p.weightKg ? Units.fromKg(p.weightKg) : "";

    return `
      <div class="you-grid">
        <label class="field">
          <span class="field-label mono">Age</span>
          <input class="text-input" type="number" name="age" min="13" max="99"
                 placeholder="e.g. 21" value="${p && p.age ? p.age : ""}" />
        </label>

        ${lb
          ? `<label class="field">
               <span class="field-label mono">Height</span>
               <span class="split-input">
                 <input class="text-input" type="number" name="ft" min="3" max="8" placeholder="ft" value="${h ? h.ft : ""}" />
                 <input class="text-input" type="number" name="inch" min="0" max="11" placeholder="in" value="${h ? h.inch : ""}" />
               </span>
             </label>`
          : `<label class="field">
               <span class="field-label mono">Height (cm)</span>
               <input class="text-input" type="number" name="cm" min="120" max="230"
                      placeholder="e.g. 170" value="${h ? h.cm : ""}" />
             </label>`}

        <label class="field">
          <span class="field-label mono">Weight (${Units.label()})</span>
          <input class="text-input" type="number" name="weight" min="30" max="400" step="0.5"
                 placeholder="e.g. ${lb ? 155 : 70}" value="${shownWeight}" />
        </label>

        <label class="field">
          <span class="field-label mono">Experience</span>
          <select class="text-input" name="experience">
            <option value="">Choose…</option>
            ${Coach.LEVELS.map((l) => `<option value="${l}"${p && p.experience === l ? " selected" : ""}>${l}</option>`).join("")}
          </select>
        </label>

        <label class="field">
          <span class="field-label mono">Days a week you can train</span>
          <select class="text-input" name="days">
            <option value="">Choose…</option>
            ${[2, 3, 4, 5, 6].map((d) => `<option value="${d}"${p && p.days === d ? " selected" : ""}>${d} days</option>`).join("")}
          </select>
        </label>

        <label class="field">
          <span class="field-label mono">Goal</span>
          <select class="text-input" name="goal">
            ${GOALS.map((g) => `<option value="${g}"${p && p.goal === g ? " selected" : ""}>${g}</option>`).join("")}
          </select>
        </label>
      </div>`;
  }

  function levelNote(level) {
    return {
      Beginner: "Under a year of consistent lifting, or coming back after a long break.",
      Intermediate: "A year or two in. The basic lifts feel familiar and progress has slowed.",
      Advanced: "Several years of steady training with a good idea of what your body responds to.",
    }[level];
  }

  function render() {
    const p = Store.state.profile;
    const rec = Coach.recommend(p);

    return `
      <div class="view-head">
        <div>
          <h1 class="view-title">You</h1>
          <p class="view-sub">A few details and the app can point you at a split that fits your week.</p>
        </div>
      </div>

      <form class="you-form" data-you-form>
        ${form(p)}
        <div class="you-actions">
          <button class="btn btn--primary" type="submit">${Icons.get("check")} ${p ? "Update" : "Save"}</button>
          ${p ? `<button class="link-btn mono" type="button" data-clear-profile>Clear</button>` : ""}
        </div>
        ${p && p.experience ? `<p class="you-note mono">${levelNote(p.experience)}</p>` : ""}
      </form>

      ${rec
        ? `<section class="block">
            <h2 class="section-head"><span>Recommended for you</span><a class="link-btn mono" href="#/build">All splits</a></h2>
            <article class="rec">
              <div class="rec-top">
                <div>
                  <p class="card-kicker mono">Best fit</p>
                  <h3 class="rec-name">${rec.best.split.name}</h3>
                  <p class="rec-why">It ${Coach.why(p, rec.best)}.</p>
                </div>
              </div>
              <ol class="split-week mono">
                ${rec.best.split.week
                  .map((k, i) => {
                    const d = k ? DAY_PLANS[k] : null;
                    return `<li class="${d ? "" : "is-rest"}"><span class="split-day">${WEEK[i]}</span><span class="split-what">${d ? d.name : "Rest"}</span></li>`;
                  })
                  .join("")}
              </ol>
              <div class="split-actions">
                <button class="btn btn--sm btn--primary" type="button" data-apply-rec="${rec.best.split.id}">${Icons.get("calendar")} Add to my week</button>
                <a class="btn btn--sm" href="#/build">See all splits</a>
              </div>
              <p class="rec-alt mono">Also worth a look · ${rec.alt.split.name}</p>
            </article>
          </section>

          <section class="block">
            <h2 class="section-head"><span>Start with these</span><a class="link-btn mono" href="#/library">Library</a></h2>
            <div class="ex-grid">${Coach.starters(p, 4).map((e, i) => exerciseCard(e, i)).join("")}</div>
          </section>`
        : `<div class="empty">
            <p class="empty-title">Tell us about your training</p>
            <p class="empty-sub">Experience and how many days you can train are what decide the split. The rest is just for tracking.</p>
          </div>`}`;
  }

  function readForm(f) {
    const lb = Units.isLb();
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const heightCm = lb
      ? f.ft.value || f.inch.value
        ? Math.round(((num(f.ft.value) || 0) * 12 + (num(f.inch.value) || 0)) * 2.54)
        : null
      : num(f.cm.value);

    return {
      age: num(f.age.value),
      heightCm,
      weightKg: f.weight.value ? Units.toKg(Number(f.weight.value)) : null,
      experience: f.experience.value,
      days: num(f.days.value),
      goal: f.goal.value,
    };
  }

  function mount(root) {
    const f = root.querySelector("[data-you-form]");

    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const next = readForm(f);
      if (!next.experience || !next.days) {
        return Toast.show("Pick your experience and days a week first");
      }
      Store.setProfile(next);
      Sound.play("chime");
      App.repaint();
      Toast.show("Saved — recommendation below");
    });

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-clear-profile]")) {
        Store.setProfile(null);
        Sound.play("remove");
        return App.repaint();
      }
      const apply = e.target.closest("[data-apply-rec]");
      if (apply) return BuildView.applySplit(apply.dataset.applyRec);
    });
  }

  return { render, mount };
})();
