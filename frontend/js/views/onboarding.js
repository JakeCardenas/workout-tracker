// Five short questions instead of one long form. Draft lives here until the
// last step so a half-finished answer never overwrites a saved profile.
const Onboarding = (() => {
  const STEPS = ["About you", "Experience", "Goal", "Schedule", "Where"];
  let step = 0;
  let draft = {};

  const cmToFtIn = (cm) => {
    const total = Math.round(cm / 2.54);
    return { ft: Math.floor(total / 12), inch: total % 12 };
  };

  function progress() {
    return `<div class="wiz-progress" role="progressbar" aria-valuenow="${step + 1}" aria-valuemin="1" aria-valuemax="${STEPS.length}">
      ${STEPS.map((label, i) => `<span class="wiz-dot${i <= step ? " is-on" : ""}" title="${label}"></span>`).join("")}
    </div>`;
  }

  function optionList(items, key) {
    return `<div class="wiz-options">
      ${items
        .map(
          (o) => `<button class="wiz-option${draft[key] === o.id ? " is-on" : ""}" type="button" data-set="${key}" data-value="${o.id}">
            <span class="wiz-option-name">${o.id}</span>
            <span class="wiz-option-note">${o.note}</span>
          </button>`,
        )
        .join("")}
    </div>`;
  }

  function stepBody() {
    const lb = Units.isLb();

    if (step === 0) {
      const h = draft.heightCm ? (lb ? cmToFtIn(draft.heightCm) : { cm: Math.round(draft.heightCm) }) : null;
      return `
        <h2 class="wiz-q">A little about you</h2>
        <p class="wiz-sub">Used for bodyweight-relative strength later. Nothing is judged and nothing leaves this device.</p>
        <div class="you-grid">
          <label class="field">
            <span class="field-label mono">Age</span>
            <input class="text-input" type="number" name="age" min="13" max="99" placeholder="21" value="${draft.age || ""}" />
          </label>
          ${lb
            ? `<label class="field"><span class="field-label mono">Height</span>
                 <span class="split-input">
                   <input class="text-input" type="number" name="ft" min="3" max="8" placeholder="ft" value="${h ? h.ft : ""}" />
                   <input class="text-input" type="number" name="inch" min="0" max="11" placeholder="in" value="${h ? h.inch : ""}" />
                 </span></label>`
            : `<label class="field"><span class="field-label mono">Height (cm)</span>
                 <input class="text-input" type="number" name="cm" min="120" max="230" placeholder="170" value="${h ? h.cm : ""}" /></label>`}
          <label class="field">
            <span class="field-label mono">Weight (${Units.label()})</span>
            <input class="text-input" type="number" name="weight" min="30" max="400" step="0.5"
                   placeholder="${lb ? 155 : 70}" value="${draft.weightKg ? Units.fromKg(draft.weightKg) : ""}" />
          </label>
        </div>`;
    }

    if (step === 1) {
      return `<h2 class="wiz-q">How much training experience do you have?</h2>
        <p class="wiz-sub">This decides how demanding a split we suggest.</p>
        ${optionList(EXPERIENCE, "experience")}`;
    }

    if (step === 2) {
      return `<h2 class="wiz-q">What are you training for?</h2>
        <p class="wiz-sub">It shapes the rep ranges we start you on.</p>
        ${optionList(GOALS, "goal")}`;
    }

    if (step === 3) {
      return `<h2 class="wiz-q">How many days can you train?</h2>
        <p class="wiz-sub">Be honest — a plan you can keep beats a plan you admire.</p>
        <div class="wiz-days">
          ${[2, 3, 4, 5, 6]
            .map((d) => `<button class="wiz-day${draft.days === d ? " is-on" : ""}" type="button" data-set="days" data-value="${d}">
              <span class="wiz-day-n">${d}</span><span class="mono">days</span></button>`)
            .join("")}
        </div>`;
    }

    return `<h2 class="wiz-q">Where do you train?</h2>
      <p class="wiz-sub">We only suggest lifts you can actually do.</p>
      ${optionList(PLACES, "place")}
      ${draft.place
        ? `<div class="wiz-kit">
            <span class="field-label mono">Equipment available</span>
            <div class="chips">
              ${EQUIPMENT.map((eq) => {
                const on = (draft.equipment || KIT[draft.place]).includes(eq);
                return `<button class="chip mono${on ? " is-on" : ""}" type="button" data-kit="${eq}">${eq}</button>`;
              }).join("")}
            </div>
          </div>`
        : ""}`;
  }

  function canAdvance() {
    if (step === 0) return true;
    if (step === 1) return Boolean(draft.experience);
    if (step === 2) return Boolean(draft.goal);
    if (step === 3) return Boolean(draft.days);
    return Boolean(draft.place);
  }

  function render() {
    return `
      <div class="wiz">
        ${progress()}
        <div class="wiz-body" data-wiz-body>${stepBody()}</div>
        <div class="wiz-nav">
          ${step > 0 ? `<button class="btn" type="button" data-wiz-back>${Icons.get("back")} Back</button>` : `<span></span>`}
          <button class="btn btn--primary" type="button" data-wiz-next ${canAdvance() ? "" : "disabled"}>
            ${step === STEPS.length - 1 ? "See my plan" : "Continue"}
          </button>
        </div>
      </div>`;
  }

  function readStepOne(scope) {
    const f = scope.querySelector(".you-grid");
    if (!f) return;
    const num = (n) => {
      const el = f.querySelector(`[name="${n}"]`);
      return el && el.value !== "" ? Number(el.value) : null;
    };
    draft.age = num("age");
    draft.heightCm = Units.isLb()
      ? num("ft") || num("inch")
        ? Math.round(((num("ft") || 0) * 12 + (num("inch") || 0)) * 2.54)
        : null
      : num("cm");
    const wv = num("weight");
    draft.weightKg = wv ? Units.toKg(wv) : null;
  }

  function open(existing) {
    step = 0;
    draft = Object.assign({}, existing || {});
    if (draft.experience === "New to Training") draft.experience = "New to Training";

    Sheet.open({
      title: "Find your plan",
      size: "sheet-panel--wide",
      body: render(),
      onMount(scope) {
        const rerender = () => {
          const host = scope.querySelector(".wiz");
          host.outerHTML = render();
          wire(scope);
        };

        function wire(root) {
          root.querySelectorAll("[data-set]").forEach((b) =>
            b.addEventListener("click", () => {
              const raw = b.dataset.value;
              draft[b.dataset.set] = b.dataset.set === "days" ? Number(raw) : raw;
              if (b.dataset.set === "place") draft.equipment = KIT[raw].slice();
              Sound.play("tap");
              rerender();
            }),
          );

          root.querySelectorAll("[data-kit]").forEach((b) =>
            b.addEventListener("click", () => {
              const eq = b.dataset.kit;
              const list = draft.equipment || [];
              draft.equipment = list.includes(eq) ? list.filter((x) => x !== eq) : list.concat(eq);
              Sound.play("step");
              rerender();
            }),
          );

          const back = root.querySelector("[data-wiz-back]");
          if (back)
            back.addEventListener("click", () => {
              if (step === 0) return;
              readStepOne(root);
              step -= 1;
              rerender();
            });

          root.querySelector("[data-wiz-next]").addEventListener("click", () => {
            readStepOne(root);
            if (step < STEPS.length - 1) {
              step += 1;
              Sound.play("tap");
              return rerender();
            }
            // map the friendlier first option onto the level the coach understands
            const level = draft.experience === "New to Training" ? "Beginner" : draft.experience;
            Store.setProfile(Object.assign({}, draft, { experience: level, statedLevel: draft.experience }));
            Sheet.close();
            Sound.play("chime");
            App.repaint();
            Toast.show("Plan ready");
          });
        }

        wire(scope);
      },
    });
  }

  return { open };
})();
