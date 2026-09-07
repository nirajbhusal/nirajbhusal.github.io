/**
 * Shared device-orientation parallax for phones/tablets.
 * Desktop: inert (callers keep pointer parallax).
 * iOS 13+: requestPermission() must run from a user gesture.
 * Clamped angles + low-pass; respects prefers-reduced-motion.
 */

const MOTION_KEY = 'nb-motion';
const ANGLE_CLAMP = 28; // degrees
const FILTER = 0.1; // low-pass toward raw each sample
const COARSE_MQ = '(pointer: coarse), (hover: none)';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function prefersReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isCoarseDevice() {
  try {
    return window.matchMedia(COARSE_MQ).matches;
  } catch {
    return 'ontouchstart' in window;
  }
}

function hasOrientationAPI() {
  return typeof window.DeviceOrientationEvent !== 'undefined';
}

function needsIOSPermission() {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  );
}

function readStored() {
  try {
    return localStorage.getItem(MOTION_KEY);
  } catch {
    return null;
  }
}

function writeStored(v) {
  try {
    localStorage.setItem(MOTION_KEY, v);
  } catch {
    /* private mode */
  }
}

/** @type {null | ReturnType<typeof createController>} */
let singleton = null;

function createController() {
  let enabled = false;
  let listening = false;
  let dragging = false;
  let baseline = null; // first sample becomes zero
  let rawX = 0;
  let rawY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let lastEventAt = 0;
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) {
      try {
        fn(getOffset());
      } catch {
        /* ignore subscriber errors */
      }
    }
  }

  function applyCSS() {
    const o = getOffset();
    // Small CSS-level shift for nebula / optional layers (px)
    const max = prefersReduced() ? 4 : 14;
    document.documentElement.style.setProperty('--gyro-x', `${(o.x * max).toFixed(2)}px`);
    document.documentElement.style.setProperty('--gyro-y', `${(o.y * max).toFixed(2)}px`);
  }

  function onOrientation(e) {
    if (!enabled || dragging || prefersReduced()) return;
    // gamma: left-right (-90..90), beta: front-back (-180..180)
    let gamma = typeof e.gamma === 'number' ? e.gamma : 0;
    let beta = typeof e.beta === 'number' ? e.beta : 0;
    if (!Number.isFinite(gamma) || !Number.isFinite(beta)) return;

    if (!baseline) {
      baseline = { gamma, beta };
    }
    gamma -= baseline.gamma;
    beta -= baseline.beta;

    gamma = clamp(gamma, -ANGLE_CLAMP, ANGLE_CLAMP);
    beta = clamp(beta, -ANGLE_CLAMP, ANGLE_CLAMP);

    // Normalize to ~[-1, 1]; invert so tilt-right shifts vista right
    rawX = gamma / ANGLE_CLAMP;
    rawY = beta / ANGLE_CLAMP;

    smoothX += (rawX - smoothX) * FILTER;
    smoothY += (rawY - smoothY) * FILTER;
    lastEventAt = performance.now();
    applyCSS();
    notify();
  }

  function startListening() {
    if (listening || !hasOrientationAPI()) return;
    window.addEventListener('deviceorientation', onOrientation, true);
    listening = true;
    enabled = true;
    document.documentElement.classList.add('has-gyro');
  }

  function stopListening() {
    if (!listening) return;
    window.removeEventListener('deviceorientation', onOrientation, true);
    listening = false;
    enabled = false;
    baseline = null;
    smoothX = 0;
    smoothY = 0;
    rawX = 0;
    rawY = 0;
    document.documentElement.classList.remove('has-gyro');
    document.documentElement.style.setProperty('--gyro-x', '0px');
    document.documentElement.style.setProperty('--gyro-y', '0px');
    notify();
  }

  /**
   * Call from a user gesture. Resolves true if motion is available/started.
   * @returns {Promise<boolean>}
   */
  async function requestPermission() {
    if (prefersReduced()) return false;
    if (!isCoarseDevice()) return false;
    if (!hasOrientationAPI()) return false;

    if (needsIOSPermission()) {
      const stored = readStored();
      if (stored === 'denied') return false;
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        if (state === 'granted') {
          writeStored('granted');
          startListening();
          return true;
        }
        writeStored('denied');
        return false;
      } catch {
        // User dismissed / not allowed in this context
        return false;
      }
    }

    // Android / others: no prompt; just listen
    writeStored('granted');
    startListening();
    return true;
  }

  /** Non-iOS coarse devices can start without a prompt. iOS always needs a gesture. */
  function tryAutoStart() {
    if (prefersReduced()) return false;
    if (!isCoarseDevice() || !hasOrientationAPI()) return false;
    // iOS 13+: cannot listen until requestPermission() runs from a user gesture.
    if (needsIOSPermission()) return false;
    startListening();
    return true;
  }

  function getOffset() {
    if (!enabled || dragging || prefersReduced()) {
      return { x: 0, y: 0, active: false };
    }
    // Fade if events go stale (sensor paused)
    if (lastEventAt && performance.now() - lastEventAt > 2500) {
      return { x: 0, y: 0, active: false };
    }
    return {
      x: clamp(smoothX, -1, 1),
      y: clamp(smoothY, -1, 1),
      active: true,
    };
  }

  function setDragging(on) {
    dragging = !!on;
    if (dragging) {
      // Soft hold last pose — do not jump; callers skip applying while drag
      notify();
    }
  }

  function isDragging() {
    return dragging;
  }

  function isActive() {
    return enabled && listening && !prefersReduced();
  }

  function shouldOfferEnable() {
    if (prefersReduced()) return false;
    if (!isCoarseDevice() || !hasOrientationAPI()) return false;
    if (isActive()) return false;
    if (readStored() === 'denied') return false;
    // iOS always needs a gesture; Android only if not yet listening
    if (needsIOSPermission()) return true;
    return !listening;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function destroy() {
    stopListening();
    listeners.clear();
  }

  // Reduce-motion live toggle
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMq = () => {
    if (mq.matches) stopListening();
  };
  if (mq.addEventListener) mq.addEventListener('change', onMq);
  else mq.addListener?.(onMq);

  return {
    requestPermission,
    tryAutoStart,
    getOffset,
    setDragging,
    isDragging,
    isActive,
    shouldOfferEnable,
    needsIOSPermission,
    isCoarseDevice,
    onChange,
    destroy,
    startListening,
    stopListening,
  };
}

/** Shared singleton used by Enter vista, starfield, and cosmic objects. */
export function getGyro() {
  if (!singleton) singleton = createController();
  return singleton;
}

/**
 * Map gyro offset [-1,1] into pixel shift. maxPx is full-tilt shift.
 * @param {{x:number,y:number}} o
 * @param {number} maxPx
 */
export function gyroPixels(o, maxPx) {
  if (!o || !o.active) return { x: 0, y: 0 };
  const m = prefersReduced() ? Math.min(4, maxPx * 0.25) : maxPx;
  return { x: o.x * m, y: o.y * m };
}
