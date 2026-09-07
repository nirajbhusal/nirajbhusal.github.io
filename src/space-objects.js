/**
 * Floating interactive cosmic objects — draggable, reactive, reduced-motion aware.
 * Pointer capture + inertia + bounds; magnetic cursor; soft collisions; parallax depth.
 * Does not block page scroll unless actively dragging past a small threshold.
 */

const OBJECTS = [
  {
    kind: 'planet',
    label: 'Kepler-ish',
    fact: 'Public systems work best when orbits of data, policy, and people stay aligned.',
    x: 6,
    y: 22,
    size: 46,
    depth: 0.35,
  },
  {
    kind: 'satellite',
    label: 'Relay-7',
    fact: 'A good civic tool relays citizens toward official channels — never replaces them.',
    x: 88,
    y: 18,
    size: 30,
    depth: 0.7,
  },
  {
    kind: 'asteroid',
    label: 'C-type',
    fact: 'Crisis information design: timestamped, fact-checked, and clearly labeled personal vs official.',
    x: 92,
    y: 58,
    size: 24,
    depth: 1,
  },
  {
    kind: 'cluster',
    label: 'Pleiades',
    fact: 'Communities like GovTech Nepal form when curious civil servants find each other.',
    x: 8,
    y: 68,
    size: 38,
    depth: 0.45,
  },
  {
    kind: 'planet',
    label: 'Ice giant',
    fact: 'DPI is the quiet gravity underneath services people barely notice — until it fails.',
    x: 4,
    y: 42,
    size: 36,
    depth: 0.55,
  },
  {
    kind: 'satellite',
    label: 'CubeSat',
    fact: 'Small personal civic experiments can still cast a useful signal in a flood of noise.',
    x: 85,
    y: 78,
    size: 26,
    depth: 0.85,
  },
];

export function initSpaceObjects(root) {
  if (!root) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tip = document.createElement('div');
  tip.className = 'cosmo-tip';
  tip.setAttribute('role', 'status');
  tip.setAttribute('aria-live', 'polite');
  tip.hidden = true;
  document.body.appendChild(tip);

  let hideTimer = 0;
  const pointer = { x: -9999, y: -9999, active: false };
  const bodies = [];
  let raf = 0;
  let dragging = null;
  let scrollY = window.scrollY || 0;

  function showTip(text, el) {
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const pad = 12;
    tip.style.left = `${r.left + r.width / 2}px`;
    tip.style.top = `${r.top - 8}px`;
    tip.style.transform = 'translate(-50%, -100%)';
    requestAnimationFrame(() => {
      const tr = tip.getBoundingClientRect();
      let dx = 0;
      if (tr.left < pad) dx = pad - tr.left;
      if (tr.right > window.innerWidth - pad) dx = window.innerWidth - pad - tr.right;
      if (dx) tip.style.transform = `translate(calc(-50% + ${dx}px), -100%)`;
      if (tr.top < pad) tip.style.transform = 'translate(-50%, 12px)';
    });
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      tip.hidden = true;
    }, 4200);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function setPos(body, xPct, yPct) {
    body.x = clamp(xPct, 2, 96);
    body.y = clamp(yPct, 4, 92);
    body.el.style.setProperty('--x', `${body.x}%`);
    body.el.style.setProperty('--y', `${body.y}%`);
  }

  OBJECTS.forEach((spec, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `cosmo-obj cosmo-${spec.kind} cosmo-depth-${Math.round(spec.depth * 10)}${reduced ? ' is-static' : ''}`;
    el.style.setProperty('--x', `${spec.x}%`);
    el.style.setProperty('--y', `${spec.y}%`);
    el.style.setProperty('--size', `${spec.size}px`);
    el.style.setProperty('--delay', `${i * 0.7}s`);
    el.style.setProperty('--depth', String(spec.depth));
    el.setAttribute('aria-label', `${spec.label}: ${spec.fact}`);
    el.innerHTML = `<span class="cosmo-glow" aria-hidden="true"></span><span class="cosmo-core" aria-hidden="true"></span>`;

    const body = {
      el,
      spec,
      x: spec.x,
      y: spec.y,
      vx: 0,
      vy: 0,
      ox: 0,
      oy: 0,
      baseX: spec.x,
      baseY: spec.y,
      depth: spec.depth,
      radius: spec.size / 2,
      moved: false,
      capturing: false,
      downAt: 0,
      downX: 0,
      downY: 0,
      lastX: 0,
      lastY: 0,
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = body;
      body.moved = false;
      body.capturing = false;
      body.downAt = performance.now();
      body.downX = e.clientX;
      body.downY = e.clientY;
      body.lastX = e.clientX;
      body.lastY = e.clientY;
      body.vx = 0;
      body.vy = 0;
      el.classList.add('is-dragging');
      el.classList.remove('is-spin');
      tip.hidden = true;
      // Do NOT preventDefault yet — allow scroll until drag threshold
    });

    el.addEventListener('pointermove', (e) => {
      if (dragging !== body) return;
      const dx = e.clientX - body.downX;
      const dy = e.clientY - body.downY;
      const dist = Math.hypot(dx, dy);

      // Only capture + block scroll once the user clearly intends to drag
      if (!body.capturing && dist >= 8) {
        body.capturing = true;
        body.moved = true;
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {
          /* ignore */
        }
      }
      if (!body.capturing) return;

      e.preventDefault();
      const xPct = (e.clientX / window.innerWidth) * 100;
      const yPct = (e.clientY / window.innerHeight) * 100;
      const prevX = body.x;
      const prevY = body.y;
      // Velocity from recent pointer delta for satisfying inertia
      const dtMs = Math.max(8, e.timeStamp - (body._lastTs || e.timeStamp));
      body._lastTs = e.timeStamp;
      const scale = 16 / dtMs;
      body.vx = ((e.clientX - body.lastX) / window.innerWidth) * 100 * scale;
      body.vy = ((e.clientY - body.lastY) / window.innerHeight) * 100 * scale;
      body.lastX = e.clientX;
      body.lastY = e.clientY;
      setPos(body, xPct, yPct);
      // Blend measured velocity with position delta
      body.vx = body.vx * 0.6 + (body.x - prevX) * 0.4;
      body.vy = body.vy * 0.6 + (body.y - prevY) * 0.4;
      body.ox = 0;
      body.oy = 0;
    });

    function endDrag(e) {
      if (dragging !== body) return;
      if (body.capturing) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (_) {
          /* already released */
        }
      }
      el.classList.remove('is-dragging');
      dragging = null;
      if (!body.moved) {
        el.classList.add('is-spin');
        showTip(spec.fact, el);
        window.setTimeout(() => el.classList.remove('is-spin'), 900);
      } else if (!reduced) {
        body.vx *= 1.85;
        body.vy *= 1.85;
        const maxV = 3.2;
        body.vx = clamp(body.vx, -maxV, maxV);
        body.vy = clamp(body.vy, -maxV, maxV);
      }
      body.capturing = false;
    }

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('pointerenter', () => {
      if (window.matchMedia('(hover: hover)').matches && !dragging) {
        el.classList.add('is-glow');
        showTip(spec.fact, el);
      }
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-glow');
    });

    el.addEventListener('click', (e) => {
      if (body.moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    root.appendChild(el);
    bodies.push(body);
  });

  window.addEventListener(
    'scroll',
    () => {
      tip.hidden = true;
      scrollY = window.scrollY || 0;
    },
    { passive: true }
  );

  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true }
  );

  window.addEventListener(
    'pointerleave',
    () => {
      pointer.active = false;
    },
    { passive: true }
  );

  if (reduced) {
    // Gentle static placement — tap still shows facts
    return;
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const magStrength = 26;
    const magRadius = 160;

    // Soft collisions (pairwise)
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (dragging === a || dragging === b) continue;
        const ax = (a.x / 100) * w;
        const ay = (a.y / 100) * h;
        const bx = (b.x / 100) * w;
        const by = (b.y / 100) * h;
        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.hypot(dx, dy) || 1;
        const minDist = a.radius + b.radius + 10;
        if (dist < minDist) {
          const overlap = (minDist - dist) / dist;
          const nx = dx * overlap * 0.5;
          const ny = dy * overlap * 0.5;
          const pushX = (nx / w) * 100;
          const pushY = (ny / h) * 100;
          a.vx -= pushX * 8 * dt;
          a.vy -= pushY * 8 * dt;
          b.vx += pushX * 8 * dt;
          b.vy += pushY * 8 * dt;
        }
      }
    }

    for (const body of bodies) {
      if (dragging === body) continue;

      // Magnetic nudge near cursor
      if (pointer.active) {
        const cx = (body.x / 100) * w;
        const cy = (body.y / 100) * h;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < magRadius) {
          const force = (1 - dist / magRadius) * magStrength * (0.6 + body.depth * 0.5);
          body.ox += (dx / dist) * force * dt;
          body.oy += (dy / dist) * force * dt;
        }
      }

      // Soft spring home + inertia
      const homeK = 0.28 + body.depth * 0.12;
      body.vx += (body.baseX - body.x) * homeK * dt;
      body.vy += (body.baseY - body.y) * homeK * dt;
      body.vx *= 0.955;
      body.vy *= 0.955;
      body.ox *= 0.88;
      body.oy *= 0.88;

      const nx = body.x + body.vx + body.ox * 0.09;
      const ny = body.y + body.vy + body.oy * 0.09;
      setPos(body, nx, ny);

      // Parallax from scroll + magnetic follow
      const parallax = (scrollY * 0.018 * body.depth) % 40;
      const followX = body.ox * (0.28 + body.depth * 0.2);
      const followY = body.oy * (0.28 + body.depth * 0.2) - parallax;
      body.el.style.setProperty('--mx', `${followX.toFixed(2)}px`);
      body.el.style.setProperty('--my', `${followY.toFixed(2)}px`);
      body.el.style.setProperty('--zscale', (0.92 + body.depth * 0.12).toFixed(3));
    }

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      cancelAnimationFrame(raf);
    } else if (!reduced) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  });
}
