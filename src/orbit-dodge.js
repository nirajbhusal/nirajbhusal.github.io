const HS_KEY = 'orbitDodgeHighScore';
const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initOrbitDodge(canvas, hud, padId = 'touch-pad') {
  const ctx = canvas.getContext('2d');
  const keys = new Set();
  let running = false;
  let paused = false;
  let score = 0;
  let wave = 1;
  let high = Number(localStorage.getItem(HS_KEY) || 0);
  let player = { x: 0, y: 0, r: 10, vx: 0, vy: 0 };
  let asteroids = [];
  let dashCd = 0;
  let dashActive = 0;
  let spawnTimer = 0;
  let last = 0;
  let raf = 0;

  if (hud?.high) hud.high.textContent = `High: ${high}`;

  function reset() {
    const w = canvas.width;
    const h = canvas.height;
    player = { x: w / 2, y: h / 2, r: 10, vx: 0, vy: 0 };
    asteroids = [];
    score = 0;
    wave = 1;
    dashCd = 0;
    dashActive = 0;
    spawnTimer = 0;
    updateHud();
  }

  function updateHud() {
    if (hud?.score) hud.score.textContent = `Score: ${Math.floor(score)}`;
    if (hud?.wave) hud.wave.textContent = `Wave: ${wave}`;
    if (hud?.high) hud.high.textContent = `High: ${high}`;
  }

  function spawn() {
    const w = canvas.width;
    const h = canvas.height;
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = Math.random() * w;
      y = -20;
    } else if (edge === 1) {
      x = w + 20;
      y = Math.random() * h;
    } else if (edge === 2) {
      x = Math.random() * w;
      y = h + 20;
    } else {
      x = -20;
      y = Math.random() * h;
    }
    const angle = Math.atan2(player.y - y, player.x - x);
    const speed = 1.2 + wave * 0.25 + Math.random();
    asteroids.push({
      x,
      y,
      r: 6 + Math.random() * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }

  function inputVector() {
    let ix = 0;
    let iy = 0;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') || keys.has('left'))
      ix -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D') || keys.has('right'))
      ix += 1;
    if (keys.has('ArrowUp') || keys.has('w') || keys.has('W') || keys.has('up'))
      iy -= 1;
    if (keys.has('ArrowDown') || keys.has('s') || keys.has('S') || keys.has('down'))
      iy += 1;
    return { ix, iy };
  }

  function tryDash() {
    if (dashCd > 0 || dashActive > 0) return;
    const { ix, iy } = inputVector();
    let dx = ix;
    let dy = iy;
    if (!dx && !dy) {
      dx = player.vx;
      dy = player.vy;
    }
    const mag = Math.hypot(dx, dy) || 1;
    player.vx = (dx / mag) * 9;
    player.vy = (dy / mag) * 9;
    dashActive = 0.18;
    dashCd = 1.1;
  }

  function step(dt) {
    if (prefersReduced()) dt = Math.min(dt, 0.016);
    const w = canvas.width;
    const h = canvas.height;
    const { ix, iy } = inputVector();
    const accel = dashActive > 0 ? 0 : 420;
    player.vx += ix * accel * dt;
    player.vy += iy * accel * dt;
    player.vx *= 0.92;
    player.vy *= 0.92;
    player.x = Math.max(player.r, Math.min(w - player.r, player.x + player.vx));
    player.y = Math.max(player.r, Math.min(h - player.r, player.y + player.vy));

    dashCd = Math.max(0, dashCd - dt);
    dashActive = Math.max(0, dashActive - dt);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawn();
      spawnTimer = Math.max(0.28, 1.1 - wave * 0.08);
    }

    score += dt * 10 * wave;
    if (score > wave * 120) wave += 1;

    for (const a of asteroids) {
      a.x += a.vx;
      a.y += a.vy;
      const dx = a.x - player.x;
      const dy = a.y - player.y;
      if (Math.hypot(dx, dy) < a.r + player.r) {
        gameOver();
        return;
      }
    }
    asteroids = asteroids.filter(
      (a) => a.x > -40 && a.x < w + 40 && a.y > -40 && a.y < h + 40
    );
    updateHud();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.fillStyle = light ? '#efece6' : '#07080e';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = light ? 'rgba(26,115,199,0.12)' : 'rgba(232,233,237,0.08)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 30 + i * 35, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#3b9eff';
    ctx.shadowColor = 'rgba(59,158,255,0.7)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (dashActive > 0) {
      ctx.strokeStyle = 'rgba(110,192,255,0.85)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = light ? '#2a2e3a' : '#c9ccd6';
    for (const a of asteroids) {
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = '20px IBM Plex Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', w / 2, h / 2);
    }
  }

  function loop(ts) {
    if (!running) return;
    if (!last) last = ts;
    const dt = Math.min(0.033, (ts - last) / 1000);
    last = ts;
    if (!paused) step(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(raf);
    const finalScore = Math.floor(score);
    if (finalScore > high) {
      high = finalScore;
      localStorage.setItem(HS_KEY, String(high));
    }
    updateHud();
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '22px IBM Plex Sans, sans-serif';
    ctx.fillText('Orbit lost', canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = '14px IBM Plex Mono, monospace';
    ctx.fillText(`Score ${finalScore}`, canvas.width / 2, canvas.height / 2 + 18);
  }

  function start() {
    if (running && paused) {
      paused = false;
      last = 0;
      return;
    }
    if (running) return;
    reset();
    running = true;
    paused = false;
    last = 0;
    raf = requestAnimationFrame(loop);
  }

  function pause(forcePause) {
    if (!running) return;
    if (forcePause === true) paused = true;
    else if (forcePause === false) paused = false;
    else paused = !paused;
  }

  function onKeyDown(e) {
    if (document.body.classList.contains('orbit-open')) {
      // modal instance handles keys when open; section instance still gets events —
      // gate section canvas by visibility of its parent section when modal open
    }
    keys.add(e.key);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      if (running) e.preventDefault();
    }
    if ((e.key === ' ' || e.key === 'Shift') && running) tryDash();
    if ((e.key === 'p' || e.key === 'P') && running) pause();
  }
  function onKeyUp(e) {
    keys.delete(e.key);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && running) paused = true;
  });

  const pad = document.getElementById(padId);
  if (pad) {
    pad.querySelectorAll('button').forEach((btn) => {
      const dir = btn.dataset.dir;
      const on = (e) => {
        e.preventDefault();
        if (dir === 'dash') tryDash();
        else keys.add(dir);
      };
      const off = () => {
        if (dir !== 'dash') keys.delete(dir);
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('pointercancel', off);
    });
  }

  canvas.width = 640;
  canvas.height = 400;
  reset();
  draw();

  return { start, pause };
}
