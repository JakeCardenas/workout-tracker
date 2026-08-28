const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

const Fmt = {
  weight(n, unit) {
    if (unit === "sec") return `${n} sec`;
    return n > 0 ? `${n} kg` : "Bodyweight";
  },
  volume(n) {
    return `${Math.round(n).toLocaleString("en-US")} kg`;
  },
  reps(n, unit) {
    return unit === "sec" ? `${n} sec` : `${n} reps`;
  },
  duration(ms) {
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  },
  clock(sec) {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  },
  date(ts) {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  },
  shortDate(ts) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },
  relative(ts) {
    const day = 86400000;
    const startOf = (t) => new Date(t).setHours(0, 0, 0, 0);
    const diff = Math.round((startOf(Date.now()) - startOf(ts)) / day);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} wk ago`;
    return Fmt.shortDate(ts);
  },
};

function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const Stepper = (() => {
  function markup({ name, value, min, max, step, label, suffix = "", wide = false }) {
    return `
      <div class="stepper${wide ? " stepper--wide" : ""}" data-stepper="${name}"
           data-min="${min}" data-max="${max}" data-step="${step}">
        <button class="step-btn" type="button" data-dir="-1" aria-label="Decrease ${label}">${Icons.get("minus")}</button>
        <span class="step-read">
          <span class="step-value" data-step-value>${value}</span><span class="step-suffix">${suffix}</span>
          <span class="step-label mono">${label}</span>
        </span>
        <button class="step-btn" type="button" data-dir="1" aria-label="Increase ${label}">${Icons.get("plus")}</button>
      </div>`;
  }

  function bump(box, dir) {
    const min = +box.dataset.min;
    const max = +box.dataset.max;
    const step = +box.dataset.step;
    const readout = box.querySelector("[data-step-value]");
    const next = Math.min(max, Math.max(min, +readout.textContent + dir * step));
    if (next === +readout.textContent) return null;
    readout.textContent = Number.isInteger(next) ? next : +next.toFixed(1);
    readout.classList.remove("is-bumped");
    void readout.offsetWidth;
    readout.classList.add("is-bumped");
    box.dispatchEvent(
      new CustomEvent("stepper", {
        bubbles: true,
        detail: { name: box.dataset.stepper, value: next },
      }),
    );
    return next;
  }

  let holdTimer = null;
  let repeatTimer = null;

  function stopHold() {
    clearTimeout(holdTimer);
    clearInterval(repeatTimer);
    holdTimer = repeatTimer = null;
  }

  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest(".step-btn");
    if (!btn) return;
    const box = btn.closest("[data-stepper]");
    const dir = +btn.dataset.dir;
    bump(box, dir);
    Sound.play("tap");
    holdTimer = setTimeout(() => {
      let speed = 110;
      repeatTimer = setInterval(() => {
        if (bump(box, dir) === null) stopHold();
      }, speed);
    }, 420);
  });

  ["pointerup", "pointercancel", "pointerleave", "blur"].forEach((evt) =>
    document.addEventListener(evt, stopHold),
  );

  function read(scope, name) {
    const box = scope.querySelector(`[data-stepper="${name}"]`);
    return box ? +box.querySelector("[data-step-value]").textContent : null;
  }

  return { markup, read };
})();

const RestPicker = {
  options: [45, 60, 90, 120, 180],
  markup(value) {
    const chips = RestPicker.options
      .map(
        (s) =>
          `<button type="button" class="rest-chip mono${s === value ? " is-on" : ""}" data-rest="${s}">${s < 120 ? `${s}s` : `${s / 60}m`}</button>`,
      )
      .join("");
    return `<div class="rest-row" data-rest-picker data-value="${value}">
      <span class="field-label mono">Rest</span>
      <div class="rest-chips">${chips}</div>
    </div>`;
  },
};

document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-rest]");
  if (!chip) return;
  const row = chip.closest("[data-rest-picker]");
  row.querySelectorAll(".rest-chip").forEach((c) => c.classList.remove("is-on"));
  chip.classList.add("is-on");
  row.dataset.value = chip.dataset.rest;
  Sound.play("tap");
  row.dispatchEvent(
    new CustomEvent("restchange", { bubbles: true, detail: { value: +chip.dataset.rest } }),
  );
});

const Sheet = (() => {
  const root = () => document.getElementById("sheet");
  let lastFocus = null;

  function open({ title = "", body = "", size = "", onMount }) {
    const el = root();
    lastFocus = document.activeElement;
    el.innerHTML = `
      <div class="sheet-scrim" data-close></div>
      <div class="sheet-panel ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <button class="sheet-close" type="button" data-close aria-label="Close">${Icons.get("close")}</button>
        <div class="sheet-body">${body}</div>
      </div>`;
    el.classList.add("is-open");
    document.body.classList.add("no-scroll");
    Sound.play("tap");
    if (onMount) onMount(el.querySelector(".sheet-body"));
    const focusable = el.querySelector("input, button:not([data-close])");
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function close() {
    const el = root();
    if (!el.classList.contains("is-open")) return;
    el.classList.add("is-closing");
    setTimeout(() => {
      el.classList.remove("is-open", "is-closing");
      el.innerHTML = "";
      document.body.classList.remove("no-scroll");
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }, 180);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return { open, close, isOpen: () => root().classList.contains("is-open") };
})();

const Toast = (() => {
  let timer = null;
  function show(message, { action, onAction } = {}) {
    const host = document.getElementById("toast");
    host.innerHTML = `<div class="toast-inner"><span>${esc(message)}</span>${
      action ? `<button type="button" class="toast-action mono" data-toast-action>${esc(action)}</button>` : ""
    }</div>`;
    host.classList.add("is-on");
    clearTimeout(timer);
    timer = setTimeout(() => host.classList.remove("is-on"), action ? 5200 : 2600);
    const btn = host.querySelector("[data-toast-action]");
    if (btn)
      btn.onclick = () => {
        host.classList.remove("is-on");
        if (onAction) onAction();
      };
  }
  return { show };
})();

function countUp(el, to, { decimals = 0, duration = 620 } = {}) {
  const start = performance.now();
  const from = 0;
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = from + (to - from) * eased;
    el.textContent = decimals
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString("en-US");
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
