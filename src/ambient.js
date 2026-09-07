/**
 * Original ambient bed via Web Audio API.
 * Deep pipe-organ-like drones, slow pads, sparse rising tones, vast reverb.
 * original ambient; not Interstellar OST.
 * Not affiliated with any film soundtrack — no copyrighted audio is embedded or streamed.
 */

const MUTE_KEY = 'nb-sound-muted';

export function createAmbient() {
  let ctx = null;
  let master = null;
  let wetGain = null;
  let dryGain = null;
  let droneNodes = [];
  let toneTimer = 0;
  let started = false;
  let muted = localStorage.getItem(MUTE_KEY) === '1';
  let reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.16;

    dryGain = ctx.createGain();
    dryGain.gain.value = 0.55;
    wetGain = ctx.createGain();
    wetGain.gain.value = 0.72;

    // Vast feedback delay “reverb” — original, no samples
    const delay1 = ctx.createDelay(2.5);
    delay1.delayTime.value = 0.47;
    const delay2 = ctx.createDelay(2.5);
    delay2.delayTime.value = 0.73;
    const fb1 = ctx.createGain();
    fb1.gain.value = 0.42;
    const fb2 = ctx.createGain();
    fb2.gain.value = 0.36;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 80;

    dryGain.connect(master);
    wetGain.connect(delay1);
    wetGain.connect(delay2);
    delay1.connect(fb1);
    fb1.connect(delay2);
    delay2.connect(fb2);
    fb2.connect(delay1);
    delay1.connect(lp);
    delay2.connect(lp);
    lp.connect(hp);
    hp.connect(master);
    master.connect(ctx.destination);

    droneNodes.push(delay1, delay2, fb1, fb2, lp, hp);
    return ctx;
  }

  function connectVoice(node) {
    node.connect(dryGain);
    node.connect(wetGain);
  }

  function addDrone(freq, type, gainVal, lfoRate, filterHz) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz ?? 420;
    filter.Q.value = 0.7;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(filter);
    filter.connect(gain);
    connectVoice(gain);

    if (lfoRate) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = lfoRate;
      lfoGain.gain.value = freq * 0.0035;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      droneNodes.push(lfo, lfoGain);
    }

    // Slow amplitude breathe for organ-like presence
    const ampLfo = ctx.createOscillator();
    const ampDepth = ctx.createGain();
    ampLfo.frequency.value = 0.04 + Math.random() * 0.03;
    ampDepth.gain.value = gainVal * 0.22;
    ampLfo.connect(ampDepth);
    ampDepth.connect(gain.gain);
    ampLfo.start();

    osc.start();
    droneNodes.push(osc, gain, filter, ampLfo, ampDepth);
  }

  function addPad(freq, gainVal) {
    if (!ctx || !master) return;
    // Detuned pair ≈ soft organ stop
    [0, 0.7, -0.55].forEach((cents, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520 - i * 40;
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq * Math.pow(2, cents / 1200);
      gain.gain.value = gainVal / (i + 1.2);
      osc.connect(filter);
      filter.connect(gain);
      connectVoice(gain);
      osc.start();
      droneNodes.push(osc, gain, filter);
    });
  }

  function scheduleSparseTone() {
    if (!ctx || !master || muted || reduced()) return;
    const now = ctx.currentTime;
    // Sparse rising fifths / open intervals — cinematic, original
    const ladder = [82.41, 110, 146.83, 164.81, 220, 246.94, 329.63];
    const startIdx = Math.floor(Math.random() * (ladder.length - 2));
    const steps = 2 + Math.floor(Math.random() * 2);

    for (let i = 0; i < steps; i++) {
      const f = ladder[Math.min(startIdx + i, ladder.length - 1)];
      const t0 = now + i * 1.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900 + i * 120;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.98, t0);
      osc.frequency.linearRampToValueAtTime(f, t0 + 0.9);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.024 - i * 0.004, t0 + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.8);
      osc.connect(filter);
      filter.connect(gain);
      connectVoice(gain);
      osc.start(t0);
      osc.stop(t0 + 4.1);
    }

    const delay = 11 + Math.random() * 16;
    toneTimer = window.setTimeout(scheduleSparseTone, delay * 1000);
  }

  async function start() {
    if (started) {
      if (ctx?.state === 'suspended') await ctx.resume();
      return;
    }
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') await ctx.resume();
    started = true;

    // Pipe-organ-ish pedal + slow pads (original frequencies only)
    addDrone(32.7, 'sine', 0.06, 0.028, 180); // C1 pedal
    addDrone(49.0, 'sine', 0.045, 0.035, 220);
    addDrone(65.41, 'triangle', 0.022, 0.05, 320);
    addDrone(98.0, 'sine', 0.016, 0.06, 400);
    addPad(130.81, 0.014);
    addPad(196.0, 0.009);
    addDrone(41.2, 'sine', 0.035, 0.022, 200);

    if (!muted && !reduced()) scheduleSparseTone();
  }

  function setMuted(next) {
    muted = next;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (master && ctx) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.16, t + 0.45);
    }
    if (muted) {
      window.clearTimeout(toneTimer);
    } else if (started && !reduced()) {
      scheduleSparseTone();
    }
    return muted;
  }

  function toggleMute() {
    return setMuted(!muted);
  }

  function isMuted() {
    return muted;
  }

  function isStarted() {
    return started;
  }

  return { start, toggleMute, setMuted, isMuted, isStarted };
}
