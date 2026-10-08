export const THEME_KEY = 'theme';

export function partFromDate(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';
}

export function readMode() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function daypartOverride() {
  try {
    const value = new URLSearchParams(location.search).get('daypart');
    if (value === 'morning' || value === 'afternoon' || value === 'evening' || value === 'night') {
      return value;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function paletteFor(mode, part) {
  if (mode === 'light') return 'afternoon';
  if (mode === 'dark') return 'night';
  return part;
}

export function themeForPalette(palette) {
  return palette === 'morning' || palette === 'afternoon' ? 'light' : 'dark';
}

export function applyDocumentTheme({ mode, part, palette }) {
  const root = document.documentElement;
  const theme = themeForPalette(palette);
  root.setAttribute('data-theme-mode', mode);
  root.setAttribute('data-daypart', part);
  root.setAttribute('data-palette', palette);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

export const PART_LABEL = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};
