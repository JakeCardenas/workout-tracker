const Gate = (() => {
  const SKIPPED = "reps.guest.v1";
  const cloud = () => Api.reachable();

  function current() {
    return Api.signedIn() ? { id: Api.user.id, name: Api.user.email } : null;
  }

  const guest = () => localStorage.getItem(SKIPPED) === "true";

  function root() {
    return document.getElementById("gate");
  }

  function form(mode) {
    const creating = mode === "create";
    const nameField = cloud()
      ? `<label class="field">
           <span class="field-label mono">Email</span>
           <input class="text-input" type="email" name="email" autocomplete="email"
                  required placeholder="you@example.com" />
         </label>`
      : `<label class="field">
           <span class="field-label mono">Name</span>
           <input class="text-input" type="text" name="email" autocomplete="username"
                  required placeholder="What should we call you?" />
         </label>`;

    return `
      <form class="gate-form" data-gate-form novalidate>
        ${nameField}
        <label class="field">
          <span class="field-label mono">Password</span>
          <input class="text-input" type="password" name="password"
                 autocomplete="${creating ? "new-password" : "current-password"}"
                 required minlength="8" placeholder="At least 8 characters" />
        </label>
        <p class="auth-error mono" data-gate-error hidden></p>
        <button class="btn btn--primary btn--block btn--lg" type="submit" data-gate-submit>
          ${creating ? "Create account" : "Sign in"}
        </button>
      </form>
      <div class="gate-alt">
        <button class="link-btn mono" type="button" data-gate-swap>
          ${creating ? "I already have an account" : "Create an account"}
        </button>
        <button class="link-btn mono" type="button" data-gate-skip>Keep training without an account</button>
      </div>`;
  }

  function render(mode) {
    root().innerHTML = `
      <div class="gate-panel">
        <div class="gate-brand">
          <span class="gate-logo mono">reps<span class="dot">.</span></span>
          <h1 class="gate-title">Train smarter.<br />Track every set.</h1>
          <p class="gate-sub">${cloud()
            ? "Sign in and your workouts follow you to any device."
            : "Every set you log is saved right here on this device."}</p>
        </div>
        ${cloud() ? form(mode) : offlineNote()}
      </div>`;
    wire(mode);
  }

  function wire(mode) {
    const scope = root();

    scope.querySelectorAll("[data-gate-skip]").forEach((btn) =>
      btn.addEventListener("click", () => {
        localStorage.setItem(SKIPPED, "true");
        Store.mount(null);
        close();
        Sound.play("swell");
        App.repaint();
      }),
    );

    const formEl = scope.querySelector("[data-gate-form]");
    if (!formEl) return;

    const error = scope.querySelector("[data-gate-error]");
    const submit = scope.querySelector("[data-gate-submit]");

    scope
      .querySelector("[data-gate-swap]")
      .addEventListener("click", () => render(mode === "create" ? "signin" : "create"));

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const who = formEl.email.value.trim();
      const password = formEl.password.value;

      error.hidden = true;
      submit.disabled = true;
      submit.textContent = mode === "create" ? "Creating…" : "Signing in…";

      try {
        const user =
          mode === "create"
            ? await Api.register(who, password)
            : await Api.login(who, password);

        await Sync.adopt();
        Sync.refreshChrome();
        localStorage.removeItem(SKIPPED);
        close();
        Sound.play("chime");
        App.repaint();
        Toast.show(mode === "create" ? `Welcome, ${user.email}` : `Welcome back, ${user.email}`);
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = mode === "create" ? "Create account" : "Sign in";
      }
    });
  }

  function offlineNote() {
    return `
      <div class="gate-offline">
        <button class="btn btn--primary btn--block btn--lg" type="button" data-gate-skip>Start training</button>
      </div>`;
  }

  function open(mode) {
    root().classList.add("is-on");
    document.body.classList.add("no-scroll");
    render(mode || "signin");
  }

  function close() {
    root().classList.remove("is-on");
    root().innerHTML = "";
    document.body.classList.remove("no-scroll");
  }

  async function signOut() {
    await Api.logout();
    localStorage.removeItem(SKIPPED);
    Store.mount(null);
    Sync.refreshChrome();
    App.repaint();
    open("signin");
  }

  async function start() {
    await Api.probe();
    Sync.refreshChrome();

    if (Api.signedIn()) {
      Store.mount(Api.user.id);
      try {
        const remote = await Api.pull();
        if (remote.state) Store.replace(remote.state);
      } catch {
        Sync.setStatus("offline");
      }
      App.repaint();
      return false;
    }

    if (guest()) return false;
    open("signin");
    return true;
  }

  return { start, open, close, current, signOut, guest };
})();
