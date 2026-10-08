// Inline SVG icons (stroke-based, inherit currentColor).
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const Svg = ({ children, size, ...p }) => <svg {...base} {...(size && { width: size, height: size })} {...p}>{children}</svg>;

export const IconFirst = (p) => <Svg {...p}><path d="M18 18 11 12l7-6" /><path d="M7 6v12" /></Svg>;
export const IconPrev = (p) => <Svg {...p}><path d="M15 18 9 12l6-6" /></Svg>;
export const IconNext = (p) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>;
export const IconLast = (p) => <Svg {...p}><path d="m6 18 7-6-7-6" /><path d="M17 6v12" /></Svg>;
export const IconFlip = (p) => <Svg {...p}><path d="M7 4v16" /><path d="m3 8 4-4 4 4" /><path d="M17 20V4" /><path d="m21 16-4 4-4-4" /></Svg>;
export const IconPlay = (p) => <Svg {...p}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></Svg>;
export const IconPause = (p) => <Svg {...p}><path d="M8 5v14M16 5v14" strokeWidth="3" /></Svg>;
export const IconClose = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
