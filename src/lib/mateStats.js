import { useMemo, useRef } from 'react';
import { matingMoves, START_FEN } from '../../shared/rules.js';

// For every bot move in the game: how many of its legal moves were mate, and
// did it find one? "Close calls" are turns it had a mate and played something
// else. Results are cached per position so a growing game only computes the
// new turn.
export function useMateStats(plies, botColor) {
  const cache = useRef(new Map());
  return useMemo(() => {
    let closeCalls = 0;
    let bestOdds = 0;
    const turns = [];
    plies.forEach((p, i) => {
      if (p.color !== botColor) return;
      const before = i === 0 ? START_FEN : plies[i - 1].fen;
      let r = cache.current.get(before);
      if (!r) {
        r = matingMoves(before);
        cache.current.set(before, r);
      }
      const hit = p.san.endsWith('#');
      if (r.mates > 0 && !hit) closeCalls++;
      if (r.total) bestOdds = Math.max(bestOdds, r.mates / r.total);
      turns.push({ ply: i, ...r, hit });
    });
    return { closeCalls, bestOdds, turns };
  }, [plies, botColor]);
}

export const pct = (x) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;
