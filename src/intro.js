/**
 * Home-only cinematic warp. Non-blocking overlay; content stays in the DOM.
 * Skippable. Cleans up so the idle starfield owns the CPU afterwards.
 */

const DURATION = 2500;

const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function easeInCubic(t) {
  return t * t * t;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInExpo(t) {
  return t <= 0 ? 0 : 2 ** (10 * t - 10);
}

const PALETTE_BG = {
  night: [11, 18, 32],
  evening: [27, 20, 48],
  morning: [251, 244, 236],
  afternoon: [246, 247, 249],
};

function soundPrefersWhoosh() {
  try {
    const raw = localStorage.getItem('nb-sound-volume');
    if (raw == null) return false;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0.001;
  } catch {
    return false;
  }
}

function playWhoosh() {
  if (!soundPrefersWhoosh()) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let ctx;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  if (ctx.state === 'suspended') {
    ctx.close?.();
    return;
  }
  const dur = 0.55;
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * dur);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const env = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.65;
  filter.frequency.setValueAtTime(160, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.32);
  const gain = ctx.createGain();
  let stored = 0.16;
  try {
    stored = Number(localStorage.getItem('nb-sound-volume')) || 0.16;
  } catch {
    /* ignore */
  }
  const level = Math.min(0.045, stored * 0.12);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.004, level), ctx.currentTime + 0.07);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  src.onended = () => ctx.close?.();
}

function spawnStar(far) {
  return {
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2,
    z: far ? 0.9 + Math.random() * 0.1 : Math.random(),
  };
}

export function initIntro({ onSettle, onDone } = {}) {
  const root = document.documentElement;
  const home = document.body?.dataset.page === 'home';
  const reduce = prefersReduced();
  const fading = root.classList.contains('is-intro-fade');
  const playing = root.classList.contains('is-intro');

  if (!home || (!playing && !fading)) {
    onDone?.();
    return { skip() {} };
  }

  if (reduce || fading) {
    try {
      sessionStorage.setItem('nb-intro-seen', '1');
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      root.classList.remove('is-intro-fade', 'is-intro');
      onDone?.();
    }, 520);
    return { skip() {} };
  }

  try {
    sessionStorage.setItem('nb-intro-seen', '1');
  } catch {
    /* ignore */
  }

  const params = new URLSearchParams(location.search);
  const freezeRaw = params.get('freeze');
  const freeze =
    freezeRaw == null || freezeRaw === '' || Number.isNaN(Number(freezeRaw))
      ? null
      : clamp(Number(freezeRaw), 0, 0.98);

  const canvas = document.createElement('canvas');
  canvas.className = 'intro-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  let w = 1;
  let h = 1;
  let dpr = 1;
  const palette = root.getAttribute('data-palette') || 'night';
  const end = PALETTE_BG[palette] || PALETTE_BG.night;
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  const starCount = clamp(
    Math.floor(area / (mobile ? 8500 : 6200)),
    mobile ? 110 : 160,
    mobile ? 260 : 480
  );
  const stars = Array.from({ length: starCount }, () => spawnStar(false));
  const armCount = mobile ? 90 : 150;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function speedAt(t) {
    if (t < 0.12) return easeInCubic(t / 0.12) * 0.2;
    if (t < 0.52) return 0.2 + easeInExpo((t - 0.12) / 0.4) * 0.8;
    if (t < 0.66) return 1;
    return Math.max(0, 1 - easeOutCubic((t - 0.66) / 0.34));
  }

  function coreAmt(t) {
    if (t < 0.2) return 0;
    if (t < 0.48) return easeOutCubic((t - 0.2) / 0.28);
    if (t < 0.74) return 1 - easeInCubic((t - 0.48) / 0.26) * 0.9;
    return Math.max(0, 0.06 * (1 - (t - 0.74) / 0.26));
  }

  function dissolve(t) {
    if (t < 0.58) return 0;
    return easeOutCubic((t - 0.58) / 0.42);
  }

  function project(s) {
    const depth = 0.055 + s.z * 1.4;
    return {
      x: w * 0.5 + (s.x / depth) * w * 0.48,
      y: h * 0.46 + (s.y / depth) * h * 0.48,
      depth,
    };
  }

  let raf = 0;
  let stopped = false;
  let settled = false;
  const t0 = performance.now();
  let last = t0;

  function paint(now) {
    const elapsed = freeze != null ? freeze * DURATION : now - t0;
    const t = clamp(elapsed / DURATION, 0, 1);
    const dt = freeze != null ? 0 : Math.min(0.034, (now - last) / 1000);
    last = now;
    const speed = speedAt(t);
    const dis = dissolve(t);
    const core = coreAmt(t);

    if (!settled && t >= 0.6) {
      settled = true;
      root.classList.add('is-settling');
      onSettle?.();
    }

    const cover = t < 0.72 ? 1 : 1 - easeOutCubic((t - 0.72) / 0.28);
    canvas.style.opacity = String(cover);

    const br = Math.round(2 + (end[0] - 2) * dis);
    const bgc = Math.round(3 + (end[1] - 3) * dis);
    const bb = Math.round(8 + (end[2] - 8) * dis);
    ctx.fillStyle = `rgb(${br},${bgc},${bb})`;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.46;
    if (core > 0.015) {
      const rad = Math.min(w, h) * (0.16 + core * 0.46);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(214, 224, 255, ${0.5 * core})`);
      g.addColorStop(0.28, `rgba(96, 132, 255, ${0.26 * core})`);
      g.addColorStop(0.58, `rgba(128, 78, 196, ${0.14 * core})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(elapsed / 1000 * 0.35);
      for (let i = 0; i < armCount; i++) {
        const ang = i * 0.45;
        const rr = (i / armCount) ** 0.85 * rad * 0.92;
        const x = Math.cos(ang) * rr;
        const y = Math.sin(ang) * rr * 0.58;
        const a = 0.4 * core * (1 - i / armCount);
        ctx.fillStyle = `rgba(226, 232, 255, ${a})`;
        ctx.fillRect(x, y, 1.3, 1.3);
      }
      ctx.restore();
    }

    const starKeep = palette === 'night' ? 1 : palette === 'evening' ? 1 - dis * 0.7 : 1 - dis;

    for (const s of stars) {
      const before = project(s);
      if (dt > 0 && speed > 0.001) {
        s.z -= speed * (0.012 + (1 - s.z) * 0.03) * dt * 60;
        if (s.z < 0.025) Object.assign(s, spawnStar(true));
      }
      const p = project(s);
      if (p.x < -80 || p.x > w + 80 || p.y < -80 || p.y > h + 80) continue;
      const near = clamp(1 - s.z, 0, 1);
      const alpha = clamp((0.22 + near * 0.78) * starKeep, 0, 0.95);
      if (alpha < 0.02) continue;
      const streak = speed * (6 + near * 54);
      if (streak > 2 && speed > 0.12) {
        const dx = p.x - before.x;
        const dy = p.y - before.y;
        const len = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = `rgba(232, 238, 255, ${alpha})`;
        ctx.lineWidth = 0.55 + near * 1.35;
        ctx.beginPath();
        ctx.moveTo(p.x - (dx / len) * streak, p.y - (dy / len) * streak);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(236, 240, 248, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.45 + near * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }

    return t;
  }

  function detach(listeners) {
    window.removeEventListener('keydown', listeners.key);
    window.removeEventListener('pointerdown', listeners.ptr);
    window.removeEventListener('wheel', listeners.ptr);
    window.removeEventListener('touchmove', listeners.ptr);
    window.removeEventListener('resize', listeners.resize);
  }

  const listeners = {
    key(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      skip();
    },
    ptr() {
      skip();
    },
    resize() {
      resize();
    },
  };

  function finish(skip) {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    detach(listeners);
    if (canvas.parentNode) canvas.remove();
    if (skip) root.classList.add('intro-skip');
    root.classList.remove('is-intro', 'is-settling');
    if (!settled) onSettle?.();
    onDone?.();
  }

  function skip() {
    finish(true);
  }

  resize();
  playWhoosh();

  if (freeze != null) {
    paint(performance.now());
    window.addEventListener('resize', () => {
      resize();
      paint(performance.now());
    });
    onSettle?.();
    return { skip };
  }

  window.addEventListener('keydown', listeners.key);
  window.addEventListener('pointerdown', listeners.ptr);
  window.addEventListener('wheel', listeners.ptr, { passive: true });
  window.addEventListener('touchmove', listeners.ptr, { passive: true });
  window.addEventListener('resize', listeners.resize);

  function loop(now) {
    if (stopped) return;
    const t = paint(now);
    if (t >= 1) {
      finish(false);
      return;
    }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return { skip };
}
