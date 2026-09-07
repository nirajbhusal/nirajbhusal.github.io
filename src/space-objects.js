/**
 * Floating interactive cosmic objects — non-blocking, reduced-motion aware.
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

  function showTip(text, el) {
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const pad = 12;
    let left = r.left + r.width / 2;
    let top = r.top - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.transform = 'translate(-50%, -100%)';
    // keep on screen
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
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      el.classList.add('is-spin');
      showTip(spec.fact, el);
      window.setTimeout(() => el.classList.remove('is-spin'), 900);
    });
    el.addEventListener('pointerenter', () => {
      if (window.matchMedia('(hover: hover)').matches) showTip(spec.fact, el);
    });
    root.appendChild(el);
  });

  // Hide tip on scroll so it never blocks reading
  window.addEventListener(
    'scroll',
    () => {
      tip.hidden = true;
    },
    { passive: true }
  );
}
