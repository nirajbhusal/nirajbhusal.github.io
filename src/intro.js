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
  const ang = Math.random() * Math.PI * 2;
  const r = Math.sqrt(0.04 + Math.random() * 0.96);
  return {
    ang,
    r,
    z: far ? 0.78 + Math.random() * 0.22 : Math.random() ** 1.7,
  };
}

function buildGalaxy(count, arms) {
  const parts = [];
  const per = Math.ceil(count / arms);
  for (let i = 0; i < count; i++) {
    const arm = i % arms;
    const along = (Math.floor(i / arms) + 0.5) / per;
    const jitter = ((i * 97) % 1000) / 1000;
    const ang =
      arm * ((Math.PI * 2) / arms) +
      along * 5.4 +
      (jitter - 0.5) * 0.42;
    const radN = 0.045 + along ** 0.75 * 0.96;
    const lane = Math.sin(along * 26 + arm * 2.2 + jitter * 3.1);
    parts.push({
      ang,
      radN,
      lane,
      along,
      jitter,
      yScale: 0.34 + jitter * 0.1,
      size: along < 0.18 ? 2.4 : 1.05 + jitter * 0.9,
    });
  }
  return parts;
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
  const starCount = mobile ? 360 : 640;
  const stars = Array.from({ length: starCount }, () => spawnStar(false));
  const galaxy = buildGalaxy(mobile ? 260 : 480, 3);

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
    if (t < 0.12) return easeInCubic(t / 0.12) * 0.22;
    if (t < 0.5) return 0.22 + easeInExpo((t - 0.12) / 0.38) * 0.78;
    if (t < 0.6) return 1;
    const u = (t - 0.6) / 0.18;
    if (u >= 1) return 0;
    return 1 - easeOutCubic(u);
  }

  function coreAmt(t) {
    if (t < 0.12) return easeOutCubic(t / 0.12) * 0.4;
    if (t < 0.4) return 0.4 + easeOutCubic((t - 0.12) / 0.28) * 0.6;
    if (t < 0.62) return 1;
    if (t < 0.8) return 1 - easeInCubic((t - 0.62) / 0.18);
    return 0;
  }

  function dissolve(t) {
    if (t < 0.62) return 0;
    return easeOutCubic((t - 0.62) / 0.38);
  }

  function flashAmt(t) {
    const d = Math.abs(t - 0.58);
    if (d > 0.07) return 0;
    const u = 1 - d / 0.07;
    return u * u;
  }

  function project(s) {
    const depth = 0.09 + s.z * 1.35;
    return {
      x: w * 0.5 + (Math.cos(s.ang) * s.r / depth) * w * 0.58,
      y: h * 0.46 + (Math.sin(s.ang) * s.r / depth) * h * 0.58,
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
    const starKeep = palette === 'night' ? 1 : palette === 'evening' ? 1 - dis * 0.7 : 1 - dis;
    const gal = core * (1 - dis * 0.92);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    if (gal > 0.02) {
      const rad = Math.min(w, h) * (0.2 + gal * 0.38);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * gal})`);
      g.addColorStop(0.1, `rgba(198, 220, 255, ${0.62 * gal})`);
      g.addColorStop(0.32, `rgba(92, 128, 255, ${0.32 * gal})`);
      g.addColorStop(0.58, `rgba(156, 86, 230, ${0.18 * gal})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((elapsed / 1000) * 0.48);
      const galR = Math.min(w, h) * (0.2 + gal * 0.34);
      for (const p of galaxy) {
        if (p.lane < -0.58) continue;
        const dust = p.lane < -0.18 ? 0.18 : 1;
        const rr = p.radN * galR;
        const x = Math.cos(p.ang) * rr;
        const y = Math.sin(p.ang) * rr * p.yScale;
        const inner = 1 - p.along;
        const a = gal * dust * (0.32 + inner * 0.68);
        if (a < 0.04) continue;
        const cr = Math.round(255 * inner + 176 * (1 - inner));
        const cg = Math.round(248 * inner + 142 * (1 - inner));
        const cb = 255;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
        ctx.fillRect(x, y, p.size, p.size);
      }
      ctx.restore();
    }

    for (const s of stars) {
      if (dt > 0 && speed > 0.001) {
        s.z -= speed * (0.016 + (1 - s.z) * 0.042) * dt * 60;
        if (s.z < 0.02) Object.assign(s, spawnStar(true));
      }
      const p = project(s);
      if (p.x < -120 || p.x > w + 120 || p.y < -120 || p.y > h + 120) continue;
      const near = clamp(1 - s.z, 0, 1);
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const alpha = clamp((0.28 + near * 0.72) * (0.2 + speed * 0.8) * starKeep, 0, 1);
      if (alpha < 0.03) continue;
      const reach = clamp(dist / (Math.min(w, h) * 0.26), 0.28, 1.45);
      const len = speed * (12 + near * 210) * reach;
      if (len > 3.5 && speed > 0.08) {
        const ux = dx / dist;
        const uy = dy / dist;
        const px = -uy;
        const py = ux;
        const x0 = p.x - ux * len;
        const y0 = p.y - uy * len;
        const shift = 0.7 + near * 0.9;
        const passes = [
          [px * shift, py * shift, 140, 186, 255, 0.55],
          [0, 0, 255, 255, 255, 0.95],
          [-px * shift, -py * shift, 206, 150, 255, 0.5],
        ];
        ctx.lineWidth = 0.7 + near * 1.55;
        for (const pass of passes) {
          ctx.strokeStyle = `rgba(${pass[2]},${pass[3]},${pass[4]},${alpha * pass[5]})`;
          ctx.beginPath();
          ctx.moveTo(x0 + pass[0], y0 + pass[1]);
          ctx.lineTo(p.x + pass[0], p.y + pass[1]);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = `rgba(236, 242, 255, ${alpha * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.45 + near * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const flash = flashAmt(t);
    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * flash})`;
      ctx.fillRect(0, 0, w, h);
      const bloom = Math.min(w, h) * 0.48;
      const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloom);
      fg.addColorStop(0, `rgba(255, 255, 255, ${0.95 * flash})`);
      fg.addColorStop(0.22, `rgba(186, 214, 255, ${0.5 * flash})`);
      fg.addColorStop(0.55, `rgba(170, 120, 255, ${0.16 * flash})`);
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(cx - bloom, cy - bloom, bloom * 2, bloom * 2);
    }

    ctx.globalCompositeOperation = 'source-over';
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
