const Sound = (() => {
  let ctx = null;
  let master = null;
  let unlocked = false;

  let enabled = localStorage.getItem("reps.sound");
  enabled = enabled === null ? true : enabled === "true";

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.09;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(limiter).connect(ctx.destination);
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

  function tone({ freq, peak = 0.1, attack = 0.004, decay = 0.18, delay = 0, type = "sine", slideTo }) {
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + decay);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);

    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + decay + 0.03);
  }

  function click(peak = 0.05) {
    const at = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = peak;
    src.connect(bp).connect(g).connect(master);
    src.start(at);
  }

  const cues = {
    tap: () => click(0.035),

    tick: () => tone({ freq: 1180, peak: 0.045, decay: 0.05, type: "triangle" }),

    set: () => {
      tone({ freq: 660, peak: 0.09, decay: 0.11 });
      tone({ freq: 990, peak: 0.07, decay: 0.16, delay: 0.07 });
    },

    rest: () => {
      tone({ freq: 880, peak: 0.1, decay: 0.14 });
      tone({ freq: 880, peak: 0.1, decay: 0.14, delay: 0.18 });
      tone({ freq: 1320, peak: 0.09, decay: 0.26, delay: 0.36 });
    },

    pr: () => {
      [880, 1108, 1318, 1760].forEach((f, i) =>
        tone({ freq: f, peak: 0.08, decay: 0.3, delay: i * 0.075 }),
      );
    },

    done: () => {
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone({ freq: f, peak: 0.08, attack: 0.01, decay: 0.5, delay: i * 0.11 }),
      );
      tone({ freq: 1046.5, peak: 0.07, attack: 0.01, decay: 0.9, delay: 0.34 });
    },

    remove: () => tone({ freq: 420, peak: 0.07, decay: 0.13, slideTo: 220, type: "triangle" }),
  };

  function play(name) {
    if (!enabled || !unlocked) return;
    if (!ensure()) return;
    if (cues[name]) cues[name]();
  }

  function remember(v) {
    enabled = v;
    localStorage.setItem("reps.sound", v ? "true" : "false");
  }

  return {
    play,
    restore: remember,
    setEnabled(v) {
      remember(v);
      if (v && unlocked && ensure()) cues.set();
    },
    isEnabled: () => enabled,
  };
})();
