const Sync = (() => {
  const STASH = "reps.prelogin.v1";
  let syncing = false;
  let queued = false;
  let timer = null;

  const online = () => Api.reachable();
  const signedIn = () => Api.signedIn();

  const hasData = (state) =>
    Boolean(state && (state.history.length || state.workouts.length || state.favorites.length));

  async function adopt() {
    const remote = await Api.pull();
    const local = Store.state;

    if (!hasData(remote.state)) {
      await Api.push(local);
      return { direction: "up" };
    }

    if (hasData(local)) {
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
    } catch {
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
    const who = typeof Gate !== "undefined" && Gate.current();
    if (who) return who.name;
    return online() ? "Sign in" : "Saved on this device";
  }

  function refreshChrome() {
    const who = typeof Gate !== "undefined" && Gate.current();
    document.querySelectorAll("[data-account]").forEach((el) => {
      el.textContent = label();
      el.classList.toggle("is-live", Boolean(who));
    });
    document.querySelectorAll("[data-sync]").forEach((el) => {
      el.hidden = !signedIn();
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

  return { online, signedIn, adopt, schedulePush, setStatus, label, refreshChrome, restoreStash };
})();
