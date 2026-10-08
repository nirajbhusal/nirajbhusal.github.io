const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function initStarfield(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  let stars = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let running = false;
  let alive = true;
  const t0 = performance.now();

  function palette() {
    return document.documentElement.getAttribute('data-palette') || 'night';
  }

  function visiblePalette() {
    const p = palette();
    return p === 'night' || p === 'evening';
  }

  function budget() {
    const mobile = Math.min(w, h) < 700;
    const count = Math.floor((w * h) / (mobile ? 28000 : 22000));
    return Math.max(28, Math.min(count, mobile ? 56 : 90));
  }

  function rebuild() {
    const count = budget();
    stars = Array.from({ length: count }, (_, i) => ({
      x: hash(i + 1.3) * w,
      y: hash(i + 4.7) * h,
      r: 0.35 + hash(i + 8.1) * 0.7,
      a: 0.12 + hash(i + 12.4) * 0.26,
      tw: hash(i + 16.2) * Math.PI * 2,
      sp: 0.25 + hash(i + 19.5) * 0.45,
    }));
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }

  function draw(now = performance.now()) {
    ctx.clearRect(0, 0, w, h);
    if (!visiblePalette()) return;
    const evening = palette() === 'evening';
    const scale = evening ? 0.34 : 1;
    const elapsed = (now - t0) / 1000;
    const reduced = prefersReduced();
    for (const s of stars) {
      const drift = reduced ? 0 : Math.sin(elapsed * 0.05 * s.sp + s.tw) * 1.1;
      const twinkle = reduced ? 1 : 0.78 + 0.22 * Math.sin(elapsed * 0.55 * s.sp + s.tw);
      const alpha = s.a * scale * twinkle;
      ctx.fillStyle = `rgba(214, 224, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y + drift, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!alive) return;
    if (!visiblePalette()) {
      stop();
      draw();
      return;
    }
    draw();
    if (prefersReduced() || running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onResize() {
    resize();
    draw();
  }

  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') start();
    else stop();
  });

  const mo = new MutationObserver(() => {
    if (running || document.visibilityState === 'visible') start();
    else draw();
  });
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-palette'],
  });

  resize();
  draw();

  return {
    start,
    stop,
    draw,
    destroy() {
      alive = false;
      stop();
      window.removeEventListener('resize', onResize);
      mo.disconnect();
    },
  };
}
