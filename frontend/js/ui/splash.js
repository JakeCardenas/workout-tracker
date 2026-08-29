const Splash = (() => {
  let done = false;
  let timer = null;

  const root = () => document.getElementById("splash");

  const LETTERS = [..."REPS"].map((c) => `<span>${c}</span>`).join("");
  const WORDS = ["Train.", "Track.", "Progress."].map((w) => `<span>${w}</span>`).join(" ");

  function markup() {
    return `
      <div class="splash-inner">
        <span class="splash-sheen"></span>
        <div class="splash-badge">
          <span class="splash-ring"></span>
          <span class="splash-ring is-late"></span>
          <span class="splash-flash"></span>
          <img class="splash-logo" src="./assets/brand/logo.svg" width="96" height="96" alt="" />
        </div>
        <h1 class="splash-title">
          <span class="splash-lead">Welcome to</span>
          <span class="splash-word">${LETTERS}</span>
        </h1>
        <span class="splash-rule"></span>
        <p class="splash-tag">${WORDS}</p>
        <div class="splash-bar"><i></i></div>
        <p class="splash-by mono">Made by Jake Cardenas</p>
      </div>
      <button class="splash-skip mono" type="button" data-splash-skip>Skip</button>`;
  }

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    const el = root();
    el.classList.add("is-leaving");
    document.body.classList.remove("is-splashing");
    setTimeout(() => {
      el.classList.remove("is-on", "is-leaving");
      el.innerHTML = "";
    }, 420);
  }

  // Plays on every launch, not once per session: opening the app is the moment
  // the intro is for, and a reload is an open. Anyone in a hurry can skip it.
  function shouldPlay() {
    return !matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function play() {
    if (!shouldPlay()) return false;
    const el = root();
    if (el.classList.contains("is-on")) return false;
    done = false;
    clearTimeout(timer);
    el.classList.remove("is-leaving");
    el.innerHTML = markup();
    el.classList.add("is-on");
    document.body.classList.add("is-splashing");
    Sound.launch();

    const skip = () => finish();
    el.addEventListener("click", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });

    timer = setTimeout(finish, 2800);
    return true;
  }

  // An installed app is resumed, not reloaded. Tapping the home-screen icon
  // brings back the page that was already open, so DOMContentLoaded never fires
  // a second time and the intro would play once, on the day it was installed.
  // A long spell in the background counts as an open instead.
  const AWAY = 45000;
  let hiddenAt = 0;

  const busy = () => Boolean(document.querySelector(".session.is-on, .sheet.is-open"));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (!hiddenAt || Date.now() - hiddenAt < AWAY) return;
    hiddenAt = 0;
    if (!busy()) play();
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted && !busy()) play();
  });

  return { play, finish, get isPlaying() { return root().classList.contains("is-on"); } };
})();
