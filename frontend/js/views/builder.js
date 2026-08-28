function estimateDuration(items) {
  const seconds = items.reduce((total, i) => {
    const timed = EXERCISE_BY_ID[i.exId].unit === "sec";
    const working = timed ? i.reps : i.reps * 3;
    return total + i.sets * (working + i.rest);
  }, 0);
  return seconds * 1000;
}

function draftTotals(items) {
  const sets = items.reduce((t, i) => t + i.sets, 0);
  const reps = items.reduce((t, i) => t + i.sets * i.reps, 0);
  const volume = items.reduce((t, i) => t + i.sets * i.reps * i.weight, 0);
  return { sets, reps, volume, duration: estimateDuration(items) };
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
        <button class="btn btn--primary btn--block" type="button" data-save>${Icons.get("check")} Save changes</button>
      </section>`,
    onMount(scope) {
      scope.querySelector("[data-save]").addEventListener("click", () => {
        const config = scope.querySelector("[data-config]");
        onSave({
          sets: Stepper.read(config, "sets"),
          reps: Stepper.read(config, "reps"),
          weight: Units.toKg(Stepper.read(config, "weight")),
          rest: +config.querySelector("[data-rest-picker]").dataset.value,
        });
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
          <p class="build-sum mono">${item.sets} × ${item.reps}${ex.unit === "sec" ? "s" : ""} · ${Fmt.weight(item.weight, ex.unit)} · ${item.rest}s rest</p>
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

      <section class="builder">
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

        ${items.length
          ? `<ol class="build-list" data-list>${items.map((i, n) => itemRow(i, n, items.length)).join("")}</ol>
             <div class="builder-actions">
               <button class="btn btn--primary btn--lg" type="button" data-start>${Icons.get("play")} Start Workout</button>
               <button class="btn" type="button" data-save-workout>${Icons.get("check")} ${draft.savedId ? "Update" : "Save"} workout</button>
               <a class="btn" href="#/library">${Icons.get("plus")} Add exercise</a>
               <button class="link-btn mono" type="button" data-clear-draft>Clear</button>
             </div>`
          : `<div class="empty empty--builder">
               <p class="empty-title">Your workout is empty</p>
               <p class="empty-sub">Add exercises from the library, or start from a template below.</p>
               <a class="btn btn--primary" href="#/library">${Icons.get("library")} Browse exercises</a>
             </div>`}
      </section>

      <section class="block">
        <h2 class="section-head"><span>Templates</span></h2>
        <div class="template-grid">
          ${TEMPLATES.map(
            (t) => `<button class="template-card" type="button" data-template="${t.id}">
              <span class="template-name">${t.name}</span>
              <span class="template-note mono">${t.note}</span>
              <span class="template-count mono">${t.exercises.length} exercises</span>
            </button>`,
          ).join("")}
        </div>
      </section>

      ${saved.length
        ? `<section class="block">
            <h2 class="section-head"><span>Saved workouts</span><span class="group-count mono">${saved.length}</span></h2>
            <div class="saved-grid">${saved.map(savedCard).join("")}</div>
          </section>`
        : ""}`;
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

      const template = e.target.closest("[data-template]");
      if (template) {
        const t = TEMPLATES.find((x) => x.id === template.dataset.template);
        Store.clearDraft();
        Store.setDraftName(t.name);
        t.exercises.forEach((id) => Store.addToDraft(id));
        Sound.play("set");
        App.repaint();
        return Toast.show(`${t.name} loaded — edit anything you like`);
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

  return { render, mount };
})();
