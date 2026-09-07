/**
 * Original ambient bed via Web Audio API — deep drones + sparse tones.
 * Not affiliated with any film soundtrack.
 */

const MUTE_KEY = 'nb-sound-muted';

export function createAmbient() {
  let ctx = null;
  let master = null;
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
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ctx.destination);
    return ctx;
  }

  function addDrone(freq, type, gainVal, lfoRate) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    if (lfoRate) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = lfoRate;
      lfoGain.gain.value = freq * 0.004;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      droneNodes.push(lfo);
    }

    osc.start();
    droneNodes.push(osc, gain, filter);
  }

  function scheduleSparseTone() {
    if (!ctx || !master || muted || reduced()) return;
    const now = ctx.currentTime;
    const freqs = [196, 220, 246.94, 293.66, 329.63, 392];
    const f = freqs[Math.floor(Math.random() * freqs.length)];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    osc.type = 'triangle';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 3.1);
    const delay = 4.5 + Math.random() * 7;
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
    // Deep drones — original bed
    addDrone(55, 'sine', 0.07, 0.07);
    addDrone(82.5, 'sine', 0.045, 0.05);
    addDrone(110, 'triangle', 0.018, 0.09);
    addDrone(41.2, 'sine', 0.05, 0.03);
    if (!muted && !reduced()) scheduleSparseTone();
  }

  function setMuted(next) {
    muted = next;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (master && ctx) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.22, t + 0.2);
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
