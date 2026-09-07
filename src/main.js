import './style.css';
import { initStarfield } from './starfield.js';
import { initOrbitDodge } from './orbit-dodge.js';
import { initConstellation } from './constellation.js';

const THEME_KEY = 'theme';

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
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

function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  const links = [...nav.querySelectorAll('a[href^="#"]')];

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    setOpen(open);
  });

  links.forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 901px)').matches) setOpen(false);
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

initTheme();
initYear();
initNav();

const starCanvas = document.getElementById('starfield');
if (starCanvas) initStarfield(starCanvas);

const gameCanvas = document.getElementById('orbit-dodge');
if (gameCanvas) {
  const game = initOrbitDodge(gameCanvas, {
    score: document.getElementById('od-score'),
    wave: document.getElementById('od-wave'),
    high: document.getElementById('od-high'),
  });
  document.getElementById('od-start')?.addEventListener('click', () => game.start());
  document.getElementById('od-pause')?.addEventListener('click', () => game.pause());
}

const constCanvas = document.getElementById('constellation');
const factPanel = document.getElementById('fact-panel');
if (constCanvas && factPanel) initConstellation(constCanvas, factPanel);
