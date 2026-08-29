const Splash = (() => {
  const SEEN = "reps.splashed";
  let done = false;
  let timer = null;

  const root = () => document.getElementById("splash");

  function markup() {
    return `
      <div class="splash-inner">
        <img class="splash-logo" src="./assets/brand/logo.svg" width="96" height="96" alt="" />
        <h1 class="splash-title">Welcome to REPS</h1>
        <p class="splash-tag">Train. Track. Progress.</p>
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

  // once per browsing session: relaunching the app replays it, navigating does not
  function shouldPlay() {
    try {
      if (sessionStorage.getItem(SEEN)) return false;
      sessionStorage.setItem(SEEN, "1");
      return true;
    } catch {
      return false;
    }
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

    timer = setTimeout(finish, 2200);
    return true;
  }

  return { play, finish, get isPlaying() { return root().classList.contains("is-on"); } };
})();
