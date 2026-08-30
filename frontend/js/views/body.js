const BodyView = (() => {
  const FIELDS = [
    { key: "weightKg", label: "Body weight", unit: true, step: 0.1 },
    { key: "chestCm", label: "Chest", suffix: "cm", step: 0.5 },
    { key: "waistCm", label: "Waist", suffix: "cm", step: 0.5 },
    { key: "armCm", label: "Arm", suffix: "cm", step: 0.5 },
    { key: "thighCm", label: "Thigh", suffix: "cm", step: 0.5 },
  ];

  const show = (entry, field) => {
    const value = entry[field.key];
    if (typeof value !== "number") return "—";
    if (field.unit) return Fmt.weight(value);
    return `${value} ${field.suffix}`;
  };

  function trendFor(field) {
    const series = Store.bodySeries(field.key);
    if (series.length < 2) return "";
    const first = series[0].value;
    const last = series[series.length - 1].value;
    const delta = +(last - first).toFixed(1);
    if (!delta) return `<span class="body-delta mono">level</span>`;
    const shown = field.unit ? Fmt.weight(Math.abs(delta)) : `${Math.abs(delta)} ${field.suffix}`;
    return `<span class="body-delta mono is-${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" : "−"}${shown}</span>`;
  }

  function summary() {
    const latest = Store.latestBody();
    if (!latest) return "";

    return `<dl class="totals mono">
      ${FIELDS.filter((f) => typeof latest[f.key] === "number")
        .map(
          (f) => `<div>
            <dt>${f.label}</dt>
            <dd>${show(latest, f)} ${trendFor(f)}</dd>
          </div>`,
        )
        .join("")}
    </dl>`;
  }

  function weightChart() {
    const series = Store.bodySeries("weightKg").map((p) => ({
      at: p.at,
      value: +Units.fromKg(p.value).toFixed(1),
    }));
    if (series.length < 2) return "";

    return `<section class="block">
      <h2 class="section-head"><span>Body weight</span><span class="mono view-sub">${series.length} entries</span></h2>
      ${Charts.line(series)}
      <div class="chart-ends mono">
        <span>${Fmt.date(series[0].at)}</span>
        <span>${Fmt.date(series[series.length - 1].at)}</span>
      </div>
    </section>`;
  }

  function entryRow(entry, previous) {
    const cells = FIELDS.filter((f) => typeof entry[f.key] === "number")
      .map((f) => {
        let move = "";
        if (previous && typeof previous[f.key] === "number") {
          const d = +(entry[f.key] - previous[f.key]).toFixed(1);
          if (d) move = `<span class="mono cell-move">${d > 0 ? "+" : "−"}${Math.abs(d)}</span>`;
        }
        return `<div><dt>${f.label}</dt><dd>${show(entry, f)}${move}</dd></div>`;
      })
      .join("");

    return `<article class="body-entry">
      <header>
        <p class="mono body-when">${Fmt.date(entry.at)} · ${Fmt.relative(entry.at)}</p>
        <button class="icon-btn" type="button" data-del-body="${entry.id}" aria-label="Delete entry">${Icons.get("trash")}</button>
      </header>
      ${entry.photo ? `<img class="body-photo" src="${entry.photo}" alt="Progress photo from ${Fmt.date(entry.at)}" loading="lazy" />` : ""}
      <dl class="body-cells mono">${cells}</dl>
      ${entry.note ? `<p class="body-note">${esc(entry.note)}</p>` : ""}
    </article>`;
  }

  function render() {
    const log = Store.state.body;

    return `
      <div class="view-head">
        <div>
          <h1 class="view-title">Body</h1>
          <p class="view-sub">Weight, measurements and photos. Entirely optional, and kept on this device.</p>
        </div>
        <button class="btn btn--primary" type="button" data-add-body>${Icons.get("plus")} Log entry</button>
      </div>

      ${summary()}
      ${weightChart()}

      ${log.length
        ? `<section class="block">
            <h2 class="section-head"><span>Entries</span><span class="mono view-sub">${log.length}</span></h2>
            <div class="body-list">${log.map((e, i) => entryRow(e, log[i + 1])).join("")}</div>
          </section>`
        : `<div class="empty">
            <p class="empty-title">Nothing logged yet</p>
            <p class="empty-sub">Weigh in every week or two and the trend becomes far more useful than any single number.</p>
            <button class="btn btn--primary" type="button" data-add-body>${Icons.get("plus")} Log your first entry</button>
          </div>`}`;
  }

  function openEditor() {
    const latest = Store.latestBody() || {};

    Sheet.open({
      title: "Log entry",
      body: `<form class="body-form" data-body-form>
        <p class="sheet-lede">Fill in whatever you track. Everything is optional.</p>
        <div class="body-grid">
          ${FIELDS.map((f) => {
            const stored = latest[f.key];
            const value =
              typeof stored === "number" ? (f.unit ? Units.fromKg(stored) : stored) : "";
            return `<label class="field">
              <span class="field-label mono">${f.label}${f.unit ? ` (${Units.label()})` : ` (${f.suffix})`}</span>
              <input class="field-input" type="number" inputmode="decimal" step="${f.step}"
                     name="${f.key}" value="${value}" placeholder="—" />
            </label>`;
          }).join("")}
        </div>

        <label class="field">
          <span class="field-label mono">Note</span>
          <input class="field-input" type="text" name="note" maxlength="120" placeholder="Felt strong, slept well…" />
        </label>

        <label class="field">
          <span class="field-label mono">Progress photo</span>
          <input class="field-input" type="file" accept="image/*" name="photo" data-photo />
          <span class="field-hint mono">Stored on this device only, never uploaded.</span>
        </label>

        <button class="btn btn--primary btn--lg" type="submit">Save entry</button>
      </form>`,
      onMount(scope) {
        const form = scope.querySelector("[data-body-form]");
        let photo = null;

        scope.querySelector("[data-photo]").addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (!file) return (photo = null);
          if (file.size > 900 * 1024) {
            e.target.value = "";
            return Toast.show("Photo is too large — try one under 900 KB");
          }
          const reader = new FileReader();
          reader.onload = () => (photo = reader.result);
          reader.readAsDataURL(file);
        });

        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const data = new FormData(form);
          const entry = {};

          FIELDS.forEach((f) => {
            const raw = data.get(f.key);
            if (raw === "" || raw === null) return;
            const n = Number(raw);
            if (!Number.isFinite(n) || n <= 0) return;
            entry[f.key] = f.unit ? +Units.toKg(n).toFixed(2) : n;
          });

          const note = (data.get("note") || "").toString().trim();
          if (note) entry.note = note;
          if (photo) entry.photo = photo;

          if (!Object.keys(entry).length) return Toast.show("Nothing to save yet");

          Store.logBody(entry);
          // bodyweight drives the strength score, so keep the profile in step
          if (entry.weightKg && Store.state.profile) {
            Store.setProfile(Object.assign({}, Store.state.profile, { weightKg: entry.weightKg }));
          }
          Sheet.close();
          Sound.play("set");
          App.repaint();
          Toast.show("Entry saved");
        });
      },
    });
  }

  function mount(root) {
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-add-body]")) return openEditor();

      const del = e.target.closest("[data-del-body]");
      if (del) {
        Store.deleteBody(del.dataset.delBody);
        Sound.play("remove");
        App.repaint();
        Toast.show("Entry removed");
      }
    });
  }

  return { render, mount };
})();
