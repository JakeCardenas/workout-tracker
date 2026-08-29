function estimateDuration(items) {
  const seconds = items.reduce((total, i) => {
    const timed = EXERCISE_BY_ID[i.exId].unit === "sec";
    return (
      total +
      Store.setsOf(i).reduce((t, row) => t + (timed ? row.reps : row.reps * 3) + i.rest, 0)
    );
  }, 0);
  return seconds * 1000;
}

// "3 × 10 · 40 kg" when every set matches, otherwise the varied breakdown
function describeSets(item, ex) {
  const rows = Store.setsOf(item);
  const uniform = rows.every((r) => r.reps === rows[0].reps && r.weight === rows[0].weight);
  if (uniform) {
    return `${rows.length} × ${rows[0].reps}${ex.unit === "sec" ? "s" : ""} · ${Fmt.weight(rows[0].weight, ex.unit)}`;
  }
  const sameWeight = rows.every((r) => r.weight === rows[0].weight);
  const reps = rows.map((r) => r.reps).join("/");
  return sameWeight
    ? `${reps} · ${Fmt.weight(rows[0].weight, ex.unit)}`
    : rows.map((r) => `${r.reps}×${Units.fromKg(r.weight)}`).join(" · ");
}

function draftTotals(items) {
  let sets = 0;
  let reps = 0;
  let volume = 0;
  items.forEach((i) => {
    Store.setsOf(i).forEach((row) => {
      sets += 1;
      reps += row.reps;
      volume += row.reps * row.weight;
    });
  });
  return { sets, reps, volume, duration: estimateDuration(items) };
}

function setTableMarkup(item) {
  const ex = EXERCISE_BY_ID[item.exId];
  const rows = Store.setsOf(item);
  const unit = ex.unit === "sec" ? "sec" : Units.label();
  return `
    <div class="set-table" data-set-table>
      <div class="set-head mono">
        <span>Set</span><span>${ex.unit === "sec" ? "Seconds" : "Weight (" + unit + ")"}</span><span>${ex.unit === "sec" ? "Rounds" : "Reps"}</span><span></span>
      </div>
      ${rows
        .map(
          (r, i) => `
        <div class="set-line" data-set-line="${i}">
          <span class="set-n mono">${i + 1}</span>
          <input class="text-input set-in" type="number" inputmode="decimal" min="0" step="0.5"
                 value="${Units.fromKg(r.weight)}" data-set-weight aria-label="Set ${i + 1} weight" />
          <input class="text-input set-in" type="number" inputmode="numeric" min="1"
                 value="${r.reps}" data-set-reps aria-label="Set ${i + 1} reps" />
          <button class="icon-btn icon-btn--danger" type="button" data-drop-set="${i}"
                  aria-label="Remove set ${i + 1}" ${rows.length < 2 ? "disabled" : ""}>${Icons.get("trash")}</button>
        </div>`,
        )
        .join("")}
      <div class="set-tools">
        <button class="btn btn--sm" type="button" data-add-set>${Icons.get("plus")} Add set</button>
        <button class="btn btn--sm" type="button" data-copy-first>Copy set 1 down</button>
      </div>
    </div>`;
}

function openItemEditor(item, onSave) {
  const ex = EXERCISE_BY_ID[item.exId];
  const s = stepsFor(ex);
  Sheet.open({
    title: `Edit ${ex.name}`,
    body: `
      <header class="detail-head">
        <div>
          <h2 class="detail-title">${esc(ex.name)}</h2>
          <p class="detail-meta mono">${ex.group} · ${ex.equipment}</p>
        </div>
      </header>
      <section class="config" data-config>
        <div class="config-grid">
          ${Stepper.markup({ name: "sets", value: item.sets, min: 1, max: 12, step: 1, label: "Sets" })}
          ${Stepper.markup({ name: "reps", value: item.reps, min: s.repsMin, max: s.repsMax, step: s.repsStep, label: s.repsLabel })}
          ${Stepper.markup({ name: "weight", value: Units.fromKg(item.weight), min: 0, max: s.weightMax, step: s.weightStep, label: s.weightLabel, suffix: ` ${Units.label()}` })}
        </div>
        ${RestPicker.markup(item.rest)}
      </section>

      <section class="detail-section">
        <h3 class="section-label mono">Each set</h3>
        <div data-table-host>${setTableMarkup(item)}</div>
        <button class="btn btn--primary btn--block" type="button" data-save>${Icons.get("check")} Save changes</button>
      </section>`,
    onMount(scope) {
      const host = scope.querySelector("[data-table-host]");
      const config = scope.querySelector("[data-config]");
      let rows = Store.setsOf(item);

      const redraw = () => {
        host.innerHTML = setTableMarkup(Object.assign({}, item, { sets: rows.length, plan: rows }));
      };

      const readRows = () =>
        [...host.querySelectorAll("[data-set-line]")].map((line) => ({
          weight: Units.toKg(Number(line.querySelector("[data-set-weight]").value) || 0),
          reps: Math.max(1, Number(line.querySelector("[data-set-reps]").value) || 1),
        }));

      // the steppers set the shape of the work, so they reshape the table too
      config.addEventListener("stepper", (e) => {
        rows = readRows();
        if (e.detail.name === "sets") {
          const want = e.detail.value;
          while (rows.length < want) rows.push(Object.assign({}, rows[rows.length - 1] || { reps: 10, weight: 0 }));
          rows.length = want;
        } else {
          const key = e.detail.name === "weight" ? "weight" : "reps";
          const value = key === "weight" ? Units.toKg(e.detail.value) : e.detail.value;
          rows = rows.map((r) => Object.assign({}, r, { [key]: value }));
        }
        redraw();
      });

      host.addEventListener("click", (e) => {
        const drop = e.target.closest("[data-drop-set]");
        if (drop) {
          rows = readRows();
          rows.splice(+drop.dataset.dropSet, 1);
          Sound.play("remove");
          return redraw();
        }
        if (e.target.closest("[data-add-set]")) {
          rows = readRows();
          rows.push(Object.assign({}, rows[rows.length - 1] || { reps: 10, weight: 0 }));
          Sound.play("step");
          return redraw();
        }
        if (e.target.closest("[data-copy-first]")) {
          rows = readRows();
          const first = rows[0];
          rows = rows.map(() => Object.assign({}, first));
          Sound.play("step");
          return redraw();
        }
      });

      scope.querySelector("[data-save]").addEventListener("click", () => {
        const finalRows = readRows();
        onSave({
          sets: finalRows.length,
          reps: finalRows[0].reps,
          weight: finalRows[0].weight,
          plan: finalRows,
          rest: +config.querySelector("[data-rest-picker]").dataset.value,
        });
        Sound.play("tap");
        Sheet.close();
      });
    },
  });
}

const BuildView = (() => {
  function itemRow(item, index, total) {
    const ex = EXERCISE_BY_ID[item.exId];
    return `
      <li class="build-item" data-uid="${item.uid}" draggable="true">
        <span class="build-index mono">${String(index + 1).padStart(2, "0")}</span>
        <div class="build-main">
          <h3 class="build-name">${esc(ex.name)}</h3>
          <p class="build-sum mono">${describeSets(item, ex)} · ${item.rest}s rest</p>
        </div>
        <div class="build-tools">
          <button class="icon-btn" type="button" data-move="-1" ${index === 0 ? "disabled" : ""} aria-label="Move up">${Icons.get("up")}</button>
          <button class="icon-btn" type="button" data-move="1" ${index === total - 1 ? "disabled" : ""} aria-label="Move down">${Icons.get("down")}</button>
          <button class="icon-btn" type="button" data-edit aria-label="Edit">${Icons.get("edit")}</button>
          <button class="icon-btn icon-btn--danger" type="button" data-remove aria-label="Remove">${Icons.get("trash")}</button>
        </div>
        <span class="build-grip" aria-hidden="true">${Icons.get("grip")}</span>
      </li>`;
  }

  const stars = (n) =>
    Array.from({ length: 5 }, (_, i) => {
      const full = i + 1 <= Math.floor(n);
      const half = !full && i + 0.5 < n;
      return `<span class="star${full ? " is-on" : half ? " is-half" : ""}"></span>`;
    }).join("");

  function splitCard(sp) {
    return `
      <article class="split-card" data-split="${sp.id}">
        <div class="split-top">
          <div>
            <h3 class="split-name">${sp.name}</h3>
            <p class="split-note">${sp.note}</p>
          </div>
          <span class="split-rating" title="${sp.rating} out of 5">${stars(sp.rating)}</span>
        </div>
        <ol class="split-week mono">
          ${sp.week
            .map((key, i) => {
              const plan = key ? DAY_PLANS[key] : null;
              return `<li class="${plan ? "" : "is-rest"}">
                <span class="split-day">${WEEK[i]}</span>
                <span class="split-what">${plan ? plan.name : "Rest"}</span>
              </li>`;
            })
            .join("")}
        </ol>
        <div class="split-actions">
          <button class="btn btn--sm btn--primary" type="button" data-plan-split="${sp.id}">${Icons.get("calendar")} Add to my week</button>
          <button class="btn btn--sm" type="button" data-open-split="${sp.id}">See days</button>
        </div>
      </article>`;
  }

  function savedCard(w) {
    const totals = draftTotals(w.items);
    return `
      <article class="saved-card" data-workout="${w.id}">
        <div class="saved-top">
          <h3 class="saved-name">${esc(w.name)}</h3>
          <p class="saved-meta mono">${w.items.length} exercises · ${totals.sets} sets · ~${Fmt.duration(totals.duration)}</p>
        </div>
        <ul class="saved-list mono">
          ${w.items.slice(0, 4).map((i) => `<li>${esc(EXERCISE_BY_ID[i.exId].name)}</li>`).join("")}
          ${w.items.length > 4 ? `<li class="is-more">+${w.items.length - 4} more</li>` : ""}
        </ul>
        <div class="saved-actions">
          <button class="btn btn--sm btn--primary" type="button" data-start-saved>${Icons.get("play")} Start</button>
          <button class="btn btn--sm" type="button" data-load>Open</button>
          <button class="icon-btn" type="button" data-duplicate aria-label="Duplicate">${Icons.get("copy")}</button>
          <button class="icon-btn icon-btn--danger" type="button" data-delete-workout aria-label="Delete">${Icons.get("trash")}</button>
        </div>
      </article>`;
  }

  function summaryRail(items) {
    const totals = draftTotals(items);
    const groups = [];
    items.forEach((i) => {
      const g = EXERCISE_BY_ID[i.exId].group;
      if (!groups.includes(g)) groups.push(g);
    });
    return `
      <aside class="build-summary">
        <h3 class="section-label mono">Summary</h3>
        <dl class="summary-list mono">
          <div><dt>Exercises</dt><dd>${items.length}</dd></div>
          <div><dt>Sets</dt><dd>${totals.sets}</dd></div>
          <div><dt>Reps</dt><dd>${totals.reps}</dd></div>
          <div><dt>Volume</dt><dd>${totals.volume ? Fmt.volume(totals.volume) : "—"}</dd></div>
          <div><dt>Time</dt><dd>~${Fmt.duration(totals.duration)}</dd></div>
        </dl>
        <div class="summary-groups">
          <span class="field-label mono">Targets</span>
          <div class="chips">${groups.map((g) => `<span class="chip mono is-static">${g}</span>`).join("")}</div>
        </div>
        <button class="btn btn--primary btn--block" type="button" data-start>${Icons.get("play")} Start workout</button>
      </aside>`;
  }

  function render() {
    const draft = Store.state.draft;
    const items = draft.items;
    const totals = draftTotals(items);
    const saved = Store.state.workouts;

    return `
      <div class="view-head">
        <div>
          <h1 class="view-title">Build a Workout</h1>
          <p class="view-sub">Stack the movements, set the numbers, then train it.</p>
        </div>
      </div>

      <section class="builder" data-builder>
        <div class="builder-head">
          <input class="name-input" type="text" data-name placeholder="Name this workout"
                 value="${esc(draft.name)}" aria-label="Workout name" maxlength="40" />
          ${items.length ? `<dl class="totals mono">
            <div><dt>Exercises</dt><dd>${items.length}</dd></div>
            <div><dt>Sets</dt><dd>${totals.sets}</dd></div>
            <div><dt>Reps</dt><dd>${totals.reps}</dd></div>
            <div><dt>Est.</dt><dd>${Fmt.duration(totals.duration)}</dd></div>
          </dl>` : ""}
        </div>

        ${items.length ? summaryRail(items) : ""}
        ${items.length
          ? `<ol class="build-list" data-list>${items.map((i, n) => itemRow(i, n, items.length)).join("")}</ol>
             <div class="builder-actions">
               <button class="btn btn--primary btn--lg" type="button" data-start>${Icons.get("play")} Start Workout</button>
               <button class="btn" type="button" data-save-workout>${Icons.get("check")} ${draft.savedId ? "Update" : "Save"} workout</button>
               <button class="btn" type="button" data-open-picker>${Icons.get("plus")} Add exercise</button>
               <button class="link-btn mono" type="button" data-clear-draft>Clear</button>
             </div>`
          : `<div class="empty empty--builder">
               <p class="empty-title">Your workout is empty</p>
               <p class="empty-sub">Add exercises from the library, or start from a template below.</p>
               <button class="btn btn--primary" type="button" data-open-picker>${Icons.get("plus")} Add your first exercise</button>
               <a class="btn" href="#/library">${Icons.get("library")} Browse library</a>
             </div>`}
      </section>

      <section class="block">
        <h2 class="section-head"><span>Splits</span><span class="group-count mono">a week at a time</span></h2>
        <div class="split-grid">
          ${SPLITS.map(splitCard).join("")}
        </div>
      </section>

      ${saved.length
        ? `<section class="block">
            <h2 class="section-head"><span>Saved workouts</span><span class="group-count mono">${saved.length}</span></h2>
            <div class="saved-grid">${saved.map(savedCard).join("")}</div>
          </section>`
        : ""}`;
  }

  function loadDay(key) {
    const plan = DAY_PLANS[key];
    if (!plan) return;
    const adapted = Coach.adaptDay(key, Store.state.profile);
    Store.clearDraft();
    Store.setDraftName(plan.name);
    adapted.exercises.forEach((x) => Store.addToDraft(x.id));
    Sound.play("set");
    App.repaint();
    Toast.show(`${plan.name} loaded — change anything you like`);
  }

  function showSplit(id) {
    const sp = SPLIT_BY_ID[id];
    Sheet.open({
      title: sp.name,
      size: "sheet-panel--wide",
      body: `
        <header class="detail-head">
          <div>
            <h2 class="detail-title">${sp.name}</h2>
            <p class="detail-meta mono">${sp.days} training days · ${sp.rating} / 5</p>
          </div>
        </header>
        <p class="detail-summary">${sp.note}</p>
        <ol class="split-days">
          ${sp.week
            .map((key, i) => {
              const plan = key ? DAY_PLANS[key] : null;
              if (!plan) return `<li class="split-day-row is-rest"><span class="split-day">${WEEK[i]}</span><span>Rest</span></li>`;
              const adapted = Coach.adaptDay(key, Store.state.profile);
              const swaps = adapted.exercises.filter((x) => x.swappedFrom).length;
              return `<li class="split-day-row">
                <span class="split-day">${WEEK[i]}</span>
                <div class="split-day-main">
                  <strong>${plan.name}</strong>
                  <span class="mono">${plan.focus}</span>
                  <span class="mono split-list">${adapted.exercises.map((x) => esc(EXERCISE_BY_ID[x.id].name)).join(" · ")}</span>
                  ${swaps ? `<span class="mono swap-note">${swaps} swapped for your equipment</span>` : ""}
                </div>
                <button class="btn btn--sm" type="button" data-load-day="${key}">Load</button>
              </li>`;
            })
            .join("")}
        </ol>
        <div class="confirm-actions">
          <button class="btn btn--primary" type="button" data-plan-split="${sp.id}">${Icons.get("calendar")} Add to my week</button>
          <button class="btn" type="button" data-close>Close</button>
        </div>`,
      onMount(scope) {
        scope.querySelectorAll("[data-load-day]").forEach((b) =>
          b.addEventListener("click", () => {
            Sheet.close();
            loadDay(b.dataset.loadDay);
          }),
        );
        scope.querySelector("[data-plan-split]").addEventListener("click", () => {
          Sheet.close();
          applySplit(sp.id);
        });
      },
    });
  }

  // drops the split onto the calendar starting from the coming Monday
  function applySplit(id) {
    const sp = SPLIT_BY_ID[id];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const shift = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - shift);

    let placed = 0;
    sp.week.forEach((key, i) => {
      if (!key) return;
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      Store.planSession(Store.dayKey(d), { ref: `d:${key}`, name: DAY_PLANS[key].name });
      placed += 1;
    });

    Sound.play("set");
    App.repaint();
    Toast.show(`${sp.name} on your calendar — ${placed} sessions this week`, {
      action: "Open plan",
      onAction: () => (location.hash = "#/plan"),
    });
  }

  function mount(root) {
    const nameInput = root.querySelector("[data-name]");
    nameInput.addEventListener("change", () => Store.setDraftName(nameInput.value));

    root.addEventListener("click", (e) => {
      const row = e.target.closest(".build-item");
      const card = e.target.closest("[data-workout]");

      if (row) {
        const uid = row.dataset.uid;
        const item = Store.state.draft.items.find((i) => i.uid === uid);
        if (!item) return;
        const move = e.target.closest("[data-move]");
        if (move) {
          Store.moveDraftItem(uid, +move.dataset.move);
          return App.repaint();
        }
        if (e.target.closest("[data-remove]")) {
          const removed = Object.assign({}, item);
          Store.removeDraftItem(uid);
          Sound.play("remove");
          App.repaint();
          Toast.show(`${EXERCISE_BY_ID[removed.exId].name} removed`, {
            action: "Undo",
            onAction: () => {
              Store.addToDraft(removed.exId, removed);
              App.repaint();
            },
          });
          return;
        }
        if (e.target.closest("[data-edit]") || e.target.closest(".build-main")) {
          openItemEditor(item, (patch) => {
            Store.updateDraftItem(uid, patch);
            App.repaint();
          });
          return;
        }
      }

      if (card) {
        const id = card.dataset.workout;
        if (e.target.closest("[data-start-saved]")) {
          Store.loadWorkout(id);
          return Workout.start(Store.state.draft);
        }
        if (e.target.closest("[data-load]")) {
          Store.loadWorkout(id);
          return App.repaint();
        }
        if (e.target.closest("[data-duplicate]")) {
          const copy = Store.duplicateWorkout(id);
          App.repaint();
          return Toast.show(`Duplicated as "${copy.name}"`);
        }
        if (e.target.closest("[data-delete-workout]")) {
          const workout = JSON.parse(
            JSON.stringify(Store.state.workouts.find((w) => w.id === id)),
          );
          Store.deleteWorkout(id);
          Sound.play("remove");
          App.repaint();
          return Toast.show(`"${workout.name}" deleted`, {
            action: "Undo",
            onAction: () => {
              Store.restoreWorkout(workout);
              App.repaint();
            },
          });
        }
      }

      const openSplit = e.target.closest("[data-open-split]");
      if (openSplit) return showSplit(openSplit.dataset.openSplit);

      const planSplit = e.target.closest("[data-plan-split]");
      if (planSplit) return applySplit(planSplit.dataset.planSplit);

      if (e.target.closest("[data-open-picker]")) {
        return Picker.open((exId) => {
          const n = Store.addToDraft(exId);
          App.repaint();
          Toast.show(`${EXERCISE_BY_ID[exId].name} added — ${n} in this workout`);
        });
      }

      if (e.target.closest("[data-start]")) return Workout.start(Store.state.draft);

      if (e.target.closest("[data-save-workout]")) {
        const w = Store.saveDraft(nameInput.value);
        Sound.play("set");
        App.repaint();
        return Toast.show(`"${w.name}" saved`);
      }

      if (e.target.closest("[data-clear-draft]")) {
        const backup = JSON.parse(JSON.stringify(Store.state.draft));
        Store.clearDraft();
        Sound.play("remove");
        App.repaint();
        Toast.show("Workout cleared", {
          action: "Undo",
          onAction: () => {
            Store.setDraftName(backup.name);
            backup.items.forEach((i) => Store.addToDraft(i.exId, i));
            App.repaint();
          },
        });
      }
    });

    wireDragging(root);
  }

  function wireDragging(root) {
    const list = root.querySelector("[data-list]");
    if (!list) return;
    let dragged = null;

    list.addEventListener("dragstart", (e) => {
      dragged = e.target.closest(".build-item");
      if (!dragged) return;
      dragged.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragged.dataset.uid);
    });

    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const over = e.target.closest(".build-item");
      if (!over || over === dragged) return;
      const rect = over.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      list.insertBefore(dragged, after ? over.nextSibling : over);
    });

    list.addEventListener("dragend", () => {
      if (!dragged) return;
      dragged.classList.remove("is-dragging");
      const order = [...list.querySelectorAll(".build-item")].map((li) => li.dataset.uid);
      const items = Store.state.draft.items;
      items.sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid));
      Store.setDraftName(Store.state.draft.name); // persists the new order
      dragged = null;
      Sound.play("step");
      App.repaint();
    });
  }

  return { render, mount, applySplit };
})();
