const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initStarfield(canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  let running = false;
  let visible = true;
  let pageVisible = true;
  let pointer = { x: 0.5, y: 0.5 };
  let dpr = 1;
  let t0 = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.floor((w * h) / 7500);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.5 + 0.2,
      tw: Math.random() * Math.PI * 2,
      drift: 0.015 + Math.random() * 0.04,
    }));
  }

  function draw(now = performance.now()) {
    const theme = document.documentElement.getAttribute('data-theme');
    const elapsed = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    const px = (pointer.x - 0.5) * 32;
    const py = (pointer.y - 0.5) * 32;
    for (const s of stars) {
      const driftX = Math.sin(elapsed * s.drift + s.tw) * 6 * s.z;
      const driftY = Math.cos(elapsed * s.drift * 0.8 + s.tw) * 4 * s.z;
      const x = s.x + px * s.z + driftX;
      const y = s.y + py * s.z + driftY;
      const twinkle = 0.75 + 0.25 * Math.sin(elapsed * 1.8 + s.tw);
      const alpha =
        (theme === 'light' ? 0.32 : 0.62) * s.z * (prefersReduced() ? 1 : twinkle);
      ctx.fillStyle =
        theme === 'light'
          ? `rgba(60, 70, 90, ${alpha})`
          : `rgba(190, 220, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r * s.z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (prefersReduced() || running || !visible || !pageVisible) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onPointer(e) {
    pointer.x = e.clientX / window.innerWidth;
    pointer.y = e.clientY / window.innerHeight;
    if (prefersReduced()) draw();
  }

  window.addEventListener('resize', () => {
    resize();
    draw();
  });
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState === 'visible';
    if (pageVisible) start();
    else stop();
  });

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    },
    { threshold: 0.01 }
  );
  io.observe(canvas);

  resize();
  draw();
  if (!prefersReduced()) start();
  else draw();

  return { stop, start, draw };
}
