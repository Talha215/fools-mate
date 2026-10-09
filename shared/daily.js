// The daily game. Each UTC date seeds a game in which Gary plays both sides
// at random for a while; everyone who plays that day takes over from the same
// position, as whichever side is to move. Gary's replies after that are
// random per player, as in the main game.
import { Chess } from 'chess.js';

// Daily No. 1.
export const DAILY_EPOCH = '2026-10-09';
const MIN_PLIES = 12; // 6 to 12 moves of Gary v Gary
const MAX_PLIES = 24;

export const todayUTC = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const dailyNumber = (date) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`)) / 86400000) + 1;

// Small deterministic PRNG (xmur3 hash -> mulberry32). Returns rng(n): a
// uniform-enough integer in [0, n). Not for anything secret.
function seeded(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return (n) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296 * n) | 0;
  };
}

const cache = new Map();

// { date, number, moves: [uci], fen, playerColor } for a UTC date. Uses SAN
// moves() rather than verbose moves to stay cheap (see shared/rules.js), and
// is cached per date, so the Worker builds each day once per isolate.
export function dailyPosition(date) {
  if (cache.has(date)) return cache.get(date);
  const rng = seeded(`fools-mate daily ${date}`);
  let result = null;
  for (let attempt = 0; attempt < 100 && !result; attempt++) {
    const plies = MIN_PLIES + rng(MAX_PLIES - MIN_PLIES + 1);
    const chess = new Chess();
    const moves = [];
    while (moves.length < plies && !chess.isGameOver()) {
      const sans = chess.moves();
      moves.push(chess.move(sans[rng(sans.length)]).lan);
    }
    // Hand over a live game, with nobody already in check.
    if (moves.length === plies && !chess.isGameOver() && !chess.inCheck()) {
      result = { date, number: dailyNumber(date), moves, fen: chess.fen(), playerColor: chess.turn() };
    }
  }
  cache.set(date, result);
  return result;
}
