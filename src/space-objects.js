/**
 * Floating interactive cosmic objects — draggable, reactive, reduced-motion aware.
 * Pointer + touch drag with inertia; magnetic nudge near cursor; click reveals facts.
 * Does not block page scroll unless actively dragging.
 */

const OBJECTS = [
  {
    kind: 'planet',
    label: 'Kepler-ish',
    fact: 'Public systems work best when orbits of data, policy, and people stay aligned.',
    x: 6,
    y: 22,
    size: 42,
  },
  {
    kind: 'satellite',
    label: 'Relay-7',
    fact: 'A good civic tool relays citizens toward official channels — never replaces them.',
    x: 88,
    y: 18,
    size: 28,
  },
  {
    kind: 'asteroid',
    label: 'C-type',
    fact: 'Crisis information design: timestamped, fact-checked, and clearly labeled personal vs official.',
    x: 92,
    y: 58,
    size: 22,
  },
  {
    kind: 'cluster',
    label: 'Pleiades',
    fact: 'Communities like GovTech Nepal form when curious civil servants find each other.',
    x: 8,
    y: 68,
    size: 36,
  },
  {
    kind: 'planet',
    label: 'Ice giant',
    fact: 'DPI is the quiet gravity underneath services people barely notice — until it fails.',
    x: 4,
    y: 42,
    size: 34,
  },
  {
    kind: 'satellite',
    label: 'CubeSat',
    fact: 'Small personal civic experiments can still cast a useful signal in a flood of noise.',
    x: 85,
    y: 78,
    size: 24,
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
    el.className = `cosmo-obj cosmo-${spec.kind}${reduced ? ' is-static' : ''}`;
    el.style.setProperty('--x', `${spec.x}%`);
    el.style.setProperty('--y', `${spec.y}%`);
    el.style.setProperty('--size', `${spec.size}px`);
    el.style.setProperty('--delay', `${i * 0.7}s`);
    el.setAttribute('aria-label', `${spec.label}: ${spec.fact}`);
    el.innerHTML = `<span class="cosmo-core" aria-hidden="true"></span>`;

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
      moved: false,
      downAt: 0,
      downX: 0,
      downY: 0,
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      // Capture only on the object — page scroll stays free otherwise
      el.setPointerCapture(e.pointerId);
      dragging = body;
      body.moved = false;
      body.downAt = performance.now();
      body.downX = e.clientX;
      body.downY = e.clientY;
      body.vx = 0;
      body.vy = 0;
      el.classList.add('is-dragging');
      el.classList.remove('is-spin');
      tip.hidden = true;
      e.preventDefault();
    });

    el.addEventListener('pointermove', (e) => {
      if (dragging !== body) return;
      const dx = e.clientX - body.downX;
      const dy = e.clientY - body.downY;
      if (!body.moved && Math.hypot(dx, dy) < 6) return;
      body.moved = true;
      const xPct = (e.clientX / window.innerWidth) * 100;
      const yPct = (e.clientY / window.innerHeight) * 100;
      const prevX = body.x;
      const prevY = body.y;
      setPos(body, xPct, yPct);
      body.vx = body.x - prevX;
      body.vy = body.y - prevY;
      body.ox = 0;
      body.oy = 0;
    });

    function endDrag(e) {
      if (dragging !== body) return;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* already released */
      }
      el.classList.remove('is-dragging');
      dragging = null;
      if (!body.moved) {
        el.classList.add('is-spin');
        showTip(spec.fact, el);
        window.setTimeout(() => el.classList.remove('is-spin'), 900);
      } else if (!reduced) {
        // mild inertia kick from last velocity
        body.vx *= 1.4;
        body.vy *= 1.4;
      }
    }

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('pointerenter', () => {
      if (window.matchMedia('(hover: hover)').matches && !dragging) {
        showTip(spec.fact, el);
      }
    });

    // Prevent accidental click after drag
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
    // Static placement only — no magnetic/inertia loops
    return;
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const body of bodies) {
      if (dragging === body) continue;

      // Magnetic nudge near cursor
      if (pointer.active) {
        const cx = (body.x / 100) * w;
        const cy = (body.y / 100) * h;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const radius = 140;
        if (dist < radius) {
          const force = (1 - dist / radius) * 18;
          body.ox += (dx / dist) * force * dt;
          body.oy += (dy / dist) * force * dt;
        }
      }

      // Soft spring back toward home + inertia
      body.vx += (body.baseX - body.x) * 0.35 * dt;
      body.vy += (body.baseY - body.y) * 0.35 * dt;
      body.vx *= 0.94;
      body.vy *= 0.94;
      body.ox *= 0.9;
      body.oy *= 0.9;

      const nx = body.x + body.vx + body.ox * 0.08;
      const ny = body.y + body.vy + body.oy * 0.08;
      setPos(body, nx, ny);

      // Subtle follow offset via transform (keeps CSS drift free when not dragging)
      const followX = body.ox * 0.35;
      const followY = body.oy * 0.35;
      body.el.style.setProperty('--mx', `${followX.toFixed(2)}px`);
      body.el.style.setProperty('--my', `${followY.toFixed(2)}px`);
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
