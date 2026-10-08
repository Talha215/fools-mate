import { useSyncExternalStore } from 'react';
import { load, save } from './storage.js';

const KEY = 'fm.settings';
const DEFAULTS = {
  name: '',
  theme: 'brown',
  sound: true,
  coords: true,
  odds: true, // show the bot's mating chances
  color: 'w', // last colour picked on the home page
};

let state = { ...DEFAULTS, ...load(KEY, {}) };
const listeners = new Set();

export const getSettings = () => state;

export function updateSettings(patch) {
  state = { ...state, ...patch };
  save(KEY, state);
  listeners.forEach((l) => l());
}

export function useSettings() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const THEMES = {
  brown: { label: 'Walnut', light: '#f0d9b5', dark: '#b58863', last: 'rgba(155, 199, 0, 0.41)' },
  green: { label: 'Tournament', light: '#ebecd0', dark: '#739552', last: 'rgba(255, 255, 51, 0.45)' },
  blue: { label: 'Glacier', light: '#dee3e6', dark: '#8ca2ad', last: 'rgba(155, 199, 0, 0.41)' },
  purple: { label: 'Royal', light: '#efe6f6', dark: '#9b7fbf', last: 'rgba(255, 220, 90, 0.5)' },
};

// Squares as an 8x8 SVG of crisp rects: no seams at fractional board sizes,
// which a CSS gradient checkerboard can show.
const images = {};
export function boardImage(themeKey) {
  return (images[themeKey] ??= buildBoardImage(THEMES[themeKey] || THEMES.brown));
}

function buildBoardImage(t) {
  let rects = '';
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) if ((r + f) % 2 === 1) rects += `<rect x='${f}' y='${r}' width='1' height='1'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><rect width='8' height='8' fill='${t.light}'/><g fill='${t.dark}'>${rects}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
