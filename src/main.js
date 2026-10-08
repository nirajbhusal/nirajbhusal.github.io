import './style.css';
import './chrome.css';
import { initStarfield } from './starfield.js';
import { initConstellation } from './constellation.js';
import { createAmbient } from './ambient.js';
import { initBasketball } from './sports-games.js';
import { initIntro } from './intro.js';
import {
  THEME_KEY,
  PART_LABEL,
  partFromDate,
  readMode,
  daypartOverride,
  paletteFor,
  applyDocumentTheme,
} from './theme.js';

const EMAIL = 'niraj.bhusal@icloud.com';
const SIDEBAR_KEY = 'nb-sidebar';
const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let forcedPart = daypartOverride();

function syncTheme(mode) {
  const part = forcedPart || partFromDate(new Date());
  const palette = forcedPart || paletteFor(mode, part);
  applyDocumentTheme({ mode, part, palette });
  const label =
    mode === 'auto'
      ? `Auto · ${PART_LABEL[part] || 'Night'}`
      : mode === 'light'
        ? 'Light'
        : 'Dark';
  document.querySelectorAll('.theme-cycle').forEach((btn) => {
    btn.setAttribute('aria-label', `Theme: ${label}`);
    btn.title = label;
  });
}

function initTheme() {
  const apply = () => syncTheme(readMode());
  apply();
  window.setInterval(apply, 120_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') apply();
  });

  const order = ['auto', 'light', 'dark'];
  document.querySelectorAll('.theme-cycle').forEach((btn) => {
    btn.addEventListener('click', () => {
      forcedPart = null;
      const mode = readMode();
      const next = order[(order.indexOf(mode) + 1) % order.length];
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      syncTheme(next);
    });
  });
}

function initYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = String(new Date().getFullYear());
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86_400_000);
}

function daysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Shared live chrono for hero + Enter gate — one clock keeps both in sync. */
function initHeroChrono() {
  const timeEls = [...document.querySelectorAll('[data-chrono="datetime"]')];
  const yearBars = [...document.querySelectorAll('[data-chrono="year-bar"]')];
  const yearFills = [...document.querySelectorAll('[data-chrono="year-fill"]')];
  const yearPcts = [...document.querySelectorAll('[data-chrono="year-pct"]')];
  const yearLabels = [...document.querySelectorAll('[data-chrono="year-label"]')];
  const dayBars = [...document.querySelectorAll('[data-chrono="day-bar"]')];
  const dayFills = [...document.querySelectorAll('[data-chrono="day-fill"]')];
  const dayPcts = [...document.querySelectorAll('[data-chrono="day-pct"]')];
  const dayLabels = [...document.querySelectorAll('[data-chrono="day-label"]')];
  const kathmanduEls = [...document.querySelectorAll('[data-chrono="kathmandu"]')];
  if (!timeEls.length && !yearBars.length && !kathmanduEls.length) return;

  const timeFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const kathmanduFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kathmandu',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  function tick() {
    const now = new Date();
    const stamp = timeFmt.format(now);
    const iso = now.toISOString();
    for (const el of timeEls) {
      el.dateTime = iso;
      el.textContent = stamp;
    }
    const ktm = `Kathmandu · ${kathmanduFmt.format(now)} NPT`;
    for (const el of kathmanduEls) {
      el.dateTime = iso;
      el.textContent = ktm;
    }

    const diy = daysInYear(now.getFullYear());
    const doy = dayOfYear(now);
    const dayFrac =
      (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) /
      86_400;
    const yearFrac = Math.min(1, (doy - 1 + dayFrac) / diy);
    const yearPercent = yearFrac * 100;
    const rounded = Math.round(yearPercent);
    const yearNow = now.getFullYear();
    const yearText = `Day ${doy} · ${rounded}% of ${yearNow}`;
    const yearAria = `Day ${doy} of ${diy}, ${yearPercent.toFixed(1)} percent of ${yearNow}`;
    const dayPercent = dayFrac * 100;
    const dayPctText = `${dayPercent.toFixed(1)}%`;
    const yearPctText = `${yearPercent.toFixed(1)}%`;

    for (const fill of yearFills) fill.style.width = `${yearPercent}%`;
    for (const bar of yearBars) {
      bar.setAttribute('aria-valuenow', yearPercent.toFixed(1));
      bar.setAttribute('aria-valuetext', yearAria);
    }
    for (const label of yearLabels) label.textContent = yearText;
    for (const pct of yearPcts) pct.textContent = yearPctText;

    for (const fill of dayFills) fill.style.width = `${dayPercent}%`;
    for (const bar of dayBars) {
      bar.setAttribute('aria-valuenow', dayPercent.toFixed(1));
      bar.setAttribute(
        'aria-valuetext',
        `${dayPercent.toFixed(1)} percent of today`
      );
    }
    for (const label of dayLabels) label.textContent = 'Today';
    for (const pct of dayPcts) pct.textContent = dayPctText;
  }

  tick();
  window.setInterval(tick, prefersReduced() ? 30_000 : 1000);
}

function showEmailToast() {
  const toast = document.getElementById('email-toast');
  if (!toast) return;
  toast.hidden = false;
  toast.classList.add('is-visible');
  window.clearTimeout(showEmailToast._t);
  showEmailToast._t = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.hidden = true;
  }, 1600);
}

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    showEmailToast();
    return true;
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = EMAIL;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showEmailToast();
      return true;
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }
}

function initContactCards() {
  const card = document.getElementById('contact-email-card');
  if (!card) return;

  // Prefer mailto on primary click; copy on context menu / long-press / Alt+click
  let pressTimer = 0;
  let longPressed = false;

  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    copyEmail();
  });

  card.addEventListener('click', (e) => {
    if (e.altKey || e.metaKey || longPressed) {
      e.preventDefault();
      copyEmail();
      longPressed = false;
    }
    // else: native mailto
  });

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    longPressed = false;
    pressTimer = window.setTimeout(() => {
      longPressed = true;
      copyEmail();
    }, 550);
  });

  const clearPress = () => window.clearTimeout(pressTimer);
  card.addEventListener('pointerup', clearPress);
  card.addEventListener('pointerleave', clearPress);
  card.addEventListener('pointercancel', clearPress);
}

function initReveal() {
  const nodes = [...document.querySelectorAll('.reveal')];
  if (!nodes.length) return;
  if (prefersReduced() || !('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
  );
  nodes.forEach((n) => io.observe(n));
}

function initSidebar() {
  const btn = document.getElementById('sidebar-collapse');
  if (!btn) return;
  const root = document.documentElement;

  function collapsed() {
    return root.getAttribute('data-sidebar') === 'collapsed';
  }

  function apply(next) {
    if (next) root.setAttribute('data-sidebar', 'collapsed');
    else root.removeAttribute('data-sidebar');
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    const label = next ? 'Expand sidebar' : 'Collapse sidebar';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      /* ignore */
    }
  }

  let stored = null;
  try {
    stored = localStorage.getItem(SIDEBAR_KEY);
  } catch {
    /* ignore */
  }
  apply(stored === 'collapsed' || collapsed());
  btn.addEventListener('click', () => apply(!collapsed()));
}

function initNavDrawer() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('mobile-nav');
  const scrim = document.getElementById('nav-scrim');
  if (!toggle || !nav || !scrim) return;

  const mq = window.matchMedia('(max-width: 900px)');
  const shell = document.querySelector('.shell-main');
  const search = document.getElementById('md-search');
  const settingsBtn = document.getElementById('md-settings-btn');
  const settings = document.getElementById('md-settings');
  const backdropNodes = [
    document.querySelector('.skip-link'),
    shell,
    document.getElementById('games-launcher'),
    document.getElementById('game-popup'),
  ].filter(Boolean);
  let lastFocus = null;
  let lockedScroll = 0;
  let suppressClick = false;

  function mobile() {
    return mq.matches;
  }

  function isOpen() {
    return document.documentElement.getAttribute('data-nav') === 'open';
  }

  function settingsOpen() {
    return Boolean(settings && !settings.hidden);
  }

  function focusable() {
    return [...nav.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')].filter((el) => {
      if (el.closest('[hidden]')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function applyFilter() {
    const query = (search?.value || '').trim().toLowerCase();
    let primary = 0;
    let sections = 0;
    nav.querySelectorAll('.md-row').forEach((row) => {
      const label = row.getAttribute('data-nav-label') || '';
      const match = !query || label.includes(query);
      row.hidden = !match;
      if (!match) return;
      if (row.getAttribute('data-nav-group') === 'primary') primary += 1;
      else sections += 1;
    });
    const primaryWrap = nav.querySelector('[data-nav-group-wrap="primary"]');
    const sectionsWrap = nav.querySelector('[data-nav-group-wrap="sections"]');
    if (primaryWrap) primaryWrap.hidden = primary === 0;
    if (sectionsWrap) sectionsWrap.hidden = sections === 0;
    const empty = nav.querySelector('.md-empty');
    if (empty) empty.hidden = primary + sections > 0;
  }

  function setSettings(open) {
    if (!settings || !settingsBtn) return;
    settings.hidden = !open;
    settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      window.requestAnimationFrame(() => settings.querySelector('button')?.focus());
    }
  }

  function lockScroll() {
    lockedScroll = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.top = `-${lockedScroll}px`;
    document.body.classList.add('nav-open');
  }

  function unlockScroll() {
    const y = lockedScroll;
    document.body.classList.remove('nav-open');
    document.body.style.top = '';
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    root.style.scrollBehavior = previous;
  }

  function setOpen(open) {
    const next = Boolean(open) && mobile();
    const was = isOpen();
    toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
    toggle.setAttribute('aria-label', next ? 'Close menu' : 'Open menu');
    if (next) {
      lastFocus = document.activeElement;
      document.documentElement.setAttribute('data-nav', 'open');
      nav.removeAttribute('inert');
      nav.removeAttribute('aria-hidden');
      nav.setAttribute('role', 'dialog');
      nav.setAttribute('aria-modal', 'true');
      for (const node of backdropNodes) node.setAttribute('inert', '');
      lockScroll();
      window.requestAnimationFrame(() => nav.focus());
      return;
    }
    setSettings(false);
    if (search && search.value) {
      search.value = '';
      applyFilter();
    }
    document.documentElement.removeAttribute('data-nav');
    nav.removeAttribute('role');
    nav.removeAttribute('aria-modal');
    for (const node of backdropNodes) node.removeAttribute('inert');
    if (was) {
      const back =
        lastFocus && document.contains(lastFocus) && !nav.contains(lastFocus) ? lastFocus : toggle;
      back.focus?.();
    }
    nav.setAttribute('aria-hidden', 'true');
    nav.setAttribute('inert', '');
    if (was) unlockScroll();
  }

  function armSuppressClick() {
    suppressClick = true;
    const stop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      document.removeEventListener('click', stop, true);
    };
    document.addEventListener('click', stop, true);
    window.setTimeout(() => {
      suppressClick = false;
      document.removeEventListener('click', stop, true);
    }, 400);
  }

  toggle.addEventListener('click', () => {
    if (suppressClick) return;
    setOpen(!isOpen());
  });
  document.getElementById('md-close')?.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  nav.addEventListener('click', (event) => {
    if (suppressClick) return;
    if (event.target.closest('a') && mobile()) setOpen(false);
  });
  search?.addEventListener('input', applyFilter);
  settingsBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    setSettings(!settingsOpen());
  });
  document.addEventListener('click', (event) => {
    if (!settingsOpen()) return;
    if (settings.contains(event.target) || settingsBtn.contains(event.target)) return;
    setSettings(false);
  });
  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (settingsOpen()) {
        setSettings(false);
        settingsBtn?.focus();
        return;
      }
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !nav.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !nav.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  });

  let gesture = null;
  document.addEventListener(
    'touchstart',
    (event) => {
      if (!mobile() || event.touches.length !== 1) {
        gesture = null;
        return;
      }
      const touch = event.touches[0];
      const open = isOpen();
      const onDrawer = nav.contains(event.target);
      const onScrim = event.target === scrim;
      if (!open && touch.clientX <= 24) {
        gesture = { x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, mode: 'open' };
      } else if (open && (onDrawer || onScrim)) {
        gesture = { x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, mode: 'close' };
      } else {
        gesture = null;
      }
    },
    { passive: true }
  );
  document.addEventListener(
    'touchmove',
    (event) => {
      if (!gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gesture.dx = touch.clientX - gesture.x;
      gesture.dy = touch.clientY - gesture.y;
    },
    { passive: true }
  );
  document.addEventListener(
    'touchend',
    () => {
      if (!gesture) return;
      const dx = gesture.dx || 0;
      const dy = gesture.dy || 0;
      const horizontal = Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.15;
      if (horizontal && gesture.mode === 'open' && dx > 0) {
        armSuppressClick();
        setOpen(true);
      } else if (horizontal && gesture.mode === 'close' && dx < 0) {
        armSuppressClick();
        setOpen(false);
      }
      gesture = null;
    },
    { passive: true }
  );
  document.addEventListener(
    'touchcancel',
    () => {
      gesture = null;
    },
    { passive: true }
  );

  const onViewport = () => {
    if (!mobile()) setOpen(false);
  };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onViewport);
  else mq.addListener(onViewport);
}

function initGamePopup() {
  const modal = document.getElementById('game-popup');
  const canvas = document.getElementById('game-popup-canvas');
  if (!modal || !canvas) return { open() {}, close() {}, isOpen: () => false };

  const hud = {
    score: document.getElementById('gp-score'),
    extra: document.getElementById('gp-extra'),
  };

  let current = null;
  let lastFocus = null;

  function ensure() {
    if (!current) current = initBasketball(canvas, hud);
    return current;
  }

  function setOpen(open) {
    const wasOpen = !modal.hidden;
    if (open && !wasOpen) {
      lastFocus = document.activeElement;
      document.body.classList.add('orbit-open');
      modal.hidden = false;
      window.setTimeout(() => ensure().start(), 40);
    } else if (!open && wasOpen) {
      current?.pause?.(true);
      modal.hidden = true;
      document.body.classList.remove('orbit-open');
      lastFocus?.focus?.();
    }
  }

  document.getElementById('gp-pause')?.addEventListener('click', () => current?.pause?.(true));
  document.querySelectorAll('[data-game-close]').forEach((el) => {
    el.addEventListener('click', () => setOpen(false));
  });
  document.querySelectorAll('[data-open-game]').forEach((btn) => {
    btn.addEventListener('click', () => setOpen(true));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) {
      e.preventDefault();
      setOpen(false);
    }
  });

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => !modal.hidden,
  };
}

function syncSoundButton(btn, ambient) {
  if (!btn) return;
  const level = ambient.volumeLevel?.() ?? (ambient.isMuted() ? 0 : 2);
  const on = ambient.isStarted() && !ambient.isMuted();
  const pct = Math.round(((ambient.getVolume?.() ?? 0) / (ambient.VOL_MAX || 0.32)) * 100);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('data-vol-level', String(level));
  btn.setAttribute('aria-label', on ? `Ambient sound ${pct}%` : 'Ambient sound off');
  btn.title = on
    ? `Volume ${pct}% — use − / + to adjust`
    : 'Sound off — press + to raise volume';
  const label = btn.querySelector('.sound-label');
  if (label) label.textContent = on ? `${pct}%` : 'Off';
  const root = btn.closest('.sound-control');
  if (root) root.setAttribute('data-vol-level', String(level));
}

function wireVolumeControls(ambient) {
  function syncAll() {
    document.querySelectorAll('.sound-toggle').forEach((btn) => syncSoundButton(btn, ambient));
  }

  async function ensureStarted() {
    if (!ambient.isStarted()) await ambient.start();
  }

  syncAll();
  document.querySelectorAll('.sound-control').forEach((root) => {
    const btn = root.querySelector('.sound-toggle');
    const down = root.querySelector('[id^="sound-vol-down"]');
    const up = root.querySelector('[id^="sound-vol-up"]');
    down?.addEventListener('click', async () => {
      await ensureStarted();
      ambient.volumeDown();
      syncAll();
    });
    up?.addEventListener('click', async () => {
      await ensureStarted();
      ambient.volumeUp();
      syncAll();
    });
    btn?.addEventListener('click', async () => {
      const audible = ambient.isStarted() && !ambient.isMuted();
      await ensureStarted();
      if (audible) ambient.setVolume(0);
      else if (ambient.isMuted()) ambient.volumeUp();
      syncAll();
    });
  });
}

initTheme();
initYear();
initHeroChrono();
initContactCards();
initSidebar();
initNavDrawer();
initReveal();
wireVolumeControls(createAmbient());

const starCanvas = document.getElementById('starfield');
const stars = starCanvas ? initStarfield(starCanvas) : null;
let starsOn = false;
function beginStars() {
  if (starsOn) return;
  starsOn = true;
  stars?.start();
}

function initPortraitDepth() {
  const stage = document.querySelector('.portrait-stage');
  if (!stage) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (reduce || !fine) return;
  const photo = stage.querySelector('.portrait-photo');
  const arc = stage.querySelector('.portrait-arc-wrap');
  const glow = stage.querySelector('.portrait-glow');
  let frame = 0;
  let nx = 0;
  let ny = 0;
  window.addEventListener(
    'pointermove',
    (event) => {
      if (!window.matchMedia('(min-width: 901px)').matches) return;
      nx = event.clientX / window.innerWidth - 0.5;
      ny = event.clientY / window.innerHeight - 0.5;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (photo) photo.style.transform = `translate3d(${nx * -8}px, ${ny * -6}px, 0)`;
        if (arc) arc.style.transform = `translate3d(${nx * 14}px, ${ny * 11}px, 0)`;
        if (glow) glow.style.transform = `translate3d(${nx * 10}px, ${ny * 8}px, 0)`;
      });
    },
    { passive: true }
  );
}
initIntro({ onSettle: beginStars, onDone: beginStars });
initPortraitDepth();

initGamePopup();

const constCanvas = document.getElementById('constellation');
const factPanel = document.getElementById('fact-panel');
if (constCanvas && factPanel) initConstellation(constCanvas, factPanel);
