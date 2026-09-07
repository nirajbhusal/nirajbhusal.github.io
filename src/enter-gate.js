/**
 * Galactic Enter gate — dense starfield, nebula, distant spiral, parallax.
 * On Enter: warp/zoom through stars, then soft deep-space dissolve into the site
 * (no white flash / bleach). Respects prefers-reduced-motion (short dark fade).
 */

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

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ warp: (ms?: number) => Promise<void>, destroy: () => void }}
 */
export function initEnterGateVista(canvas) {
  if (!canvas) {
    return {
      warp: async () => {},
      destroy: () => {},
    };
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let running = false;
  let pageVisible = document.visibilityState === 'visible';
  let destroyed = false;
  let t0 = performance.now();
  let pointer = { x: 0.5, y: 0.5 };
  let targetPointer = { x: 0.5, y: 0.5 };
  let stars = [];
  let dust = [];
  let nebulae = [];
  let warp = null; // { start, duration, resolve }
  let dissolve = 0; // late-warp dark dissolve (never a white flash)

  const reduced = prefersReduced();

  function starBudget() {
    const area = w * h;
    const mobile = Math.min(w, h) < 700 || area < 500000;
    const base = mobile ? area / 4200 : area / 2800;
    return Math.floor(clamp(base, 120, mobile ? 420 : 900));
  }

  function rebuild() {
    const count = starBudget();
    stars = Array.from({ length: count }, (_, i) => {
      const z = 0.15 + hash(i * 3.1) * 0.85;
      return {
        x: hash(i * 7.7) * w,
        y: hash(i * 13.3) * h,
        z,
        r: (0.35 + hash(i * 19.1) * 1.6) * (0.55 + z * 0.7),
        tw: hash(i * 23.7) * Math.PI * 2,
        hue: hash(i * 29.3) > 0.82 ? 0.55 + hash(i * 31) * 0.25 : 0.58,
        bright: 0.35 + hash(i * 37.1) * 0.65,
      };
    });

    const dustN = Math.floor(clamp(count * 0.35, 40, 220));
    dust = Array.from({ length: dustN }, (_, i) => ({
      x: hash(i * 41.2) * w,
      y: hash(i * 43.9) * h,
      z: 0.08 + hash(i * 47.5) * 0.35,
      r: 0.4 + hash(i * 53.1) * 1.2,
      a: 0.04 + hash(i * 59.7) * 0.08,
      tw: hash(i * 61.3) * Math.PI * 2,
    }));

    nebulae = [
      { x: 0.22, y: 0.32, rx: 0.42, ry: 0.28, c: [40, 70, 140], a: 0.14 },
      { x: 0.72, y: 0.55, rx: 0.38, ry: 0.32, c: [70, 40, 120], a: 0.11 },
      { x: 0.48, y: 0.72, rx: 0.5, ry: 0.26, c: [30, 90, 150], a: 0.09 },
      { x: 0.58, y: 0.28, rx: 0.28, ry: 0.2, c: [90, 50, 130], a: 0.08 },
      { x: 0.18, y: 0.7, rx: 0.3, ry: 0.22, c: [25, 55, 110], a: 0.07 },
    ];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, reduced ? 1.25 : 2);
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  }

  function drawSpiral(cx, cy, scale, rot, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.scale(scale, scale * 0.62);

    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 120);
    g.addColorStop(0, 'rgba(255, 245, 230, 0.55)');
    g.addColorStop(0.12, 'rgba(190, 210, 255, 0.28)');
    g.addColorStop(0.45, 'rgba(90, 80, 160, 0.12)');
    g.addColorStop(1, 'rgba(10, 12, 30, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(180, 200, 255, 0.22)';
    ctx.lineWidth = 1.2;
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      const phase = (arm / 3) * Math.PI * 2;
      for (let i = 0; i <= 90; i++) {
        const t = i / 90;
        const ang = phase + t * 3.4;
        const rad = 8 + t * 110;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad * 0.55;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // arm sparkle dust
    ctx.fillStyle = 'rgba(210, 225, 255, 0.35)';
    for (let i = 0; i < 48; i++) {
      const t = hash(i * 3.7);
      const ang = t * Math.PI * 6 + rot * 0.2;
      const rad = 12 + hash(i * 5.1) * 95;
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad * 0.55;
      const rr = 0.4 + hash(i * 8.3) * 1.1;
      ctx.globalAlpha = alpha * (0.15 + hash(i * 9.1) * 0.35);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNebula(elapsed, px, py, warpP) {
    const drift = reduced ? 0 : Math.sin(elapsed * 0.05) * 8;
    for (const n of nebulae) {
      const nx = n.x * w + px * 18 + drift * n.x;
      const ny = n.y * h + py * 12 - drift * 0.4;
      const zoom = 1 + warpP * 1.8;
      const rx = n.rx * w * zoom;
      const ry = n.ry * h * zoom;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(rx, ry));
      const [r, gch, b] = n.c;
      const a = n.a * (1 - warpP * 0.55);
      g.addColorStop(0, `rgba(${r},${gch},${b},${a})`);
      g.addColorStop(0.55, `rgba(${r},${gch},${b},${a * 0.35})`);
      g.addColorStop(1, `rgba(3,4,10,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(nx, ny, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(now) {
    if (destroyed) return;
    const elapsed = (now - t0) / 1000;
    pointer.x += (targetPointer.x - pointer.x) * 0.04;
    pointer.y += (targetPointer.y - pointer.y) * 0.04;
    const px = (pointer.x - 0.5) * (reduced ? 8 : 28);
    const py = (pointer.y - 0.5) * (reduced ? 6 : 22);

    let warpP = 0;
    let speed = 1;
    if (warp) {
      const t = clamp((now - warp.start) / warp.duration, 0, 1);
      warpP = easeInCubic(t);
      speed = 1 + warpP * 38;
      // Soft dark dissolve at the end — stay in deep space, never bleach white
      dissolve = t > 0.68 ? easeOutCubic((t - 0.68) / 0.32) : 0;
      if (t >= 1 && warp.resolve) {
        const resolve = warp.resolve;
        warp.resolve = null;
        resolve();
      }
    } else {
      dissolve = 0;
    }

    // deep space backdrop
    ctx.fillStyle = '#020308';
    ctx.fillRect(0, 0, w, h);

    // vignette base
    const vg = ctx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      Math.min(w, h) * 0.15,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.72
    );
    vg.addColorStop(0, 'rgba(8, 12, 28, 0.35)');
    vg.addColorStop(0.55, 'rgba(3, 5, 14, 0.15)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    drawNebula(elapsed, px, py, warpP);

    // distant spiral galaxy
    const gScale =
      (Math.min(w, h) / 900) * (0.85 + (reduced ? 0 : Math.sin(elapsed * 0.08) * 0.03));
    const gRot = elapsed * 0.015 + warpP * 0.8;
    const gAlpha = (0.55 + (reduced ? 0 : Math.sin(elapsed * 0.2) * 0.06)) * (1 - warpP * 0.35);
    drawSpiral(
      w * 0.62 + px * 0.35,
      h * 0.38 + py * 0.25,
      gScale * (1 + warpP * 2.4),
      gRot,
      gAlpha
    );

    // soft secondary glow galaxy remnant
    drawSpiral(
      w * 0.18 + px * 0.2,
      h * 0.68 + py * 0.15,
      gScale * 0.35 * (1 + warpP * 1.2),
      -gRot * 0.6,
      gAlpha * 0.35
    );

    // dust
    for (const d of dust) {
      let x = d.x + px * d.z * 0.6;
      let y = d.y + py * d.z * 0.6;
      if (warpP > 0) {
        const cx = w * 0.5;
        const cy = h * 0.5;
        const dx = x - cx;
        const dy = y - cy;
        const push = 1 + warpP * speed * 0.08;
        x = cx + dx * push;
        y = cy + dy * push;
      }
      const tw = reduced ? 1 : 0.7 + 0.3 * Math.sin(elapsed * 0.9 + d.tw);
      ctx.fillStyle = `rgba(170, 190, 230, ${d.a * tw * (1 - warpP * 0.4)})`;
      ctx.beginPath();
      ctx.arc(x, y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // stars — idle drift or warp streaks
    const cx = w * 0.5;
    const cy = h * 0.48;
    for (const s of stars) {
      let x = s.x + px * s.z;
      let y = s.y + py * s.z;
      if (!reduced && !warp) {
        x += Math.sin(elapsed * (0.12 + s.z * 0.08) + s.tw) * 3 * s.z;
        y += Math.cos(elapsed * (0.1 + s.z * 0.06) + s.tw) * 2.2 * s.z;
      }

      const twinkle = reduced
        ? 1
        : 0.72 + 0.28 * Math.sin(elapsed * (1.2 + s.z) + s.tw);
      let alpha = s.bright * (0.35 + s.z * 0.65) * twinkle;

      if (warpP > 0) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const push = 1 + warpP * speed * (0.04 + s.z * 0.12);
        const nx = cx + dx * push;
        const ny = cy + dy * push;
        const streak = warpP * (8 + s.z * 42) * (dist / Math.max(w, h));
        const ux = dx / dist;
        const uy = dy / dist;
        ctx.strokeStyle = `hsla(${205 + s.hue * 35}, 75%, ${48 + s.z * 18}%, ${Math.min(0.85, alpha + warpP * 0.28) * (1 - dissolve * 0.65)})`;
        ctx.lineWidth = Math.max(0.6, s.r * (0.8 + warpP * 1.4));
        ctx.beginPath();
        ctx.moveTo(nx - ux * streak, ny - uy * streak);
        ctx.lineTo(nx + ux * streak * 0.15, ny + uy * streak * 0.15);
        ctx.stroke();
        x = nx;
        y = ny;
        alpha = Math.min(1, alpha + warpP * 0.35);
      }

      // wrap stars that flew off during warp for continuous field
      if (warpP > 0.15 && (x < -40 || x > w + 40 || y < -40 || y > h + 40)) {
        const ang = hash(s.tw * 10 + elapsed) * Math.PI * 2;
        const rad = 20 + hash(s.tw + 2) * 80;
        x = cx + Math.cos(ang) * rad;
        y = cy + Math.sin(ang) * rad;
        s.x = x - px * s.z;
        s.y = y - py * s.z;
      }

      const hue = 200 + s.hue * 50;
      const starA = alpha * (1 - dissolve * 0.75);
      ctx.fillStyle = `hsla(${hue}, 70%, ${58 + s.z * 14}%, ${starA})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r * (1 + warpP * 0.5), 0, Math.PI * 2);
      ctx.fill();

      if (s.z > 0.75 && s.bright > 0.7 && warpP < 0.85 && dissolve < 0.5) {
        ctx.fillStyle = `hsla(${hue}, 75%, 72%, ${starA * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Center pull — cool blue, peaks mid-warp then yields to dark dissolve
    if (warpP > 0.05) {
      const glowFade = Math.max(0, 1 - dissolve * 1.15);
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.55);
      cg.addColorStop(
        0,
        `rgba(90, 140, 220, ${(0.05 + warpP * 0.14) * glowFade})`
      );
      cg.addColorStop(
        0.4,
        `rgba(40, 70, 140, ${(0.05 + warpP * 0.1) * glowFade})`
      );
      cg.addColorStop(1, 'rgba(2, 3, 8, 0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, w, h);
    }

    // Deep-space handoff: darken into site void + faint blue star hush (no white)
    if (dissolve > 0) {
      const vg = ctx.createRadialGradient(
        cx,
        cy,
        Math.min(w, h) * 0.08,
        cx,
        cy,
        Math.max(w, h) * 0.75
      );
      vg.addColorStop(0, `rgba(8, 14, 32, ${dissolve * 0.55})`);
      vg.addColorStop(0.45, `rgba(3, 5, 14, ${dissolve * 0.78})`);
      vg.addColorStop(1, `rgba(2, 3, 8, ${dissolve * 0.96})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // Soft blue streak hush at the rim — dissolves with the field
      ctx.strokeStyle = `rgba(90, 150, 230, ${0.12 * (1 - dissolve) * warpP})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2 + dissolve * 0.4;
        const rad = Math.min(w, h) * (0.12 + dissolve * 0.55);
        const x0 = cx + Math.cos(ang) * rad * 0.35;
        const y0 = cy + Math.sin(ang) * rad * 0.35;
        const x1 = cx + Math.cos(ang) * rad;
        const y1 = cy + Math.sin(ang) * rad;
        ctx.globalAlpha = 0.08 + (1 - dissolve) * 0.1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    if (!running || destroyed) return;
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (destroyed || running || !pageVisible) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onPointer(e) {
    targetPointer.x = e.clientX / window.innerWidth;
    targetPointer.y = e.clientY / window.innerHeight;
  }

  function onVis() {
    pageVisible = document.visibilityState === 'visible';
    if (pageVisible) {
      if (!reduced || warp) start();
      else {
        draw(performance.now());
      }
    } else stop();
  }

  const onResize = () => {
    resize();
    draw(performance.now());
  };

  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVis);

  resize();
  draw(performance.now());
  if (!reduced) start();
  else {
    // still allow a single animated idle if user hasn't asked for reduce? No — static.
    // But keep a very slow redraw optional? Spec says simpler fade on enter; idle can be static.
  }

  function warpToSite(durationMs = 2000) {
    return new Promise((resolve) => {
      if (destroyed) {
        resolve();
        return;
      }
      if (prefersReduced()) {
        // Short dark dissolve only — stay in deep space
        dissolve = 0.85;
        draw(performance.now());
        window.setTimeout(resolve, 280);
        return;
      }
      if (warp) {
        warp.resolve?.();
      }
      if (!running) start();
      warp = {
        start: performance.now(),
        duration: durationMs,
        resolve: () => {
          stop();
          resolve();
        },
      };
    });
  }

  function destroy() {
    destroyed = true;
    stop();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVis);
  }

  return { warp: warpToSite, destroy, draw: () => draw(performance.now()) };
}
