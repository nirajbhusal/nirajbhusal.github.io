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

initTheme();
initYear();

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
