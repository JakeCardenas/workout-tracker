const WorkoutSets = (() => {
  function rail(exercise, activeIndex) {
    const chips = exercise.sets
      .map((set, i) => {
        const meta = SetTypes.of(set);
        const state = set.done ? " is-done" : i === activeIndex ? " is-active" : "";
        const label = meta.badge || String(workingNumber(exercise, i));
        return `<button class="set-chip${state} is-${meta.key}" type="button"
                  data-jump-set="${i}" aria-label="Set ${i + 1}, ${meta.name}">
                  <span class="mono">${label}</span>
                </button>`;
      })
      .join("");

    return `<div class="set-rail" role="group" aria-label="Sets">
      ${chips}
      <button class="set-chip is-add" type="button" data-add-set aria-label="Add a set">
        <span class="mono">+</span>
      </button>
    </div>`;
  }

  // warm-ups are not counted, so the numbers on screen match the working sets
  function workingNumber(exercise, index) {
    let n = 0;
    for (let i = 0; i <= index; i++) {
      if (SetTypes.counts(exercise.sets[i])) n++;
    }
    return n || 1;
  }

  function previousBlock(exId, unit) {
    const last = Store.lastSetsFor(exId);
    if (!last) return "";

    const working = last.sets.filter(SetTypes.counts);
    if (!working.length) return "";

    const grouped = working
      .map((s) => `${Fmt.weight(s.weight, unit)} × ${s.reps}`)
      .join("  ·  ");

    return `<div class="prev-line">
      <div class="prev-copy">
        <span class="field-label mono">Last time · ${Fmt.date(last.at)}</span>
        <span class="prev-sets mono">${grouped}</span>
      </div>
      <button class="btn btn--sm" type="button" data-use-previous>Reuse</button>
    </div>`;
  }

  function typeSheet(onPick) {
    Sheet.open({
      title: "Set type",
      body: `<div class="type-pick">
        ${SetTypes.ORDER.map(
          (key) => `<button class="type-option" type="button" data-type="${key}">
            <span class="type-badge mono is-${key}">${SetTypes.META[key].badge || "•"}</span>
            <span class="type-copy">
              <strong>${SetTypes.META[key].name}</strong>
              <span>${SetTypes.META[key].hint}</span>
            </span>
          </button>`,
        ).join("")}
      </div>`,
      onMount(scope) {
        scope.querySelectorAll("[data-type]").forEach((btn) =>
          btn.addEventListener("click", () => {
            Sheet.close();
            onPick(btn.dataset.type);
          }),
        );
      },
    });
  }

  // Plates.warmup works off the bar, so it only has something to say for
  // loaded barbell work heavy enough to be worth ramping into
  function warmupPlan(meta, workingSet) {
    if (!Plates.usesBar(meta)) return [];
    return Plates.warmup(workingSet.weight, workingSet.reps).map((row) => ({
      reps: row.reps,
      weight: Units.toKg(row.weight),
      type: "warmup",
      done: false,
    }));
  }

  function offerWarmup(exercise, meta, onApply) {
    const first = exercise.sets.find((s) => !s.done);
    if (!first) return Toast.show("Nothing left to warm up for");
    const plan = warmupPlan(meta, first);
    if (!plan.length) return Toast.show("No ramp needed at this weight");

    Sheet.open({
      title: "Smart warm-up",
      body: `<div class="warmup-plan">
        <p class="sheet-lede">A ramp into ${Fmt.weight(first.weight, meta.unit)}. Edit or ignore any of it.</p>
        <ul class="warmup-rows">
          ${plan
            .map(
              (row) => `<li>
                <span class="type-badge mono is-warmup">W</span>
                <span class="mono">${Fmt.weight(row.weight, meta.unit)} × ${row.reps}</span>
              </li>`,
            )
            .join("")}
        </ul>
        <button class="btn btn--primary btn--lg" type="button" data-apply-warmup>Add ${plan.length} warm-up sets</button>
      </div>`,
      onMount(scope) {
        scope.querySelector("[data-apply-warmup]").addEventListener("click", () => {
          Sheet.close();
          onApply(plan);
        });
      },
    });
  }

  return { rail, workingNumber, previousBlock, typeSheet, offerWarmup };
})();
