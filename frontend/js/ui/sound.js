const Sound = (() => {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let unlocked = false;

  let enabled = localStorage.getItem("reps.sound");
  enabled = enabled === null ? true : enabled === "true";

  const MASTER = 1.7;

  let lastHover = 0;
  const HOVER_GAP_MS = 45;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      const len = Math.floor(ctx.sampleRate * 0.1);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.08;

      master = ctx.createGain();
      master.gain.value = MASTER;
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

  function env(param, peak, at, attack, decay) {
    param.setValueAtTime(0.0001, at);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
    param.exponentialRampToValueAtTime(0.0001, at + decay);
  }

  function noise({ freq, q, peak, decay, delay = 0, out }) {
    const at = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;

    const g = ctx.createGain();
    env(g.gain, peak, at, 0.001, decay);

    src.connect(bp).connect(g).connect(out || master);
    src.start(at);
    src.stop(at + decay + 0.02);
  }

  function tone({ freq, peak, attack = 0.001, decay, delay = 0, out }) {
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);

    const g = ctx.createGain();
    env(g.gain, peak, at, attack, decay);

    osc.connect(g).connect(out || master);
    osc.start(at);
    osc.stop(at + decay + 0.03);
  }

  function lowpass(freq) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    f.Q.value = 1;
    f.connect(master);
    return f;
  }

  const cues = {
    hover() {
      const now = performance.now();
      if (now - lastHover < HOVER_GAP_MS) return;
      lastHover = now;
      noise({ freq: 5400, q: 1.8, peak: 0.14, decay: 0.019 });
      tone({ freq: 2600, peak: 0.018, decay: 0.013 });
    },

    tap() {
      noise({ freq: 2200, q: 1.6, peak: 0.12, decay: 0.017 });
      noise({ freq: 3800, q: 1.6, peak: 0.1, decay: 0.021, delay: 0.024 });
    },

    step() {
      noise({ freq: 3200, q: 1.7, peak: 0.08, decay: 0.014 });
    },

    swell() {
      const lp = lowpass(2500);
      noise({ freq: 1700, q: 1.4, peak: 0.13, decay: 0.021 });
      tone({ freq: 528, peak: 0.06, attack: 0.06, decay: 0.38, out: lp });
      tone({ freq: 528, peak: 0.05, attack: 0.06, decay: 0.4, out: lp });
    },

    chime() {
      const lp = lowpass(4000);
      tone({ freq: 1046.5, peak: 0.09, attack: 0.006, decay: 0.226, out: lp });
      tone({ freq: 1568, peak: 0.08, attack: 0.006, decay: 0.266, delay: 0.09, out: lp });
    },

    tick() {
      noise({ freq: 4200, q: 2.2, peak: 0.09, decay: 0.016 });
      tone({ freq: 1180, peak: 0.03, decay: 0.05 });
    },

    set() {
      const lp = lowpass(5200);
      noise({ freq: 2400, q: 1.6, peak: 0.12, decay: 0.018 });
      tone({ freq: 784, peak: 0.07, decay: 0.12, out: lp });
      tone({ freq: 1174.7, peak: 0.06, decay: 0.18, delay: 0.07, out: lp });
    },

    rest() {
      const lp = lowpass(4000);
      tone({ freq: 880, peak: 0.09, attack: 0.004, decay: 0.16, out: lp });
      tone({ freq: 880, peak: 0.09, attack: 0.004, decay: 0.16, delay: 0.2, out: lp });
      tone({ freq: 1318.5, peak: 0.085, attack: 0.006, decay: 0.34, delay: 0.4, out: lp });
    },

    pr() {
      const lp = lowpass(5000);
      [880, 1108.7, 1318.5, 1760].forEach((f, i) =>
        tone({ freq: f, peak: 0.075, attack: 0.005, decay: 0.3, delay: i * 0.075, out: lp }),
      );
      noise({ freq: 6200, q: 1.6, peak: 0.06, decay: 0.03, delay: 0.3 });
    },

    done() {
      const lp = lowpass(4200);
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone({ freq: f, peak: 0.075, attack: 0.012, decay: 0.5, delay: i * 0.11, out: lp }),
      );
      tone({ freq: 1046.5, peak: 0.065, attack: 0.012, decay: 0.9, delay: 0.34, out: lp });
    },

    remove() {
      noise({ freq: 1400, q: 1.4, peak: 0.11, decay: 0.024 });
      tone({ freq: 392, peak: 0.05, decay: 0.13 });
    },
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
      if (v && unlocked && ensure()) cues.chime();
    },
    isEnabled: () => enabled,
  };
})();
