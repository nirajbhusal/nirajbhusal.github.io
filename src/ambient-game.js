/**
 * Ambient mini-game shell — corner overlay playable without opening Games.
 * Pointer-events only on chrome/playfield; Esc hides; Fixed vs Shuffle modes.
 */

import { AMBIENT_GAME_CATALOG } from './sports-games.js';

const MODE_KEY = 'nb-ambient-mode';
const HIDDEN_KEY = 'nb-ambient-hidden';
const GAME_KEY = 'nb-ambient-game';
const SHUFFLE_AFTER_SHOTS = 5;
const SHUFFLE_MS = 90_000;

const prefersReduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readMode() {
  const m = localStorage.getItem(MODE_KEY);
  return m === 'shuffle' ? 'shuffle' : 'fixed';
}

function readGameId() {
  const id = localStorage.getItem(GAME_KEY);
  return id && AMBIENT_GAME_CATALOG[id] ? id : 'basketball';
}

/**
 * @param {{ ambient?: { start: Function, isMuted: Function, setVolume: Function, getVolume: Function, volumeUp: Function, VOL_MAX?: number }, onMuteChange?: Function }} deps
 */
export function initAmbientGame(deps = {}) {
  const root = document.getElementById('ambient-game');
  const chip = document.getElementById('ambient-game-chip');
  const panel = document.getElementById('ambient-game-panel');
  const canvas = document.getElementById('ambient-game-canvas');
  const titleEl = document.getElementById('ambient-game-title');
  const hintEl = document.getElementById('ambient-game-hint');
  const modeBtn = document.getElementById('ambient-mode-toggle');
  const muteBtn = document.getElementById('ambient-mute');
  const hideBtn = document.getElementById('ambient-hide');
  const expandBtn = document.getElementById('ambient-expand');
  const chipScore = document.getElementById('ambient-chip-score');
  const chipLabel = document.getElementById('ambient-game-chip-label');

  if (!root || !chip || !panel || !canvas) {
    return { pause() {}, expand() {}, collapse() {}, isExpanded: () => false };
  }

  const hud = {
    score: document.getElementById('ag-score'),
    extra: document.getElementById('ag-extra'),
    makes: document.getElementById('ag-makes'),
    shots: document.getElementById('ag-shots'),
    streak: document.getElementById('ag-streak'),
  };

  const shuffleIds = Object.keys(AMBIENT_GAME_CATALOG);
  let mode = readMode();
  let gameId = mode === 'fixed' ? 'basketball' : readGameId();
  let current = null;
  let expanded = false;
  let suppressed = false;
  let shotsSinceShuffle = 0;
  let shuffleTimer = 0;
  let lastStats = { score: 0, attempts: 0, makes: 0, streak: 0 };

  function sizeCanvas() {
    const w = Math.min(320, Math.max(240, Math.floor(window.innerWidth * 0.42)));
    const h = Math.round(w * 0.62);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      current?.draw?.();
    }
  }

  function syncMuteBtn() {
    if (!muteBtn) return;
    const amb = deps.ambient;
    const muted = !amb || amb.isMuted?.();
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.textContent = muted ? 'Unmute' : 'Mute';
    muteBtn.title = muted
      ? 'Unmute site ambient sound'
      : 'Mute site ambient sound (games stays silent)';
  }

  function syncModeBtn() {
    if (!modeBtn) return;
    modeBtn.setAttribute('aria-pressed', mode === 'shuffle' ? 'true' : 'false');
    modeBtn.textContent = mode === 'shuffle' ? 'Shuffle' : 'Fixed';
    modeBtn.title =
      mode === 'shuffle'
        ? 'Shuffle mode — rotates quiet games after a few rounds'
        : 'Fixed mode — basketball only';
  }

  function syncChip() {
    const spec = AMBIENT_GAME_CATALOG[gameId] || AMBIENT_GAME_CATALOG.basketball;
    if (chipLabel) chipLabel.textContent = expanded ? spec.title : spec.chip;
    chip.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    root.dataset.state = expanded ? 'expanded' : 'collapsed';
    root.dataset.game = gameId;
    root.dataset.mode = mode;
    if (chipScore) {
      const n = lastStats.score || 0;
      chipScore.hidden = n <= 0;
      chipScore.textContent = String(n);
    }
  }

  function syncTitle() {
    const spec = AMBIENT_GAME_CATALOG[gameId] || AMBIENT_GAME_CATALOG.basketball;
    if (titleEl) titleEl.textContent = spec.title;
    if (hintEl) hintEl.textContent = spec.hint;
  }

  function onStats(stats) {
    lastStats = stats || lastStats;
    if (hud.score) hud.score.textContent = String(stats.score ?? 0);
    if (hud.shots) hud.shots.textContent = String(stats.attempts ?? 0);
    if (hud.makes) hud.makes.textContent = String(stats.makes ?? stats.score ?? 0);
    if (hud.streak) hud.streak.textContent = String(stats.streak ?? 0);
    if (hud.extra) {
      hud.extra.textContent = `Shots ${stats.attempts ?? 0} · Streak ${stats.streak ?? 0}`;
    }
    // Relabel Score key for cricket/football
    const scoreKey = root.querySelector('.ambient-hud-score-k');
    if (scoreKey) {
      scoreKey.textContent =
        stats.game === 'cricket' ? 'Runs' : stats.game === 'football' ? 'Goals' : 'Score';
    }
    const makesKey = root.querySelector('.ambient-hud-makes-k');
    if (makesKey) {
      makesKey.textContent =
        stats.game === 'cricket' ? 'Runs' : stats.game === 'football' ? 'Goals' : 'Makes';
    }
    syncChip();
  }

  function clearShuffleTimer() {
    window.clearTimeout(shuffleTimer);
    shuffleTimer = 0;
  }

  function scheduleShuffleTimer() {
    clearShuffleTimer();
    if (mode !== 'shuffle' || !expanded || suppressed || prefersReduced()) return;
    shuffleTimer = window.setTimeout(() => {
      rotateShuffle('timer');
    }, SHUFFLE_MS);
  }

  function destroyCurrent() {
    current?.pause?.(true);
    current = null;
  }

  function mountGame(id) {
    const spec = AMBIENT_GAME_CATALOG[id];
    if (!spec) return;
    destroyCurrent();
    gameId = id;
    localStorage.setItem(GAME_KEY, id);
    sizeCanvas();
    syncTitle();
    shotsSinceShuffle = 0;
    current = spec.init(canvas, hud, {
      ambient: true,
      persistKey: spec.persistKey,
      keyRoot: panel,
      requireFocus: true,
      onStats,
      onShotComplete: () => {
        if (mode !== 'shuffle' || !expanded) return;
        shotsSinceShuffle += 1;
        if (shotsSinceShuffle >= SHUFFLE_AFTER_SHOTS) rotateShuffle('shots');
      },
    });
    if (expanded && !suppressed) {
      current.start();
      canvas.focus?.({ preventScroll: true });
      scheduleShuffleTimer();
    } else {
      current.draw?.();
    }
    syncChip();
  }

  function dockNear(el) {
    if (!el || !root) return;
    const rect = el.getBoundingClientRect();
    const pad = 12;
    const panelW = Math.min(320, window.innerWidth - pad * 2);
    const panelH = 280;
    let left = rect.left + rect.width / 2 - panelW / 2;
    let bottom = window.innerHeight - rect.top + 10;
    left = Math.max(pad, Math.min(left, window.innerWidth - panelW - pad));
    bottom = Math.max(pad, Math.min(bottom, window.innerHeight - panelH - pad));
    // Prefer bottom-left ambient home if object is on the right edge
    if (rect.left > window.innerWidth * 0.55) {
      left = pad;
      bottom = Math.max(pad, window.innerHeight - rect.bottom - 8);
      bottom = Math.min(bottom, window.innerHeight * 0.42);
    }
    root.classList.add('is-docked');
    root.style.setProperty('--ambient-left', `${Math.round(left)}px`);
    root.style.setProperty('--ambient-bottom', `${Math.round(bottom)}px`);
  }

  function clearDock() {
    root.classList.remove('is-docked');
    root.style.removeProperty('--ambient-left');
    root.style.removeProperty('--ambient-bottom');
  }

  /**
   * Open ambient court from a cosmic space icon.
   * @param {string} id
   * @param {{ el?: HTMLElement, role?: string }} [opts]
   */
  function playFromSpace(id, opts = {}) {
    const game = AMBIENT_GAME_CATALOG[id] ? id : 'basketball';
    if (suppressed) return;
    if (opts.el) dockNear(opts.el);
    if (gameId !== game || !current) {
      mountGame(game);
    }
    setExpanded(true);
    // Soft pulse on source icon handled by caller
    canvas.focus?.({ preventScroll: true });
  }

  /** Background fling of orbit ball into cosmic rim — updates basketball HUD/chip. */
  function recordSpaceThrow(made) {
    const ensureBb = () => {
      if (gameId === 'basketball' && current?.applyExternalShot) {
        current.applyExternalShot(!!made);
        return;
      }
      // Persist + HUD without requiring expanded court
      if (gameId !== 'basketball' || !current) {
        // Lightweight score bump via remount basketball stats
        const key = AMBIENT_GAME_CATALOG.basketball.persistKey;
        let data = { score: 0, attempts: 0, streak: 0, bestStreak: 0 };
        try {
          data = { ...data, ...(JSON.parse(sessionStorage.getItem(key) || '{}') || {}) };
        } catch {
          /* ignore */
        }
        data.attempts = (Number(data.attempts) || 0) + 1;
        if (made) {
          data.score = (Number(data.score) || 0) + 1;
          data.streak = (Number(data.streak) || 0) + 1;
          data.bestStreak = Math.max(Number(data.bestStreak) || 0, data.streak);
        } else {
          data.streak = 0;
        }
        try {
          sessionStorage.setItem(key, JSON.stringify(data));
        } catch {
          /* ignore */
        }
        onStats({
          game: 'basketball',
          score: data.score,
          attempts: data.attempts,
          makes: data.score,
          streak: data.streak,
          bestStreak: data.bestStreak,
        });
        // Keep chip discoverable after a background make
        if (made && chipScore) {
          chipScore.hidden = false;
          chipScore.textContent = String(data.score);
        }
        return;
      }
      current.applyExternalShot?.(!!made);
    };
    ensureBb();
  }

  function rotateShuffle(_reason) {
    if (mode !== 'shuffle' || shuffleIds.length < 2) return;
    const idx = shuffleIds.indexOf(gameId);
    const next = shuffleIds[(idx + 1) % shuffleIds.length];
    mountGame(next);
  }

  function setMode(next) {
    mode = next === 'shuffle' ? 'shuffle' : 'fixed';
    localStorage.setItem(MODE_KEY, mode);
    syncModeBtn();
    if (mode === 'fixed') {
      clearShuffleTimer();
      if (gameId !== 'basketball') mountGame('basketball');
      else scheduleShuffleTimer();
    } else {
      scheduleShuffleTimer();
    }
    syncChip();
  }

  function setExpanded(open) {
    if (open && suppressed) return;
    const was = expanded;
    expanded = !!open;
    panel.hidden = !expanded;
    chip.classList.toggle('is-open', expanded);
    localStorage.setItem(HIDDEN_KEY, expanded ? '0' : '1');
    syncChip();
    if (expanded && !was) {
      sizeCanvas();
      if (!current) mountGame(gameId);
      else {
        current.start();
        canvas.focus?.({ preventScroll: true });
        scheduleShuffleTimer();
      }
      // Soft discoverability pulse once — never auto-starts audio
      root.classList.add('is-active');
    } else if (!expanded && was) {
      current?.pause?.(true);
      clearShuffleTimer();
      root.classList.remove('is-active');
      clearDock();
      chip.focus?.({ preventScroll: true });
    }
  }

  function suppress(on) {
    suppressed = !!on;
    if (suppressed) {
      current?.pause?.(true);
      clearShuffleTimer();
      root.classList.add('is-suppressed');
    } else {
      root.classList.remove('is-suppressed');
      if (expanded) {
        current?.start();
        scheduleShuffleTimer();
      }
    }
  }

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  });

  hideBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(false);
  });

  expandBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(true);
  });

  modeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setMode(mode === 'fixed' ? 'shuffle' : 'fixed');
  });

  muteBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const amb = deps.ambient;
    if (!amb) return;
    if (!amb.isStarted?.()) await amb.start();
    if (amb.isMuted()) amb.volumeUp?.() ?? amb.setVolume?.(0.16);
    else amb.setVolume?.(0);
    syncMuteBtn();
    deps.onMuteChange?.();
  });

  // Don't steal page scroll: only stop wheel when over playfield chrome
  panel.addEventListener(
    'wheel',
    (e) => {
      if (e.target === canvas || canvas.contains(e.target)) e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!expanded) return;
    const orbit = document.getElementById('orbit-modal');
    const sports = document.getElementById('sports-modal');
    if ((orbit && !orbit.hidden) || (sports && !sports.hidden)) return;
    e.preventDefault();
    setExpanded(false);
  });

  window.addEventListener(
    'resize',
    () => {
      if (expanded) sizeCanvas();
    },
    { passive: true }
  );

  // Reduced motion: no idle chip animation class
  if (prefersReduced()) root.classList.add('is-reduced');

  syncModeBtn();
  syncMuteBtn();
  sizeCanvas();
  mountGame(gameId);
  // Default: collapsed chip (discoverable). Restore expand only if user left it open.
  setExpanded(localStorage.getItem(HIDDEN_KEY) === '0');
  syncChip();

  return {
    pause: () => suppress(true),
    resume: () => suppress(false),
    expand: () => setExpanded(true),
    collapse: () => setExpanded(false),
    isExpanded: () => expanded,
    syncMute: syncMuteBtn,
    setMode,
    playFromSpace,
    recordSpaceThrow,
  };
}
