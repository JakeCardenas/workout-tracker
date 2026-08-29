const Splash = (() => {
    let done = false;
  let timer = null;

  const root = () => document.getElementById("splash");

  const LETTERS = [..."REPS"].map((c) => `<span>${c}</span>`).join("");
  const WORDS = ["Train.", "Track.", "Progress."].map((w) => `<span>${w}</span>`).join(" ");

  function markup() {
    return `
      <div class="splash-inner">
        <div class="splash-badge">
          <span class="splash-ring"></span>
          <span class="splash-ring is-late"></span>
          <img class="splash-logo" src="./assets/brand/logo.svg" width="96" height="96" alt="" />
        </div>
        <h1 class="splash-title">
          <span class="splash-lead">Welcome to</span>
          <span class="splash-word">${LETTERS}</span>
        </h1>
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
    el.innerHTML = markup();
    el.classList.add("is-on");
    document.body.classList.add("is-splashing");

    const skip = () => finish();
    el.addEventListener("click", skip, { once: true });
    window.addEventListener("keydown", skip, { once: true });

    timer = setTimeout(finish, 2800);
    return true;
  }

  return { play, finish, get isPlaying() { return root().classList.contains("is-on"); } };
})();
