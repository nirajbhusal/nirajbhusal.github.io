/**
 * Lightweight optional sports mini-games (canvas).
 * Quiet, dismissible, keyboard + touch friendly. Cosmic dark + blue accent only.
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

function hudText(ctx, lines, w) {
  ctx.fillStyle = 'rgba(180, 200, 230, 0.85)';
  ctx.font = '12px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  lines.forEach((t, i) => ctx.fillText(t, 12, 18 + i * 16));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(140, 160, 190, 0.7)';
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillText('Esc / close to dismiss', w / 2, hSafe(ctx.canvas) - 10);
}

function hSafe(canvas) {
  return canvas.height;
}

/** Basketball throw — aim with arrows/drag, shoot with Space/tap */
export function initBasketball(canvas, hud) {
  const ctx = canvas.getContext('2d');
  let running = false;
  let raf = 0;
  let score = 0;
  let attempts = 0;
  let angle = -1.15;
  let power = 0.55;
  let charging = false;
  let ball = null;
  let msg = 'Hold Space / tap to charge · release to shoot';
  let msgT = 0;
  const keys = new Set();
  let pointerId = null;
  let pointerY0 = 0;

  function hoop() {
    const w = canvas.width;
    const h = canvas.height;
    return { x: w * 0.72, y: h * 0.28, r: 22 };
  }

  function resetBall() {
    ball = {
      x: canvas.width * 0.22,
      y: canvas.height * 0.78,
      vx: 0,
      vy: 0,
      r: 11,
      flying: false,
      scored: false,
    };
  }

  function updateHud() {
    if (hud?.score) hud.score.textContent = `Score: ${score}`;
    if (hud?.extra) hud.extra.textContent = `Shots: ${attempts}`;
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
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) angle -= 1.2 * dt;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) angle += 1.2 * dt;
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
      updateHud();
    }
    if (ball.y > canvas.height + 40 || ball.x < -40 || ball.x > canvas.width + 40) {
      resetBall();
      power = 0.55;
      if (!ball.scored && msgT <= 0) {
        msg = 'Miss — try again';
        msgT = 1;
      }
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    drawField(ctx, w, h);
    const hp = hoop();
    // backboard
    ctx.fillStyle = 'rgba(200, 220, 255, 0.2)';
    roundRect(ctx, hp.x + 18, hp.y - 28, 8, 56, 2);
    ctx.fill();
    // rim
    ctx.strokeStyle = 'rgba(59, 158, 255, 0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, hp.r, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // net hint
    ctx.strokeStyle = 'rgba(160, 190, 230, 0.35)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(hp.x + i * 7, hp.y + 2);
      ctx.lineTo(hp.x + i * 4, hp.y + 26);
      ctx.stroke();
    }
    // aim
    if (ball && !ball.flying) {
      const len = 40 + power * 50;
      ctx.strokeStyle = `rgba(110, 192, 255, ${0.35 + power * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + Math.cos(angle) * len, ball.y + Math.sin(angle) * len);
      ctx.stroke();
      // power bar
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, 12, h - 36, 100, 8, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(59, 158, 255, 0.85)';
      roundRect(ctx, 12, h - 36, 100 * power, 8, 4);
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
      ctx.font = '600 16px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, h * 0.55);
    }
    hudText(ctx, [`Basketball · ${score} made`, '←→ aim · hold Space charge · release shoot'], w);
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
    if (!running) return;
    keys.add(e.key);
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!charging && ball && !ball.flying) {
        charging = true;
        power = 0.25;
      }
    }
  }
  function onKeyUp(e) {
    keys.delete(e.key);
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
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (ball && !ball.flying) {
      angle = Math.atan2(my - ball.y * (rect.height / canvas.height), mx - ball.x * (rect.width / canvas.width));
      // map to canvas space more carefully
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

  function start() {
    if (running) return;
    running = true;
    resetBall();
    updateHud();
    last = performance.now();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
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
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  }

  resetBall();
  draw();
  return { start, pause };
}

/** Cricket timing — press when ball enters the hitting zone */
export function initCricket(canvas, hud) {
  const ctx = canvas.getContext('2d');
  let running = false;
  let raf = 0;
  let score = 0;
  let streak = 0;
  let ball = null;
  let cooldown = 0;
  let flash = 0;
  let msg = 'Space / tap when the ball reaches the bat zone';
  let msgT = 2;

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
    if (hud?.score) hud.score.textContent = `Runs: ${score}`;
    if (hud?.extra) hud.extra.textContent = `Streak: ${streak}`;
  }

  function swing() {
    if (!ball || ball.hit || cooldown > 0) return;
    const zoneX = canvas.width * 0.28;
    const dist = Math.abs(ball.x - zoneX);
    cooldown = 0.35;
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
    } else {
      streak = 0;
      msg = 'Early / late';
      msgT = 0.8;
      updateHud();
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
      msg = 'Wicket missed';
      msgT = 0.8;
      updateHud();
      spawn();
    } else if (ball.hit && (ball.x > canvas.width + 40 || ball.y > canvas.height + 40)) {
      spawn();
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    drawField(ctx, w, h);
    // pitch
    ctx.fillStyle = 'rgba(90, 120, 80, 0.18)';
    roundRect(ctx, w * 0.12, h * 0.52, w * 0.76, h * 0.14, 8);
    ctx.fill();
    // hitting zone
    const zx = w * 0.28;
    ctx.fillStyle = flash > 0 ? 'rgba(59, 158, 255, 0.35)' : 'rgba(59, 158, 255, 0.12)';
    roundRect(ctx, zx - 26, h * 0.48, 52, h * 0.22, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 192, 255, 0.5)';
    ctx.strokeRect(zx - 26, h * 0.48, 52, h * 0.22);
    // bat
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
      ctx.font = '600 16px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, h * 0.35);
    }
    hudText(ctx, [`Cricket · ${score} runs`, 'Space / tap in the blue zone'], w);
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
    if (!running) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      swing();
    }
  }
  function onPointer(e) {
    if (!running) return;
    e.preventDefault();
    swing();
  }

  function start() {
    if (running) return;
    running = true;
    score = 0;
    streak = 0;
    spawn();
    updateHud();
    last = performance.now();
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPointer);
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    canvas.removeEventListener('pointerdown', onPointer);
  }

  draw();
  return { start, pause };
}

/** Football penalty — aim + power, beat the keeper */
export function initFootball(canvas, hud) {
  const ctx = canvas.getContext('2d');
  let running = false;
  let raf = 0;
  let score = 0;
  let shots = 0;
  let aim = 0;
  let power = 0.5;
  let charging = false;
  let phase = 'aim'; // aim | flight | reset
  let ball = null;
  let keeper = 0;
  let keeperTarget = 0;
  let msg = '←→ aim · hold Space / drag up to power · release';
  let msgT = 2;
  const keys = new Set();
  let pointerId = null;

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
    if (hud?.score) hud.score.textContent = `Goals: ${score}`;
    if (hud?.extra) hud.extra.textContent = `Shots: ${shots}`;
  }

  function kick() {
    if (phase !== 'aim') return;
    phase = 'flight';
    shots += 1;
    const p = clamp(power, 0.25, 1);
    ball.vx = aim * 5.5;
    ball.vy = -(5.5 + p * 6.5);
    ball.t = 0;
    // keeper dives toward a guessed side
    keeperTarget = clamp(aim * 1.6 + (Math.random() - 0.5) * 0.7, -1.5, 1.5);
    updateHud();
  }

  function step(dt) {
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) aim -= 1.6 * dt;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) aim += 1.6 * dt;
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
      // crossing goal line
      const kx = canvas.width * 0.5 + keeper * 55;
      const saved = Math.abs(ball.x - kx) < 28;
      const inGoal = ball.x > goalL + 8 && ball.x < goalR - 8;
      if (inGoal && !saved) {
        score += 1;
        msg = 'Goal!';
        msgT = 1.1;
      } else if (saved) {
        msg = 'Saved';
        msgT = 1.1;
      } else {
        msg = 'Wide';
        msgT = 1.1;
      }
      updateHud();
      phase = 'reset';
      window.setTimeout(() => {
        if (running) placeBall();
      }, 700);
    } else if (ball.y > canvas.height + 30 || ball.x < -40 || ball.x > canvas.width + 40) {
      msg = 'Miss';
      msgT = 0.9;
      phase = 'reset';
      window.setTimeout(() => {
        if (running) placeBall();
      }, 600);
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    drawField(ctx, w, h);
    // box
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w * 0.22, h * 0.28, w * 0.56, h * 0.42);
    // goal
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
    // net
    ctx.strokeStyle = 'rgba(140, 170, 210, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const x = goalL + ((goalR - goalL) * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, goalY);
      ctx.lineTo(x, goalY + 48);
      ctx.stroke();
    }
    // keeper
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
      roundRect(ctx, 12, h - 36, 100, 8, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(59, 158, 255, 0.85)';
      roundRect(ctx, 12, h - 36, 100 * power, 8, 4);
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
      ctx.font = '600 16px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(msg, w / 2, h * 0.5);
    }
    hudText(ctx, [`Football · ${score} goals`, '←→ aim · hold Space power · release kick'], w);
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
    if (!running) return;
    keys.add(e.key);
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (phase === 'aim' && !charging) {
        charging = true;
        power = 0.25;
      }
    }
  }
  function onKeyUp(e) {
    keys.delete(e.key);
    if ((e.key === ' ' || e.code === 'Space') && charging) {
      charging = false;
      kick();
    }
  }
  function onPointerDown(e) {
    if (!running || phase !== 'aim') return;
    pointerId = e.pointerId;
    canvas.setPointerCapture?.(pointerId);
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

  function start() {
    if (running) return;
    running = true;
    placeBall();
    updateHud();
    last = performance.now();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
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
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  }

  placeBall();
  draw();
  void prefersReduced;
  return { start, pause };
}
