// Procedural sound: a barely-there deep-space ambience plus soft UI blips.
// Everything is synthesized — no audio files. The context starts on the
// first user gesture (browser autoplay rules) and the toggle mutes all.

export function createSound() {
  let ctx = null;
  let master = null;
  let enabled = true;
  let started = false;

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = enabled ? 1 : 0;
    master.connect(ctx.destination);
  }

  function startAmbient() {
    if (started) return;
    started = true;
    ensureContext();
    const amb = ctx.createGain();
    amb.gain.value = 0.035;
    amb.connect(master);

    // two slowly-beating low oscillators
    for (const [freq, type] of [[54, 'sine'], [54.35, 'triangle']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      o.connect(g).connect(amb);
      o.start();
    }
    // soft filtered noise wash
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const ng = ctx.createGain();
    ng.gain.value = 0.18;
    noise.connect(lp).connect(ng).connect(amb);
    noise.start();
  }

  function blip(f0 = 720, f1 = 480, dur = 0.14, vol = 0.07) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // wake on first gesture
  const wake = () => {
    startAmbient();
    if (ctx.state === 'suspended') ctx.resume();
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);

  return {
    get context() { return ctx; },
    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = v;
      if (master) master.gain.value = v ? 1 : 0;
    },
    select() { blip(720, 480); },
    deselect() { blip(420, 300, 0.1, 0.05); },
    tour() { blip(520, 780, 0.22, 0.06); },
  };
}
