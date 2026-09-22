/**
 * Floating interactive cosmic objects — continuous drift, tap facts, drag + inertia.
 * Some objects are playable sports affordances (basketball ball/hoop, etc.) that
 * open the ambient court or score a space-throw into a drifting hoop.
 * Mobile/iOS: document-level pointers, tap-vs-drag threshold, layer above content/canvas
 * but below menus; stays interactive after Enter gate; menu open disables hits.
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
    kind: 'basketball',
    play: 'basketball',
    playRole: 'ball',
    label: 'Orbit ball',
    fact: 'Drag me toward the rim — or tap to open the ambient court.',
    x: 78,
    y: 28,
    size: 42,
    depth: 0.75,
  },
  {
    kind: 'hoop',
    play: 'basketball',
    playRole: 'hoop',
    label: 'Cosmic rim',
    fact: 'Fling the orange orbit ball this way for a quiet background swish.',
    x: 88,
    y: 18,
    size: 48,
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
    kind: 'cricket',
    play: 'cricket',
    playRole: 'launch',
    label: 'Pitch moon',
    fact: 'Tap to open quiet cricket in the ambient court.',
    x: 4,
    y: 42,
    size: 34,
    depth: 0.55,
  },
  {
    kind: 'football',
    play: 'football',
    playRole: 'launch',
    label: 'Goal node',
    fact: 'Tap to open quiet football in the ambient court.',
    x: 85,
    y: 78,
    size: 32,
    depth: 0.85,
  },
];

const TAP_PX = 12;
const DRAG_PX = 10;
/** Ball must land within this % of hoop center for a space-throw make */
const HOOP_HIT_PCT = 7.5;

function pointersBlocked() {
  const b = document.body;
  return (
    b.classList.contains('nav-open') ||
    b.classList.contains('orbit-open') ||
    b.classList.contains('gate-locked') ||
    b.classList.contains('is-entering')
  );
}

/**
 * @param {HTMLElement} root
 * @param {{ onPlayTap?: Function, onSpaceThrow?: Function }} [hooks]
 */
export function initSpaceObjects(root, hooks = {}) {
  if (!root) return { refresh: () => {}, destroy: () => {}, setHooks: () => {} };

  let onPlayTap = hooks.onPlayTap || null;
  let onSpaceThrow = hooks.onSpaceThrow || null;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
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
  let last = performance.now();
  let destroyed = false;
  let activePointerId = null;

  root.classList.add('cosmo-layer--live');
  if (reduced) root.classList.add('cosmo-layer--reduced');

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

  function syncHitState() {
    const block = pointersBlocked();
    root.classList.toggle('cosmo-layer--blocked', block);
    for (const body of bodies) {
      body.el.disabled = block;
      body.el.setAttribute('aria-hidden', block ? 'true' : 'false');
      if (block) body.el.classList.remove('is-dragging', 'is-glow', 'is-swish');
    }
    if (block) {
      tip.hidden = true;
      dragging = null;
      activePointerId = null;
    }
  }

  function findHoop() {
    return bodies.find((b) => b.spec.playRole === 'hoop') || null;
  }

  function trySpaceThrow(ballBody) {
    if (!ballBody || ballBody.spec.playRole !== 'ball') return false;
    const hoop = findHoop();
    if (!hoop) return false;
    const dist = Math.hypot(ballBody.x - hoop.x, ballBody.y - hoop.y);
    const made = dist <= HOOP_HIT_PCT;
    hoop.el.classList.add(made ? 'is-swish' : 'is-miss-flash');
    ballBody.el.classList.add(made ? 'is-swish' : 'is-miss-flash');
    window.setTimeout(() => {
      hoop.el.classList.remove('is-swish', 'is-miss-flash');
      ballBody.el.classList.remove('is-swish', 'is-miss-flash');
    }, made ? 900 : 500);
    showTip(
      made ? 'Swish — background make!' : 'Near miss — fling the ball into the rim',
      made ? hoop.el : ballBody.el
    );
    onSpaceThrow?.({
      made,
      game: ballBody.spec.play || 'basketball',
      ballEl: ballBody.el,
      hoopEl: hoop.el,
      dist,
    });
    return made;
  }

  OBJECTS.forEach((spec, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    const playClass = spec.play
      ? ` cosmo-play cosmo-play-${spec.playRole || 'launch'} cosmo-${spec.kind}`
      : ` cosmo-${spec.kind}`;
    el.className = `cosmo-obj${playClass} cosmo-depth-${Math.round(spec.depth * 10)} is-physics${reduced ? ' is-static' : ''}`;
    el.style.setProperty('--x', `${spec.x}%`);
    el.style.setProperty('--y', `${spec.y}%`);
    el.style.setProperty('--size', `${spec.size}px`);
    el.style.setProperty('--delay', `${i * 0.7}s`);
    el.style.setProperty('--depth', String(spec.depth));
    if (spec.play) {
      el.dataset.play = spec.play;
      el.dataset.playRole = spec.playRole || 'launch';
      const verb =
        spec.playRole === 'ball'
          ? 'Playable basketball — drag toward the rim to shoot, or tap for ambient court'
          : spec.playRole === 'hoop'
            ? 'Basketball rim — fling the orbit ball here, or tap for ambient court'
            : `Play ${spec.play} — tap for ambient court`;
      el.setAttribute('aria-label', `${spec.label}: ${verb}`);
    } else {
      el.setAttribute('aria-label', `${spec.label}: ${spec.fact}`);
    }
    el.innerHTML =
      '<span class="cosmo-glow" aria-hidden="true"></span><span class="cosmo-core" aria-hidden="true"></span>' +
      (spec.play
        ? '<span class="cosmo-play-badge" aria-hidden="true">play</span>'
        : '');

    const body = {
      el,
      spec,
      x: spec.x,
      y: spec.y,
      vx: (Math.random() - 0.5) * (reduced ? 0.04 : 0.12),
      vy: (Math.random() - 0.5) * (reduced ? 0.04 : 0.12),
      ox: 0,
      oy: 0,
      baseX: spec.x,
      baseY: spec.y,
      depth: spec.depth,
      radius: spec.size / 2,
      phase: i * 1.73 + spec.depth * 2.1,
      moved: false,
      capturing: false,
      downAt: 0,
      downX: 0,
      downY: 0,
      lastX: 0,
      lastY: 0,
      _lastTs: 0,
      pointerId: null,
    };

    el.addEventListener('pointerdown', (e) => {
      if (pointersBlocked()) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (dragging && dragging !== body) return;

      dragging = body;
      activePointerId = e.pointerId;
      body.pointerId = e.pointerId;
      body.moved = false;
      body.capturing = false;
      body.downAt = performance.now();
      body.downX = e.clientX;
      body.downY = e.clientY;
      body.lastX = e.clientX;
      body.lastY = e.clientY;
      body._lastTs = e.timeStamp || performance.now();
      body.vx = 0;
      body.vy = 0;
      el.classList.add('is-dragging');
      el.classList.remove('is-spin');
      tip.hidden = true;

      if (coarse || e.pointerType === 'touch') {
        try {
          el.setPointerCapture(e.pointerId);
          body.capturing = true;
        } catch (_) {
          /* ignore */
        }
      }
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

  function onPointerMove(e) {
    if (!dragging) return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;
    if (pointersBlocked()) {
      endDrag(e, true);
      return;
    }

    const body = dragging;
    const dx = e.clientX - body.downX;
    const dy = e.clientY - body.downY;
    const dist = Math.hypot(dx, dy);

    if (!body.moved && dist >= DRAG_PX) {
      body.moved = true;
      if (!body.capturing) {
        try {
          body.el.setPointerCapture(e.pointerId);
          body.capturing = true;
        } catch (_) {
          /* ignore */
        }
      }
    }

    if (!body.moved) return;

    if (e.cancelable) e.preventDefault();

    const xPct = (e.clientX / window.innerWidth) * 100;
    const yPct = (e.clientY / window.innerHeight) * 100;
    const prevX = body.x;
    const prevY = body.y;
    const nowTs = e.timeStamp || performance.now();
    const dtMs = Math.max(8, nowTs - (body._lastTs || nowTs));
    body._lastTs = nowTs;
    const scale = 16 / dtMs;
    body.vx = ((e.clientX - body.lastX) / window.innerWidth) * 100 * scale;
    body.vy = ((e.clientY - body.lastY) / window.innerHeight) * 100 * scale;
    body.lastX = e.clientX;
    body.lastY = e.clientY;
    setPos(body, xPct, yPct);
    body.vx = body.vx * 0.55 + (body.x - prevX) * 0.45;
    body.vy = body.vy * 0.55 + (body.y - prevY) * 0.45;
    body.ox = 0;
    body.oy = 0;
    body.baseX = body.x;
    body.baseY = body.y;
  }

  function endDrag(e, cancelled = false) {
    if (!dragging) return;
    if (
      e &&
      activePointerId != null &&
      e.pointerId !== undefined &&
      e.pointerId !== activePointerId
    ) {
      return;
    }

    const body = dragging;
    const el = body.el;
    const wasMoved = body.moved;
    const dist = e
      ? Math.hypot(e.clientX - body.downX, e.clientY - body.downY)
      : 0;

    if (body.capturing && e) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* already released */
      }
    }

    el.classList.remove('is-dragging');
    dragging = null;
    activePointerId = null;
    body.capturing = false;
    body.pointerId = null;

    if (cancelled || pointersBlocked()) return;

    const isTap = !wasMoved && dist < TAP_PX;
    if (isTap) {
      el.classList.add('is-spin');
      window.setTimeout(() => el.classList.remove('is-spin'), 900);

      if (body.spec.play && onPlayTap) {
        showTip(body.spec.fact, el);
        onPlayTap({
          game: body.spec.play,
          role: body.spec.playRole || 'launch',
          el,
          label: body.spec.label,
        });
        return;
      }

      showTip(body.spec.fact, el);
      return;
    }

    // Fling: if this is the basketball, test hoop proximity at release
    if (body.spec.playRole === 'ball') {
      trySpaceThrow(body);
    }

    const boost = reduced ? 1.15 : 1.85;
    const maxV = reduced ? 1.2 : 3.2;
    body.vx *= boost;
    body.vy *= boost;
    body.vx = clamp(body.vx, -maxV, maxV);
    body.vy = clamp(body.vy, -maxV, maxV);
  }

  function onPointerUp(e) {
    endDrag(e, false);
  }

  function onPointerCancel(e) {
    endDrag(e, true);
  }

  document.addEventListener('pointermove', onPointerMove, { passive: false });
  document.addEventListener('pointerup', onPointerUp, { passive: true });
  document.addEventListener('pointercancel', onPointerCancel, { passive: true });

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
      if (e.pointerType === 'touch' && !dragging) {
        return;
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = e.pointerType === 'mouse' || e.pointerType === 'pen';
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

  for (const body of bodies) {
    body.el.addEventListener('pointerenter', () => {
      if (pointersBlocked() || dragging) return;
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        body.el.classList.add('is-glow');
        showTip(body.spec.fact, body.el);
      }
    });
    body.el.addEventListener('pointerleave', () => {
      body.el.classList.remove('is-glow');
    });
  }

  const mo = new MutationObserver(syncHitState);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncHitState();

  function tick(now) {
    if (destroyed) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = now / 1000;
    const magStrength = coarse ? 0 : 26;
    const magRadius = 160;
    const driftAmp = reduced ? 0.035 : 0.11;
    const damp = reduced ? 0.985 : 0.962;
    const homeK = reduced ? 0.06 : 0.16;

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
      if (dragging === body) {
        body.el.style.setProperty('--mx', '0px');
        body.el.style.setProperty('--my', '0px');
        continue;
      }

      const driftX =
        Math.sin(t * (0.22 + body.depth * 0.08) + body.phase) * driftAmp;
      const driftY =
        Math.cos(t * (0.18 + body.depth * 0.06) + body.phase * 1.3) *
        driftAmp *
        0.85;
      body.vx += driftX * dt * 60 * 0.02;
      body.vy += driftY * dt * 60 * 0.02;

      const homeX =
        body.baseX +
        Math.sin(t * 0.07 + body.phase) * (reduced ? 1.2 : 3.5) * body.depth;
      const homeY =
        body.baseY +
        Math.cos(t * 0.06 + body.phase * 0.9) *
          (reduced ? 1.0 : 2.8) *
          body.depth;
      body.vx += (homeX - body.x) * homeK * dt;
      body.vy += (homeY - body.y) * homeK * dt;

      if (pointer.active && magStrength > 0) {
        const cx = (body.x / 100) * w;
        const cy = (body.y / 100) * h;
        const dx = pointer.x - cx;
        const dy = pointer.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < magRadius) {
          const force =
            (1 - dist / magRadius) * magStrength * (0.6 + body.depth * 0.5);
          body.ox += (dx / dist) * force * dt;
          body.oy += (dy / dist) * force * dt;
        }
      }

      body.vx *= damp;
      body.vy *= damp;
      body.ox *= 0.88;
      body.oy *= 0.88;

      const nx = body.x + body.vx + body.ox * 0.09;
      const ny = body.y + body.vy + body.oy * 0.09;
      setPos(body, nx, ny);

      const parallax = (scrollY * 0.018 * body.depth) % 40;
      const followX = body.ox * (0.28 + body.depth * 0.2);
      const followY = body.oy * (0.28 + body.depth * 0.2) - parallax;
      body.el.style.setProperty('--mx', `${followX.toFixed(2)}px`);
      body.el.style.setProperty('--my', `${followY.toFixed(2)}px`);
      body.el.style.setProperty(
        '--zscale',
        (0.92 + body.depth * 0.12).toFixed(3)
      );
    }

    raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  startLoop();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      cancelAnimationFrame(raf);
    } else {
      startLoop();
    }
  });

  function refresh() {
    syncHitState();
    root.style.display = 'none';
    void root.offsetHeight;
    root.style.display = '';
    startLoop();
  }

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(raf);
    mo.disconnect();
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerCancel);
    tip.remove();
  }

  function setHooks(next = {}) {
    if (next.onPlayTap !== undefined) onPlayTap = next.onPlayTap;
    if (next.onSpaceThrow !== undefined) onSpaceThrow = next.onSpaceThrow;
  }

  return { refresh, destroy, syncHitState, setHooks };
}
