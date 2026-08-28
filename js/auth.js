const Auth = (() => {
  const STASH = "reps.prelogin.v1";
  let syncing = false;
  let queued = false;
  let timer = null;

  const enabled = () => CONFIG.ready();
  const signedIn = () => enabled() && Api.signedIn();

  function hasLocalData(state) {
    return Boolean(
      state.history.length || state.workouts.length || state.favorites.length,
    );
  }

  async function adopt() {
    const remote = await Api.pull();
    const local = Store.state;

    if (!remote || !remote.state || !hasLocalData(remote.state)) {
      await Api.push(local);
      return { direction: "up" };
    }

    if (hasLocalData(local)) {
      localStorage.setItem(STASH, JSON.stringify(local));
      Store.replace(remote.state);
      return { direction: "down", stashed: true };
    }

    Store.replace(remote.state);
    return { direction: "down" };
  }

  function schedulePush() {
    if (!signedIn()) return;
    clearTimeout(timer);
    timer = setTimeout(run, 1200);
  }

  async function run() {
    if (!signedIn()) return;
    if (syncing) {
      queued = true;
      return;
    }
    syncing = true;
    setStatus("saving");
    try {
      await Api.push(Store.state);
      setStatus("saved");
    } catch (err) {
      setStatus("offline");
    }
    syncing = false;
    if (queued) {
      queued = false;
      schedulePush();
    }
  }

  function setStatus(state) {
    document.querySelectorAll("[data-sync]").forEach((el) => {
      el.dataset.sync = state;
      el.textContent =
        state === "saving" ? "Saving…" : state === "offline" ? "Offline — saved here" : "Synced";
    });
  }

  function label() {
    if (!enabled()) return "Saved on this device";
    if (!signedIn()) return "Sign in to sync";
    return Api.user.email;
  }

  function refreshChrome() {
    document.querySelectorAll("[data-account]").forEach((el) => {
      el.textContent = label();
      el.classList.toggle("is-live", signedIn());
    });
  }

  function form(mode) {
    const creating = mode === "create";
    return `
      <header class="detail-head">
        <div>
          <h2 class="detail-title">${creating ? "Create an account" : "Sign in"}</h2>
          <p class="detail-meta mono">Your workouts follow you to any device.</p>
        </div>
      </header>
      <form class="auth-form" data-auth-form novalidate>
        <label class="field">
          <span class="field-label mono">Email</span>
          <input class="text-input" type="email" name="email" autocomplete="email"
                 required placeholder="you@example.com" />
        </label>
        <label class="field">
          <span class="field-label mono">Password</span>
          <input class="text-input" type="password" name="password"
                 autocomplete="${creating ? "new-password" : "current-password"}"
                 required minlength="8" placeholder="At least 8 characters" />
        </label>
        <p class="auth-error mono" data-auth-error hidden></p>
        <button class="btn btn--primary btn--block" type="submit" data-auth-submit>
          ${creating ? "Create account" : "Sign in"}
        </button>
        <button class="link-btn mono" type="button" data-auth-swap>
          ${creating ? "I already have an account" : "Create an account instead"}
        </button>
      </form>`;
  }

  function openSheet(mode = "signin") {
    if (!enabled()) {
      return Sheet.open({
        title: "Sync",
        body: `
          <header class="detail-head">
            <div>
              <h2 class="detail-title">Sync is not set up</h2>
              <p class="detail-meta mono">This copy is running entirely on your device.</p>
            </div>
          </header>
          <p class="detail-summary">Create a free Supabase project, run <code>db/schema.sql</code>,
          then paste the project URL and anon key into <code>js/config.js</code>. Accounts and
          cloud backup switch on by themselves once those two values are set.</p>
          <div class="confirm-actions"><button class="btn" type="button" data-close>Close</button></div>`,
      });
    }

    Sheet.open({
      title: mode === "create" ? "Create an account" : "Sign in",
      body: form(mode),
      onMount(scope) {
        wireForm(scope, mode);
      },
    });
  }

  function wireForm(scope, mode) {
    const formEl = scope.querySelector("[data-auth-form]");
    const error = scope.querySelector("[data-auth-error]");
    const submit = scope.querySelector("[data-auth-submit]");

    scope.querySelector("[data-auth-swap]").addEventListener("click", () => {
      const next = mode === "create" ? "signin" : "create";
      scope.innerHTML = form(next);
      wireForm(scope, next);
    });

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = formEl.email.value.trim();
      const password = formEl.password.value;

      error.hidden = true;
      submit.disabled = true;
      submit.textContent = mode === "create" ? "Creating…" : "Signing in…";

      try {
        if (mode === "create") {
          const res = await Api.signUp(email, password);
          if (res.pending) {
            Sheet.close();
            Sound.play("chime");
            return Toast.show("Check your email to confirm the account");
          }
        } else {
          await Api.signIn(email, password);
        }

        const moved = await adopt();
        Sheet.close();
        Sound.play("chime");
        refreshChrome();
        setStatus("saved");
        App.repaint();

        if (moved.direction === "down" && moved.stashed) {
          Toast.show("Loaded your account's workouts", {
            action: "Use this device's instead",
            onAction: restoreStash,
          });
        } else {
          Toast.show(moved.direction === "up" ? "This device's data is now backed up" : "Welcome back");
        }
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = mode === "create" ? "Create account" : "Sign in";
      }
    });
  }

  async function restoreStash() {
    const raw = localStorage.getItem(STASH);
    if (!raw) return;
    Store.replace(JSON.parse(raw));
    localStorage.removeItem(STASH);
    App.repaint();
    await run();
    Toast.show("Kept this device's workouts");
  }

  async function signOut() {
    await Api.signOut();
    localStorage.removeItem(STASH);
    refreshChrome();
    setStatus("saved");
    App.repaint();
    Toast.show("Signed out — your data stays on this device");
  }

  function start() {
    refreshChrome();
    if (!signedIn()) return;
    setStatus("saving");
    Api.pull()
      .then((remote) => {
        if (remote && remote.state && hasLocalData(remote.state)) Store.replace(remote.state);
        setStatus("saved");
        App.repaint();
      })
      .catch(() => setStatus("offline"));
  }

  return { enabled, signedIn, openSheet, signOut, start, schedulePush, label, refreshChrome };
})();
