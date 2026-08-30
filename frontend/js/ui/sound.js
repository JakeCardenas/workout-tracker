const Sound = (() => {
  let ctx = null;
  let bus = null;
  let unlocked = false;

  let enabled = localStorage.getItem("reps.sound");
  enabled = enabled === null ? true : enabled === "true";

  // which cues belong to which switch in Settings, so one toggle can silence a
  // whole category without touching the rest
  const CHANNEL = {
    rest: "restSound",
    restReady: "restSound",
    tick: "countdown",
    countdown: "countdown",
    pr: "celebrate",
    done: "celebrate",
    launch: "celebrate",
  };

  function allows(name) {
    if (!enabled) return false;
    const s = Store.state.settings;
    const channel = CHANNEL[name];
    if (channel) return s[channel] !== false;
    return s.cues !== false;
  }

  let lastHover = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      // one soft ceiling for everything, so nothing ever spikes
      const lid = ctx.createDynamicsCompressor();
      lid.threshold.value = -18;
      lid.knee.value = 12;
      lid.ratio.value = 6;
      lid.attack.value = 0.004;
      lid.release.value = 0.12;

      const warmth = ctx.createBiquadFilter();
      warmth.type = "lowpass";
      warmth.frequency.value = 3200;
      warmth.Q.value = 0.6;

      bus = ctx.createGain();
      bus.gain.value = 0.55;
      bus.connect(warmth).connect(lid).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  ["pointerdown", "keydown", "touchstart"].forEach((evt) =>
    window.addEventListener(
      evt,
      () => {
        if (unlocked) return;
        unlocked = true;
        ensure();
      },
      { once: true, passive: true },
    ),
  );

  // one shape for every cue: a sine with a slow edge, so nothing clicks
  function note(freq, { gain = 0.05, at = 0, hold = 0.09, fade = 0.14, type = "sine" } = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.setValueAtTime(gain, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + fade);

    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + hold + fade + 0.02);
  }

  const cues = {
    hover() {
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      note(1320, { gain: 0.012, hold: 0.01, fade: 0.05 });
    },

    tap: () => note(660, { gain: 0.038, hold: 0.02, fade: 0.09 }),

    step: () => note(880, { gain: 0.022, hold: 0.012, fade: 0.05 }),

    swell() {
      note(392, { gain: 0.03, hold: 0.06, fade: 0.34 });
      note(587.33, { gain: 0.022, at: 0.05, hold: 0.06, fade: 0.32 });
    },

    chime() {
      note(880, { gain: 0.04, hold: 0.05, fade: 0.24 });
      note(1174.66, { gain: 0.03, at: 0.08, hold: 0.05, fade: 0.28 });
    },

    tick: () => note(1046.5, { gain: 0.026, hold: 0.012, fade: 0.05 }),

    // a set is banked: a small, certain two-note step up
    set() {
      note(587.33, { gain: 0.045, hold: 0.04, fade: 0.14 });
      note(880, { gain: 0.038, at: 0.09, hold: 0.05, fade: 0.22 });
    },

    // rest is over: same interval, opened out so it reads as an alert
    rest() {
      note(659.25, { gain: 0.045, hold: 0.06, fade: 0.18 });
      note(987.77, { gain: 0.04, at: 0.16, hold: 0.08, fade: 0.32 });
    },

    pr() {
      [587.33, 880, 1174.66].forEach((f, i) =>
        note(f, { gain: 0.04, at: i * 0.1, hold: 0.06, fade: 0.4 }),
      );
    },

    done() {
      [392, 587.33, 784].forEach((f, i) =>
        note(f, { gain: 0.042, at: i * 0.13, hold: 0.1, fade: 0.7 }),
      );
    },

    remove: () => note(392, { gain: 0.032, hold: 0.02, fade: 0.12 }),

    // a workout opening: two low notes settling, nothing triumphant yet
    begin() {
      note(196, { gain: 0.04, hold: 0.06, fade: 0.3, type: "triangle" });
      note(293.66, { gain: 0.03, at: 0.1, hold: 0.06, fade: 0.36 });
    },

    // an exercise finished: a quiet close, one step below the set cue
    exercise() {
      note(523.25, { gain: 0.036, hold: 0.05, fade: 0.2 });
      note(783.99, { gain: 0.026, at: 0.1, hold: 0.06, fade: 0.3 });
    },

    // the last three seconds of rest, climbing so the final one lands
    countdown(step) {
      const pitch = [659.25, 739.99, 830.61][Math.min(2, 3 - step)] || 659.25;
      note(pitch, { gain: 0.026 + step * 0.004, hold: 0.02, fade: 0.09 });
    },

    // the opening: a low landing, an open fifth, then one bright tail
    launch() {
      note(146.83, { gain: 0.05, at: 0.1, hold: 0.05, fade: 0.5, type: "triangle" });
      note(293.66, { gain: 0.034, at: 0.84, hold: 0.07, fade: 0.5 });
      note(440, { gain: 0.028, at: 0.92, hold: 0.07, fade: 0.55 });
      note(587.33, { gain: 0.03, at: 1.28, hold: 0.06, fade: 0.6 });
      note(880, { gain: 0.018, at: 1.4, hold: 0.06, fade: 0.8 });
    },
  };

  function play(name, arg) {
    if (!allows(name) || !unlocked) return;
    if (!ensure()) return;
    if (cues[name]) cues[name](arg);
  }

  function remember(v) {
    enabled = v;
    localStorage.setItem("reps.sound", v ? "true" : "false");
  }

  let launched = false;
  let launchUntil = 0;

  // The intro runs before any gesture, and a phone will not make a sound until
  // the screen has been touched. So this gets called twice: once when the intro
  // starts, and again on the first touch. Whichever attempt the browser allows
  // through is the only one that sounds, and neither fires after the intro ends.
  function launch() {
    if (!allows("launch") || launched || !ensure()) return false;
    if (!launchUntil) launchUntil = performance.now() + 4000;
    if (performance.now() > launchUntil) return false;

    if (ctx.state === "running") {
      launched = true;
      cues.launch();
      return true;
    }
    ctx.resume().then(() => {
      if (launched || ctx.state !== "running") return;
      if (performance.now() > launchUntil) return;
      launched = true;
      cues.launch();
    }, () => {});
    return false;
  }

  function armLaunch() {
    launched = false;
    launchUntil = 0;
  }

  return {
    play,
    launch,
    armLaunch,
    restore: remember,
    setEnabled(v) {
      remember(v);
      if (v && unlocked && ensure()) cues.chime();
    },
    isEnabled: () => enabled,
  };
})();
