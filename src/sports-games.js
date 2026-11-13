/**
 * Lightweight optional basketball mini-game (canvas).
 * Quiet, dismissible, keyboard + touch friendly. Cosmic dark + blue accent only.
 */

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

  function scale() {
    // Modal court is ~640 wide; ambient is smaller — keep feel consistent
    return canvas.width / 640;
  }

  function hoop() {
    const w = canvas.width;
    const h = canvas.height;
    const s = scale();
    return { x: w * 0.72, y: h * 0.28, r: Math.max(14, 22 * s) };
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
    if (hud?.score) hud.score.textContent = ambient ? String(score) : `Score: ${score}`;
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
    const s = scale();
    ball = {
      x: canvas.width * 0.22,
      y: canvas.height * 0.78,
      vx: 0,
      vy: 0,
      r: Math.max(7, 11 * s),
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
    const s = scale();
    ball.flying = true;
    if (ambient) {
      // Curated ambient arcs — tuned so medium Space/drag charges can score
      const a = clamp(angle, -1.35, -0.75);
      const speed = (9 + p * 4) * s;
      ball.vx = Math.cos(a) * speed;
      ball.vy = Math.sin(a) * speed;
    } else {
      ball.vx = Math.cos(angle) * (7.2 + p * 9.5) * s;
      ball.vy = Math.sin(angle) * (7.2 + p * 9.5) * s;
    }
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
    const s = scale();
    ball.vy += (ambient ? 14 : 18) * dt * s;
    ball.x += ball.vx * dt * 60;
    ball.y += ball.vy * dt * 60;
    const hp = hoop();
    const hitR = hp.r + (ambient ? 6 : 0);
    if (
      !ball.scored &&
      Math.hypot(ball.x - hp.x, ball.y - hp.y) < hitR &&
      ball.vy > -0.2 &&
      ball.x > hp.x - hp.r - 2 &&
      ball.x < hp.x + hp.r + 2
    ) {
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
    step(dt);
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
      if (ambient) {
        // Ambient: horizontal aim within a makeable arc; vertical drag is power only
        const t = clamp(sx / canvas.width, 0.15, 0.95);
        angle = clamp(-1.35 + t * 0.55, -1.45, -0.7);
      } else {
        angle = clamp(Math.atan2(sy - ball.y, sx - ball.x), -1.55, -0.25);
      }
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
    if (!ball?.flying) resetBall();
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
    keys.clear();
    kt().removeEventListener('keydown', onKeyDown);
    kt().removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  }

  function applyExternalShot(made) {
    attempts += 1;
    if (made) {
      score += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      msg = 'Swish';
      msgT = 1.2;
    } else {
      streak = 0;
      msg = 'Miss — try again';
      msgT = 0.9;
    }
    updateHud();
    options.onShotComplete?.(stats(), !!made);
    if (running) draw();
  }

  resetBall();
  draw();
  updateHud();
  return { start, pause, getStats: stats, draw, applyExternalShot };
}
