/**
 * Original ambient bed via Web Audio API.
 * Deep pipe-organ-like drones, slow pads, sparse rising tones, vast reverb.
 * original ambient; not Interstellar OST.
 * Not affiliated with any film soundtrack — no copyrighted audio is embedded or streamed.
 */

const MUTE_KEY = 'nb-sound-muted';
const VOL_KEY = 'nb-sound-volume';
const DEFAULT_VOL = 0.16;
const VOL_STEP = 0.04;
const VOL_MIN = 0;
const VOL_MAX = 0.32;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function readStoredVolume() {
  const raw = localStorage.getItem(VOL_KEY);
  if (raw == null) return DEFAULT_VOL;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_VOL;
  return clamp(n, VOL_MIN, VOL_MAX);
}

export function createAmbient() {
  let ctx = null;
  let master = null;
  let wetGain = null;
  let dryGain = null;
  let droneNodes = [];
  let toneTimer = 0;
  let started = false;
  let volume = readStoredVolume();
  // Legacy mute flag: if previously muted, start at 0 but keep preferred volume
  let mutedLegacy = localStorage.getItem(MUTE_KEY) === '1';
  if (mutedLegacy && volume > 0) {
    // Keep preferred loudness in VOL_KEY; effective level is 0 until user raises
    volume = 0;
  }
  let reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function effectiveGain() {
    return volume;
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = effectiveGain();

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
    if (!ctx || !master || volume <= 0.001 || reduced()) return;
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

  function applyMasterGain(ms = 0.35) {
    if (!master || !ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(Math.max(0.0001, effectiveGain()), t + ms);
    if (effectiveGain() <= 0.0001) {
      master.gain.linearRampToValueAtTime(0, t + ms);
    }
  }

  function persistVolume() {
    localStorage.setItem(VOL_KEY, String(volume));
    localStorage.setItem(MUTE_KEY, volume <= 0.001 ? '1' : '0');
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

    applyMasterGain(0.01);
    if (volume > 0.001 && !reduced()) scheduleSparseTone();
  }

  function setVolume(next) {
    const prev = volume;
    volume = clamp(Number(next) || 0, VOL_MIN, VOL_MAX);
    persistVolume();
    applyMasterGain(0.28);
    if (volume <= 0.001) {
      window.clearTimeout(toneTimer);
    } else if (started && prev <= 0.001 && !reduced()) {
      scheduleSparseTone();
    }
    return volume;
  }

  function getVolume() {
    return volume;
  }

  function volumeUp() {
    if (volume <= 0.001) return setVolume(VOL_STEP);
    return setVolume(volume + VOL_STEP);
  }

  function volumeDown() {
    return setVolume(volume - VOL_STEP);
  }

  /** @deprecated mute API kept for callers; maps to volume 0 / restore default */
  function setMuted(next) {
    if (next) return setVolume(0);
    if (volume <= 0.001) return setVolume(DEFAULT_VOL);
    return volume;
  }

  function toggleMute() {
    if (volume > 0.001) return setVolume(0);
    return setVolume(DEFAULT_VOL);
  }

  function isMuted() {
    return volume <= 0.001;
  }

  function isStarted() {
    return started;
  }

  /** 0–4 bars for UI */
  function volumeLevel() {
    if (volume <= 0.001) return 0;
    if (volume < 0.08) return 1;
    if (volume < 0.16) return 2;
    if (volume < 0.24) return 3;
    return 4;
  }

  return {
    start,
    toggleMute,
    setMuted,
    isMuted,
    isStarted,
    setVolume,
    getVolume,
    volumeUp,
    volumeDown,
    volumeLevel,
    VOL_MAX,
  };
}
