import './style.css';
import { initStarfield } from './starfield.js';
import { initOrbitDodge } from './orbit-dodge.js';
import { initConstellation } from './constellation.js';
import { createAmbient } from './ambient.js';
import { initSpaceObjects } from './space-objects.js';
import { initEnterGateVista } from './enter-gate.js';

const THEME_KEY = 'theme';
const GATE_KEY = 'nb-entered';
const EMAIL = 'niraj.bhusal@icloud.com';
const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function periodFromHour(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

function applyTimeOfDay(period) {
  document.documentElement.setAttribute('data-tod', period);
}

function initTimeOfDay() {
  const tick = () => {
    applyTimeOfDay(periodFromHour(new Date().getHours()));
  };
  tick();
  // Refresh every minute so dawn/dusk transitions land cleanly
  window.setInterval(tick, 60_000);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
  applyTheme(theme);
  const btn = document.getElementById('theme-toggle');
  btn?.addEventListener('click', () => {
    const next =
      document.documentElement.getAttribute('data-theme') === 'light'
        ? 'dark'
        : 'light';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
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
  if (!timeEls.length && !yearBars.length) return;

  const timeFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  function tick() {
    const now = new Date();
    const stamp = timeFmt.format(now);
    const iso = now.toISOString();
    for (const el of timeEls) {
      el.dateTime = iso;
      el.textContent = stamp;
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

function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  const overlay = document.getElementById('nav-overlay');
  if (!toggle || !nav) return;

  const MOBILE_MQ = '(max-width: 900px)';
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  let lastFocus = null;
  let lockY = 0;

  function isMobileNav() {
    return window.matchMedia(MOBILE_MQ).matches;
  }

  function focusables() {
    // offsetParent is null for position:fixed in some engines — do not use it
    return [toggle, ...links].filter((el) => {
      if (!el || el.hasAttribute('disabled')) return false;
      const style = window.getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });
  }

  function setOpen(open) {
    const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    nav.setAttribute('aria-hidden', open || !isMobileNav() ? 'false' : 'true');
    if (overlay) {
      overlay.hidden = !open;
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    if (open && !wasOpen) {
      lockY = window.scrollY || window.pageYOffset || 0;
      document.body.classList.add('nav-open');
      document.body.style.top = `-${lockY}px`;
      lastFocus = document.activeElement;
      window.setTimeout(() => links[0]?.focus(), 40);
    } else if (!open && wasOpen) {
      document.body.classList.remove('nav-open');
      document.body.style.top = '';
      window.scrollTo(0, lockY);
      (lastFocus || toggle).focus?.();
    } else if (!open) {
      document.body.classList.remove('nav-open');
      document.body.style.top = '';
    }
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    setOpen(open);
  });


  overlay?.addEventListener('click', () => setOpen(false));

  links.forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (
      e.key === 'Tab' &&
      toggle.getAttribute('aria-expanded') === 'true' &&
      isMobileNav()
    ) {
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobileNav()) setOpen(false);
  });

  const sections = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  function setActiveFromScroll() {
    const marker = window.scrollY + 120;
    let current = sections[0];
    for (const section of sections) {
      if (section.offsetTop <= marker) current = section;
    }
    const id = current?.id;
    links.forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
    });
  }

  window.addEventListener('scroll', setActiveFromScroll, { passive: true });
  setActiveFromScroll();
}

function wireGame(canvas, hudIds, padId, startId, pauseId) {
  if (!canvas) return null;
  const game = initOrbitDodge(canvas, {
    score: document.getElementById(hudIds.score),
    wave: document.getElementById(hudIds.wave),
    high: document.getElementById(hudIds.high),
  }, padId);
  document.getElementById(startId)?.addEventListener('click', () => game.start());
  document.getElementById(pauseId)?.addEventListener('click', () => game.pause());
  return game;
}

function initOrbitModal(sectionGame) {
  const fab = document.getElementById('orbit-fab');
  const modal = document.getElementById('orbit-modal');
  const closeBtns = document.querySelectorAll('[data-orbit-close]');
  const openFromSection = document.getElementById('od-open-modal');
  if (!fab || !modal) return;

  const modalCanvas = document.getElementById('orbit-dodge-modal');
  const modalGame = wireGame(
    modalCanvas,
    { score: 'odm-score', wave: 'odm-wave', high: 'odm-high' },
    'touch-pad-modal',
    'odm-start',
    'odm-pause'
  );

  let lastFocus = null;

  function setOpen(open) {
    const wasOpen = !modal.hidden;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('orbit-open', open);
    modal.hidden = !open;
    if (open && !wasOpen) {
      lastFocus = document.activeElement;
      sectionGame?.pause?.(true);
      window.setTimeout(() => {
        document.getElementById('odm-start')?.focus();
        modalGame?.start();
      }, 40);
    } else if (!open && wasOpen) {
      modalGame?.pause?.(true);
      (lastFocus || fab).focus?.();
    }
  }

  fab.addEventListener('click', () => setOpen(true));
  openFromSection?.addEventListener('click', () => setOpen(true));
  closeBtns.forEach((el) => el.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) {
      e.preventDefault();
      setOpen(false);
    }
  });
}

function syncSoundButton(btn, ambient) {
  if (!btn) return;
  const on = ambient.isStarted() && !ambient.isMuted();
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  btn.title = on ? 'Sound on — click to mute' : 'Sound off — click to unmute';
}

function initAmbientAndGate(cosmo) {
  const ambient = createAmbient();
  const soundBtn = document.getElementById('sound-toggle');
  const gate = document.getElementById('enter-gate');
  const enterBtn = document.getElementById('enter-gate-btn');
  const gateCanvas = document.getElementById('enter-gate-canvas');

  const already = sessionStorage.getItem(GATE_KEY) === '1';
  const vista =
    gate && !already
      ? initEnterGateVista(gateCanvas)
      : { warp: async () => {}, destroy: () => {} };

  syncSoundButton(soundBtn, ambient);

  soundBtn?.addEventListener('click', async () => {
    if (!ambient.isStarted()) {
      await ambient.start();
      if (ambient.isMuted()) ambient.setMuted(false);
    } else {
      ambient.toggleMute();
    }
    syncSoundButton(soundBtn, ambient);
  });

  let dismissing = false;
  async function dismissGate(startSound) {
    if (!gate || gate.hidden || dismissing) return;
    dismissing = true;
    enterBtn?.setAttribute("disabled", "");
    if (startSound) {
      await ambient.start();
      if (ambient.isMuted()) {
        // keep muted preference; user can unmute via Sound
      }
    }
    sessionStorage.setItem(GATE_KEY, '1');
    syncSoundButton(soundBtn, ambient);
    const reduced = prefersReduced();
    gate.classList.add(reduced ? 'is-leaving' : 'is-crossing');
    document.body.classList.remove('gate-locked');
    document.body.classList.add('is-entering');
    const done = () => {
      gate.hidden = true;
      gate.setAttribute('hidden', '');
      gate.setAttribute('aria-hidden', 'true');
      gate.style.pointerEvents = 'none';
      gate.classList.remove('is-leaving', 'is-crossing');
      document.body.classList.remove('is-entering', 'gate-locked');
      vista.destroy();
      // Drop canvas so it cannot intercept hits on iOS Safari
      if (gateCanvas && gateCanvas.parentNode) {
        gateCanvas.width = 0;
        gateCanvas.height = 0;
        gateCanvas.remove();
      }
      // Cosmo layer must be interactive after Enter
      cosmo?.refresh?.();
      cosmo?.syncHitState?.();
    };
    if (reduced) {
      window.setTimeout(done, 320);
      return;
    }
    await vista.warp(2100);
    gate.classList.add('is-leaving');
    window.setTimeout(done, 420);
  }

  if (already || !gate) {
    gate?.setAttribute('hidden', '');
    gate?.setAttribute('aria-hidden', 'true');
    if (gate) gate.style.pointerEvents = 'none';
    document.body.classList.remove('gate-locked');
    vista.destroy();
    if (gateCanvas && gateCanvas.parentNode) gateCanvas.remove();
    cosmo?.refresh?.();
  } else {
    enterBtn?.focus();
    enterBtn?.addEventListener('click', () => dismissGate(true));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !gate.hidden && document.activeElement === enterBtn) {
        // native button click handles it
      }
      if (e.key === 'Escape' && !gate.hidden) {
        e.preventDefault();
        dismissGate(false);
      }
    });
  }

  return ambient;
}


function initQuietIdle() {
  let timer = 0;
  const IDLE_MS = 4200;
  const mark = () => {
    document.body.classList.remove('is-idle');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      document.body.classList.add('is-idle');
    }, IDLE_MS);
  };
  ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((evt) => {
    window.addEventListener(evt, mark, { passive: true });
  });
  mark();
}

initTimeOfDay();
initQuietIdle();
initTheme();
initYear();
initHeroChrono();
initContactCards();
initNav();
initReveal();
const cosmo = initSpaceObjects(document.getElementById('cosmo-layer'));
initAmbientAndGate(cosmo);

const starCanvas = document.getElementById('starfield');
if (starCanvas) initStarfield(starCanvas);

const sectionGame = wireGame(
  document.getElementById('orbit-dodge'),
  { score: 'od-score', wave: 'od-wave', high: 'od-high' },
  'touch-pad',
  'od-start',
  'od-pause'
);
initOrbitModal(sectionGame);

const constCanvas = document.getElementById('constellation');
const factPanel = document.getElementById('fact-panel');
if (constCanvas && factPanel) initConstellation(constCanvas, factPanel);
