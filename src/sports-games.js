/**
 * Lightweight optional sports mini-games (canvas).
 * Quiet, dismissible, keyboard + touch friendly. Cosmic dark + blue accent only.
 * Supports full modal play and compact ambient background shell.
 */

const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawField(ctx, w, h) {
  ctx.fillStyle = '#060912';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(40, 90, 160, 0.12)');
  g.addColorStop(1, 'rgba(2, 3, 8, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function hudText(ctx, lines, w, ambient) {
  ctx.fillStyle = 'rgba(180, 200, 230, 0.85)';
  ctx.font = ambient ? '11px "IBM Plex Mono", monospace' : '12px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  lines.forEach((t, i) => ctx.fillText(t, 10, 16 + i * 14));
  if (!ambient) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(140, 160, 190, 0.7)';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText('Esc / close to dismiss', w / 2, hSafe(ctx.canvas) - 10);
  }
}

function hSafe(canvas) {
  return canvas.height;
}

function readPersist(key) {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function writePersist(key, data) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function keyTarget(options) {
  return options?.keyRoot || window;
}

function shouldHandleKeys(options, running) {
  if (!running) return false;
  if (!options?.requireFocus) return true;
  const root = options.keyRoot;
  if (!root) return true;
  const ae = document.activeElement;
  return root === ae || root.contains?.(ae);
}

/** Basketball throw — aim with arrows/drag, shoot with Space/tap */
export function initBasketball(canvas, hud, options = {}) {
  const ctx = canvas.getContext('2d');
  const ambient = !!options.ambient;
  const persistKey = options.persistKey || null;
  let running = false;
  let raf = 0;
  const saved = readPersist(persistKey);
  let score = Number(saved?.score) || 0;
  let attempts = Number(saved?.attempts) || 0;
  let streak = Number(saved?.streak) || 0;
  let bestStreak = Number(saved?.bestStreak) || 0;
  let angle = -1.15;
  let power = 0.55;
  let charging = false;
  let ball = null;
  let msg = ambient
    ? 'Hold / drag to charge · release to shoot'
    : 'Hold Space / tap to charge · release to shoot';
  let msgT = ambient ? 0 : 0;
  const keys = new Set();
  let pointerId = null;
  let pointerY0 = 0;
  let shotResolved = false;

  function hoop() {
    const w = canvas.width;
    const h = canvas.height;
    return { x: w * 0.72, y: h * 0.28, r: Math.max(16, Math.min(22, w * 0.07)) };
  }

  function persist() {
    writePersist(persistKey, { score, attempts, streak, bestStreak });
  }

  function stats() {
    return {
      game: 'basketball',
      score,
      attempts,
      makes: score,
      streak,
      bestStreak,
    };
  }

  function emitStats() {
    persist();
    options.onStats?.(stats());
  }

  function updateHud() {
    if (hud?.score) hud.score.textContent = ambient ? `Score ${score}` : `Score: ${score}`;
    if (hud?.extra) {
      hud.extra.textContent = ambient
        ? `Shots ${attempts} · Streak ${streak}`
        : `Shots: ${attempts}`;
    }
    if (hud?.makes) hud.makes.textContent = String(score);
    if (hud?.shots) hud.shots.textContent = String(attempts);
    if (hud?.streak) hud.streak.textContent = String(streak);
    emitStats();
  }

  function resetBall() {
    ball = {
      x: canvas.width * 0.22,
      y: canvas.height * 0.78,
      vx: 0,
      vy: 0,
      r: Math.max(8, Math.min(11, canvas.width * 0.035)),
      flying: false,
      scored: false,
    };
    shotResolved = false;
  }

  function finishShot(made) {
    if (shotResolved) return;
    shotResolved = true;
    if (made) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
    updateHud();
    options.onShotComplete?.(stats(), made);
  }

  function shoot() {
    if (!ball || ball.flying) return;
    const p = clamp(power, 0.25, 1);
    ball.flying = true;
    ball.vx = Math.cos(angle) * (7.2 + p * 9.5);
    ball.vy = Math.sin(angle) * (7.2 + p * 9.5);
    attempts += 1;
    updateHud();
  }

  function step(dt) {
    if (shouldHandleKeys(options, running)) {
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) angle -= 1.2 * dt;
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) angle += 1.2 * dt;
    }
    angle = clamp(angle, -1.55, -0.25);
    if (charging && (!ball || !ball.flying)) {
      power = clamp(power + 0.55 * dt, 0.2, 1);
    }
    if (!ball?.flying) return;
    ball.vy += 18 * dt;
    ball.x += ball.vx * dt * 60;
    ball.y += ball.vy * dt * 60;
    const hp = hoop();
    if (!ball.scored && Math.hypot(ball.x - hp.x, ball.y - hp.y) < hp.r - 4 && ball.vy > 0) {
      ball.scored = true;
      score += 1;
      msg = 'Swish';
      msgT = 1.2;
      finishShot(true);
    }
    if (ball.y > canvas.height + 40 || ball.x < -40 || ball.x > canvas.width + 40) {
      const missed = !ball.scored;
      resetBall();
      power = 0.55;
      if (missed) {
        if (msgT <= 0) {
          msg = 'Miss — try again';
          msgT = 1;
        }
        finishShot(false);
      }
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    drawField(ctx, w, h);
    const hp = hoop();
    ctx.fillStyle = 'rgba(200, 220, 255, 0.2)';
    roundRect(ctx, hp.x + 18, hp.y - 28, 8, 56, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 158, 255, 0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, hp.r, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160, 190, 230, 0.35)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(hp.x + i * 7, hp.y + 2);
      ctx.lineTo(hp.x + i * 4, hp.y + 26);
      ctx.stroke();
    }
    if (ball && !ball.flying) {
      const len = 40 + power * 50;
      ctx.strokeStyle = `rgba(110, 192, 255, ${0.35 + power * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + Math.cos(angle) * len, ball.y + Math.sin(angle) * len);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, 12, h - 28, 90, 7, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(59, 158, 255, 0.85)';
      roundRect(ctx, 12, h - 28, 90 * power, 7, 4);
      ctx.fill();
    }
    if (ball) {
      const grd = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 2, ball.x, ball.y, ball.r);
      grd.addColorStop(0, '#f0a060');
      grd.addColorStop(1, '#c45a20');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 20, 10, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 0.7, 0.2, 2.2);
      ctx.stroke();
    }
    if (msgT > 0) {
      ctx.fillStyle = 'rgba(110, 192, 255, 0.9)';
      ctx.font = ambient
        ? '600 14px "IBM Plex Sans", sans-serif'
        : '600 16px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, h * 0.55);
    }
    hudText(
      ctx,
      ambient
        ? [`◉ ${score} · streak ${streak}`]
        : [`Basketball · ${score} made`, '←→ aim · hold Space charge · release shoot'],
      w,
      ambient
    );
  }

  let last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (msgT > 0) msgT -= dt;
    if (!prefersReduced() || running) step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function onKeyDown(e) {
    if (!shouldHandleKeys(options, running)) return;
    keys.add(e.key);
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!charging && ball && !ball.flying) {
        charging = true;
        power = 0.25;
      }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.key);
    if (!shouldHandleKeys(options, running)) return;
    if ((e.key === ' ' || e.code === 'Space') && charging) {
      charging = false;
      shoot();
    }
  }
  function onPointerDown(e) {
    if (!running) return;
    pointerId = e.pointerId;
    pointerY0 = e.clientY;
    canvas.setPointerCapture?.(pointerId);
    canvas.focus?.({ preventScroll: true });
    if (ball && !ball.flying) {
      charging = true;
      power = 0.25;
    }
  }
  function onPointerMove(e) {
    if (!running || pointerId !== e.pointerId || !charging) return;
    const dy = pointerY0 - e.clientY;
    power = clamp(0.25 + dy / 120, 0.2, 1);
    const rect = canvas.getBoundingClientRect();
    if (ball && !ball.flying) {
      const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
      angle = clamp(Math.atan2(sy - ball.y, sx - ball.x), -1.55, -0.25);
    }
  }
  function onPointerUp(e) {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    if (charging) {
      charging = false;
      shoot();
    }
  }

  const kt = () => keyTarget(options);

  function start() {
    if (running) return;
    running = true;
    resetBall();
    updateHud();
    last = performance.now();
    kt().addEventListener('keydown', onKeyDown);
    kt().addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    raf = requestAnimationFrame(frame);
  }

  function pause(force) {
    if (!running && !force) return;
    running = false;
    cancelAnimationFrame(raf);
    charging = false;
    kt().removeEventListener('keydown', onKeyDown);
    kt().removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  }

  resetBall();
  draw();
  updateHud();
  return { start, pause, getStats: stats, draw };
}

/** Cricket timing — press when ball enters the hitting zone */
export function initCricket(canvas, hud, options = {}) {
  const ctx = canvas.getContext('2d');
  const ambient = !!options.ambient;
  const persistKey = options.persistKey || null;
  let running = false;
  let raf = 0;
  const saved = readPersist(persistKey);
  let score = Number(saved?.score) || 0;
  let streak = Number(saved?.streak) || 0;
  let attempts = Number(saved?.attempts) || 0;
  let ball = null;
  let cooldown = 0;
  let flash = 0;
  let msg = 'Space / tap when the ball reaches the bat zone';
  let msgT = ambient ? 0 : 2;

  function persist() {
    writePersist(persistKey, { score, streak, attempts });
  }

  function stats() {
    return {
      game: 'cricket',
      score,
      attempts,
      makes: score,
      streak,
      bestStreak: streak,
    };
  }

  function emitStats() {
    persist();
    options.onStats?.(stats());
  }

  function spawn() {
    const speed = 2.4 + Math.min(3, streak * 0.15) + Math.random() * 0.8;
    ball = {
      x: canvas.width + 20,
      y: canvas.height * 0.58 + (Math.random() - 0.5) * 30,
      vx: -speed,
      r: 9,
      hit: false,
    };
  }

  function updateHud() {
    if (hud?.score) hud.score.textContent = ambient ? `Runs ${score}` : `Runs: ${score}`;
    if (hud?.extra) hud.extra.textContent = ambient ? `Streak ${streak}` : `Streak: ${streak}`;
    if (hud?.makes) hud.makes.textContent = String(score);
    if (hud?.shots) hud.shots.textContent = String(attempts);
    if (hud?.streak) hud.streak.textContent = String(streak);
    emitStats();
  }

  function swing() {
    if (!ball || ball.hit || cooldown > 0) return;
    const zoneX = canvas.width * 0.28;
    const dist = Math.abs(ball.x - zoneX);
    cooldown = 0.35;
    attempts += 1;
    if (dist < 28) {
      ball.hit = true;
      ball.vx = 8 + Math.random() * 3;
      ball.vy = -4 - Math.random() * 3;
      const pts = dist < 12 ? 6 : dist < 20 ? 4 : 2;
      score += pts;
      streak += 1;
      flash = 0.35;
      msg = pts === 6 ? 'Six!' : pts === 4 ? 'Four' : 'Shot';
      msgT = 0.9;
      updateHud();
      options.onShotComplete?.(stats(), true);
    } else {
      streak = 0;
      msg = 'Early / late';
      msgT = 0.8;
      updateHud();
      options.onShotComplete?.(stats(), false);
    }
  }

  function step(dt) {
    cooldown = Math.max(0, cooldown - dt);
    flash = Math.max(0, flash - dt);
    if (msgT > 0) msgT -= dt;
    if (!ball) {
      spawn();
      return;
    }
    ball.x += ball.vx * dt * 60;
    if (ball.vy != null) ball.y += ball.vy * dt * 60;
    if (ball.hit && ball.vy != null) ball.vy += 12 * dt;
    if (!ball.hit && ball.x < -30) {
      streak = 0;
      attempts += 1;
      msg = 'Wicket missed';
      msgT = 0.8;
      updateHud();
      options.onShotComplete?.(stats(), false);
      spawn();
    } else if (ball.hit && (ball.x > canvas.width + 40 || ball.y > canvas.height + 40)) {
      spawn();
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    drawField(ctx, w, h);
    ctx.fillStyle = 'rgba(90, 120, 80, 0.18)';
    roundRect(ctx, w * 0.12, h * 0.52, w * 0.76, h * 0.14, 8);
    ctx.fill();
    const zx = w * 0.28;
    ctx.fillStyle = flash > 0 ? 'rgba(59, 158, 255, 0.35)' : 'rgba(59, 158, 255, 0.12)';
    roundRect(ctx, zx - 26, h * 0.48, 52, h * 0.22, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 192, 255, 0.5)';
    ctx.strokeRect(zx - 26, h * 0.48, 52, h * 0.22);
    ctx.save();
    ctx.translate(zx - 8, h * 0.62);
    ctx.rotate(-0.4 + (flash > 0 ? -0.5 : 0));
    ctx.fillStyle = 'rgba(210, 180, 120, 0.9)';
    roundRect(ctx, -6, -36, 12, 48, 3);
    ctx.fill();
    ctx.restore();
    if (ball) {
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 40, 40, 0.7)';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r * 0.6, -0.8, 0.8);
      ctx.stroke();
    }
    if (msgT > 0) {
      ctx.fillStyle = 'rgba(110, 192, 255, 0.95)';
      ctx.font = ambient
        ? '600 14px "IBM Plex Sans", sans-serif'
        : '600 16px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, h * 0.35);
    }
    hudText(
      ctx,
      ambient ? [`◌ ${score} runs`] : [`Cricket · ${score} runs`, 'Space / tap in the blue zone'],
      w,
      ambient
    );
  }

  let last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function onKey(e) {
    if (!shouldHandleKeys(options, running)) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      swing();
    }
  }
  function onPointer(e) {
    if (!running) return;
    e.preventDefault();
    canvas.focus?.({ preventScroll: true });
    swing();
  }

  const kt = () => keyTarget(options);

  function start() {
    if (running) return;
    running = true;
    if (!ambient) {
      score = 0;
      streak = 0;
      attempts = 0;
    }
    spawn();
    updateHud();
    last = performance.now();
    kt().addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPointer);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    kt().removeEventListener('keydown', onKey);
    canvas.removeEventListener('pointerdown', onPointer);
  }

  draw();
  updateHud();
  return { start, pause, getStats: stats, draw };
}

/** Football penalty — aim + power, beat the keeper */
export function initFootball(canvas, hud, options = {}) {
  const ctx = canvas.getContext('2d');
  const ambient = !!options.ambient;
  const persistKey = options.persistKey || null;
  let running = false;
  let raf = 0;
  const saved = readPersist(persistKey);
  let score = Number(saved?.score) || 0;
  let shots = Number(saved?.attempts) || 0;
  let streak = Number(saved?.streak) || 0;
  let aim = 0;
  let power = 0.5;
  let charging = false;
  let phase = 'aim'; // aim | flight | reset
  let ball = null;
  let keeper = 0;
  let keeperTarget = 0;
  let msg = '←→ aim · hold Space / drag up to power · release';
  let msgT = ambient ? 0 : 2;
  const keys = new Set();
  let pointerId = null;
  let resetTimer = 0;

  function persist() {
    writePersist(persistKey, { score, attempts: shots, streak });
  }

  function stats() {
    return {
      game: 'football',
      score,
      attempts: shots,
      makes: score,
      streak,
      bestStreak: streak,
    };
  }

  function emitStats() {
    persist();
    options.onStats?.(stats());
  }

  function placeBall() {
    ball = {
      x: canvas.width * 0.5,
      y: canvas.height * 0.82,
      vx: 0,
      vy: 0,
      r: 10,
      t: 0,
    };
    phase = 'aim';
    power = 0.45;
    aim = (Math.random() - 0.5) * 0.4;
    keeper = 0;
    keeperTarget = (Math.random() - 0.5) * 1.4;
  }

  function updateHud() {
    if (hud?.score) hud.score.textContent = ambient ? `Goals ${score}` : `Goals: ${score}`;
    if (hud?.extra) hud.extra.textContent = ambient ? `Shots ${shots}` : `Shots: ${shots}`;
    if (hud?.makes) hud.makes.textContent = String(score);
    if (hud?.shots) hud.shots.textContent = String(shots);
    if (hud?.streak) hud.streak.textContent = String(streak);
    emitStats();
  }

  function kick() {
    if (phase !== 'aim') return;
    phase = 'flight';
    shots += 1;
    const p = clamp(power, 0.25, 1);
    ball.vx = aim * 5.5;
    ball.vy = -(5.5 + p * 6.5);
    ball.t = 0;
    keeperTarget = clamp(aim * 1.6 + (Math.random() - 0.5) * 0.7, -1.5, 1.5);
    updateHud();
  }

  function resolveKick(made, label) {
    msg = label;
    msgT = 1.1;
    if (made) streak += 1;
    else streak = 0;
    updateHud();
    options.onShotComplete?.(stats(), made);
    phase = 'reset';
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      if (running) placeBall();
    }, 700);
  }

  function step(dt) {
    if (shouldHandleKeys(options, running)) {
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) aim -= 1.6 * dt;
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) aim += 1.6 * dt;
    }
    aim = clamp(aim, -1.2, 1.2);
    if (charging && phase === 'aim') power = clamp(power + 0.5 * dt, 0.2, 1);
    if (msgT > 0) msgT -= dt;

    keeper += (keeperTarget - keeper) * Math.min(1, 4 * dt);

    if (phase !== 'flight' || !ball) return;
    ball.t += dt;
    ball.vy += 14 * dt;
    ball.x += ball.vx * dt * 60;
    ball.y += ball.vy * dt * 60;

    const goalY = canvas.height * 0.28;
    const goalL = canvas.width * 0.28;
    const goalR = canvas.width * 0.72;
    if (ball.y <= goalY + 8 && ball.vy < 0) {
      const kx = canvas.width * 0.5 + keeper * 55;
      const savedKick = Math.abs(ball.x - kx) < 28;
      const inGoal = ball.x > goalL + 8 && ball.x < goalR - 8;
      if (inGoal && !savedKick) {
        score += 1;
        resolveKick(true, 'Goal!');
      } else if (savedKick) {
        resolveKick(false, 'Saved');
      } else {
        resolveKick(false, 'Wide');
      }
    } else if (ball.y > canvas.height + 30 || ball.x < -40 || ball.x > canvas.width + 40) {
      resolveKick(false, 'Miss');
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    drawField(ctx, w, h);
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * 0.22, h * 0.28, w * 0.56, h * 0.42);
    const goalY = h * 0.28;
    const goalL = w * 0.28;
    const goalR = w * 0.72;
    ctx.strokeStyle = 'rgba(220, 230, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(goalL, goalY + 48);
    ctx.lineTo(goalL, goalY);
    ctx.lineTo(goalR, goalY);
    ctx.lineTo(goalR, goalY + 48);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140, 170, 210, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const x = goalL + ((goalR - goalL) * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, goalY);
      ctx.lineTo(x, goalY + 48);
      ctx.stroke();
    }
    const kx = w * 0.5 + keeper * 55;
    const ky = goalY + 28;
    ctx.fillStyle = 'rgba(59, 158, 255, 0.85)';
    roundRect(ctx, kx - 14, ky - 18, 28, 36, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(kx, ky - 24, 8, 0, Math.PI * 2);
    ctx.fill();

    if (ball && phase === 'aim') {
      const len = 36 + power * 48;
      ctx.strokeStyle = `rgba(110, 192, 255, ${0.4 + power * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + aim * 40, ball.y - len);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, 12, h - 28, 90, 7, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(59, 158, 255, 0.85)';
      roundRect(ctx, 12, h - 28, 90 * power, 7, 4);
      ctx.fill();
    }
    if (ball) {
      const grd = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.r);
      grd.addColorStop(0, '#f5f5f5');
      grd.addColorStop(1, '#8a8a8a');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (msgT > 0) {
      ctx.fillStyle = 'rgba(110, 192, 255, 0.95)';
      ctx.font = ambient
        ? '600 14px "IBM Plex Sans", sans-serif'
        : '600 16px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, h * 0.5);
    }
    hudText(
      ctx,
      ambient
        ? [`○ ${score} goals`]
        : [`Football · ${score} goals`, '←→ aim · hold Space power · release kick'],
      w,
      ambient
    );
  }

  let last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function onKeyDown(e) {
    if (!shouldHandleKeys(options, running)) return;
    keys.add(e.key);
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (phase === 'aim' && !charging) {
        charging = true;
        power = 0.25;
      }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.key);
    if (!shouldHandleKeys(options, running)) return;
    if ((e.key === ' ' || e.code === 'Space') && charging) {
      charging = false;
      kick();
    }
  }
  function onPointerDown(e) {
    if (!running || phase !== 'aim') return;
    pointerId = e.pointerId;
    canvas.setPointerCapture?.(pointerId);
    canvas.focus?.({ preventScroll: true });
    charging = true;
    power = 0.25;
  }
  function onPointerMove(e) {
    if (!running || pointerId !== e.pointerId || !charging) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    aim = clamp(sx * 1.2, -1.2, 1.2);
    const sy = 1 - (e.clientY - rect.top) / rect.height;
    power = clamp(sy, 0.2, 1);
  }
  function onPointerUp(e) {
    if (pointerId !== e.pointerId) return;
    pointerId = null;
    if (charging) {
      charging = false;
      kick();
    }
  }

  const kt = () => keyTarget(options);

  function start() {
    if (running) return;
    running = true;
    if (!ambient) {
      score = 0;
      shots = 0;
      streak = 0;
    }
    placeBall();
    updateHud();
    last = performance.now();
    kt().addEventListener('keydown', onKeyDown);
    kt().addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    charging = false;
    window.clearTimeout(resetTimer);
    kt().removeEventListener('keydown', onKeyDown);
    kt().removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  }

  placeBall();
  draw();
  updateHud();
  void prefersReduced;
  return { start, pause, getStats: stats, draw };
}

/** Ambient-capable quiet games for the background shell / shuffle list. */
export const AMBIENT_GAME_CATALOG = {
  basketball: {
    id: 'basketball',
    title: 'Basketball',
    chip: 'Play basketball',
    hint: 'Drag to aim & charge · release to shoot · Esc hides',
    init: initBasketball,
    persistKey: 'nb-ambient-bb',
  },
  cricket: {
    id: 'cricket',
    title: 'Cricket',
    chip: 'Play cricket',
    hint: 'Tap / Space in the blue zone · Esc hides',
    init: initCricket,
    persistKey: 'nb-ambient-cricket',
  },
  football: {
    id: 'football',
    title: 'Football',
    chip: 'Play football',
    hint: 'Drag to aim & power · release to kick · Esc hides',
    init: initFootball,
    persistKey: 'nb-ambient-fb',
  },
  // TODO: Orbit Dodge needs dedicated touch-pad chrome; keep it modal-only for now.
};
