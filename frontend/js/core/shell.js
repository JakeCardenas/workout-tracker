const Shell = (() => {
  let installEvent = null;
  let waitingWorker = null;

  const standalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const canInstall = () => Boolean(installEvent);

  function watchInstall() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      installEvent = e;
      document.body.classList.add("can-install");
      App.syncShell();
    });

    window.addEventListener("appinstalled", () => {
      installEvent = null;
      document.body.classList.remove("can-install");
      App.syncShell();
      Toast.show("Installed — you can open it from your home screen now");
    });
  }

  async function install() {
    if (!installEvent) return false;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    document.body.classList.remove("can-install");
    App.syncShell();
    return outcome === "accepted";
  }

  function watchConnection() {
    const paint = () => {
      const off = !navigator.onLine;
      document.body.classList.toggle("is-offline", off);
      document.querySelectorAll("[data-offline-bar]").forEach((el) => {
        el.hidden = !off;
      });
    };
    window.addEventListener("online", () => {
      paint();
      Toast.show("Back online");
    });
    window.addEventListener("offline", paint);
    paint();
  }

  // a new worker only takes over once it is told to, so the running app is
  // never swapped out from underneath you mid-set
  function watchUpdates(reg) {
    const offer = (worker) => {
      waitingWorker = worker;
      Toast.show("A new version is ready", {
        action: "Update",
        onAction: applyUpdate,
      });
    };

    if (reg.waiting) offer(reg.waiting);

    reg.addEventListener("updatefound", () => {
      const next = reg.installing;
      if (!next) return;
      next.addEventListener("statechange", () => {
        if (next.state === "installed" && navigator.serviceWorker.controller) offer(next);
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  function applyUpdate() {
    if (!waitingWorker) return location.reload();
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  const hasUpdate = () => Boolean(waitingWorker);

  async function checkForUpdate() {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "none";
    await reg.update();
    return reg.waiting ? "ready" : "current";
  }

  function start() {
    watchInstall();
    watchConnection();
    if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((reg) => {
        watchUpdates(reg);
        // an installed app can sit suspended for weeks without ever asking
        // whether there is a newer build, so every return to the foreground does
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  }

  return { start, install, canInstall, standalone, applyUpdate, hasUpdate, checkForUpdate };
})();
