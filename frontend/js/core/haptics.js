const Haptics = (() => {
  const can = () => "vibrate" in navigator;

  const PATTERNS = {
    tap: 8,
    set: [14, 40, 22],
    rest: [18, 60, 18, 60, 34],
    tick: 6,
    pr: [26, 50, 26, 50, 70],
    done: [30, 70, 30, 70, 90],
    warn: [10, 40, 10],
  };

  function fire(name) {
    if (!can() || !Store.state.settings.haptics) return;
    const pattern = PATTERNS[name];
    if (!pattern) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // some browsers expose vibrate and then refuse to use it
    }
  }

  return { fire, can };
})();
