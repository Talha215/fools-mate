// Browser-side chess helpers for the board UI. The server re-checks every move.
import { Chess } from 'chess.js';

const VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1 };

export const cgColor = (c) => (c === 'w' ? 'white' : 'black');
export const other = (c) => (c === 'w' ? 'b' : 'w');
export const turnOf = (fen) => fen.split(' ')[1];

// chessground wants legal moves as Map<fromSquare, toSquare[]>.
export function legalDests(fen) {
  const dests = new Map();
  for (const m of new Chess(fen).moves({ verbose: true })) {
    if (!dests.has(m.from)) dests.set(m.from, []);
    dests.get(m.from).push(m.to);
  }
  return dests;
}

export const pieceAt = (fen, square) => new Chess(fen).get(square);

export const isPromotion = (fen, from, to) => {
  const p = pieceAt(fen, from);
  return p?.type === 'p' && (to[1] === '8' || to[1] === '1');
};

// Material imbalance, chess.com style: each side shows the opponent pieces it
// is "up" (by count, so promotions are handled) plus a +N points badge.
export function material(fen) {
  const count = { w: { q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { q: 0, r: 0, b: 0, n: 0, p: 0 } };
  for (const ch of fen.split(' ')[0]) {
    const t = ch.toLowerCase();
    if (t in VALUES) count[ch === t ? 'b' : 'w'][t]++;
  }
  const res = { w: { pieces: [], score: 0 }, b: { pieces: [], score: 0 } };
  let diff = 0;
  for (const t of Object.keys(VALUES)) {
    const d = count.w[t] - count.b[t];
    diff += d * VALUES[t];
    for (let i = 0; i < Math.abs(d); i++) res[d > 0 ? 'w' : 'b'].pieces.push(t);
  }
  if (diff > 0) res.w.score = diff;
  if (diff < 0) res.b.score = -diff;
  return res;
}

// The king square of the side in check, for chessground's red glow.
export const checkColor = (fen) => (new Chess(fen).inCheck() ? cgColor(turnOf(fen)) : false);

export const REASONS = {
  checkmate: 'by checkmate',
  stalemate: 'by stalemate',
  repetition: 'by threefold repetition',
  fifty: 'by the 50-move rule',
  insufficient: 'by insufficient material',
  resign: 'by giving up',
};

export function formatDuration(ms) {
  if (ms == null) return '–';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
