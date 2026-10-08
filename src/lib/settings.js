import { useSyncExternalStore } from 'react';
import { load, save } from './storage.js';

const KEY = 'fm.settings';
const DEFAULTS = {
  name: '',
  theme: 'newsprint',
  sound: true,
  coords: true,
  odds: true, // show Gary's options as tally marks
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

// coordOnLight / coordOnDark: coordinate text colour on each square colour
// (defaults to the opposite square's colour).
export const THEMES = {
  newsprint: { label: 'Newsprint', light: '#f2ebdb', dark: '#a8997b', last: 'rgba(201, 152, 24, 0.42)' },
  // Printed-diagram style: dark squares are diagonal hatching, as in chess books.
  diagram: {
    label: 'Diagram',
    light: '#f6f1e5',
    dark: '#2a2621',
    hatch: true,
    last: 'rgba(201, 152, 24, 0.4)',
    coordOnLight: '#2a2621',
    coordOnDark: '#2a2621',
  },
  brown: { label: 'Walnut', light: '#f0d9b5', dark: '#b58863', last: 'rgba(155, 199, 0, 0.41)' },
  green: { label: 'Club', light: '#ebecd0', dark: '#739552', last: 'rgba(255, 255, 51, 0.45)' },
};

// Squares as an 8x8 SVG of crisp rects: no seams at fractional board sizes,
// which a CSS gradient checkerboard can show.
const images = {};
export function boardImage(themeKey) {
  return (images[themeKey] ??= buildBoardImage(themeOf(themeKey)));
}

export const themeOf = (key) => THEMES[key] || THEMES.newsprint;

function buildBoardImage(t) {
  let rects = '';
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) if ((r + f) % 2 === 1) rects += `<rect x='${f}' y='${r}' width='1' height='1'/>`;
  const dark = t.hatch
    ? `<defs><pattern id='h' width='0.1' height='1' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='0.032' height='1' fill='${t.dark}'/></pattern></defs><g fill='url(#h)'>${rects}</g>`
    : `<g fill='${t.dark}' shape-rendering='crispEdges'>${rects}</g>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='${t.light}'/>${dark}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
