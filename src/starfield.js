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

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.floor((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.4 + 0.2,
    }));
  }

  function draw() {
    const theme = document.documentElement.getAttribute('data-theme');
    ctx.clearRect(0, 0, w, h);
    const px = (pointer.x - 0.5) * 28;
    const py = (pointer.y - 0.5) * 28;
    for (const s of stars) {
      const x = s.x + px * s.z;
      const y = s.y + py * s.z;
      const alpha = theme === 'light' ? 0.35 * s.z : 0.55 * s.z;
      ctx.fillStyle =
        theme === 'light'
          ? `rgba(18, 20, 26, ${alpha})`
          : `rgba(232, 233, 237, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r * s.z, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame() {
    if (!running) return;
    draw();
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

  return { stop, start, draw };
}
