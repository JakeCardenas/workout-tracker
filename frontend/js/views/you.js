const YouView = (() => {
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

      ${p
        ? `<section class="profile-card">
            <dl class="profile-grid mono">
              ${p.age ? `<div><dt>Age</dt><dd>${p.age}</dd></div>` : ""}
              ${p.heightCm ? `<div><dt>Height</dt><dd>${Units.isLb() ? `${Math.floor(Math.round(p.heightCm / 2.54) / 12)}'${Math.round(p.heightCm / 2.54) % 12}"` : `${Math.round(p.heightCm)} cm`}</dd></div>` : ""}
              ${p.weightKg ? `<div><dt>Weight</dt><dd>${Fmt.weight(p.weightKg)}</dd></div>` : ""}
              <div><dt>Experience</dt><dd>${esc(p.statedLevel || p.experience)}</dd></div>
              <div><dt>Goal</dt><dd>${esc(p.goal || "—")}</dd></div>
              <div><dt>Days</dt><dd>${p.days}</dd></div>
              <div><dt>Trains at</dt><dd>${esc(p.place || "—")}</dd></div>
            </dl>
            <div class="you-actions">
              <button class="btn" type="button" data-edit-profile>${Icons.get("edit")} Edit profile</button>
              <button class="link-btn mono" type="button" data-clear-profile>Clear</button>
            </div>
          </section>`
        : `<section class="hero-card is-empty">
            <p class="card-kicker mono">Five questions</p>
            <h2 class="hero-card-title">Find your plan</h2>
            <p class="hero-card-meta mono">Experience, goal, days and equipment. About a minute.</p>
            <div class="hero-card-actions">
              <button class="btn btn--primary btn--lg" type="button" data-edit-profile>Start</button>
            </div>
          </section>`}

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

  function mount(root) {
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-edit-profile]")) return Onboarding.open(Store.state.profile);
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
