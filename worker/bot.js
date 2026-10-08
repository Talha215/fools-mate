import { garyOptions } from '../shared/gary.js';

// Gary's move: a uniform pick from the group his one idea allows (see
// shared/gary.js). Returns { from, to, promotion, uci }; the caller plays it
// through the normal legality check, so a broken brain can't cheat.
//
// To give Gary a different personality, change garyOptions (the browser uses
// it too, to show his options) and keep it cheap: Cloudflare's free plan
// allows 10 ms of CPU per request (measure with scripts/bench-cpu.mjs).
//
// `rng(n)` returns a uniform integer in [0, n). The Worker passes a crypto
// source; tests pass a seeded one.
export function chooseMove(chess, rng) {
  const { pool } = garyOptions(chess);
  return pool[rng(pool.length)];
}

// Uniform integer in [0, n) from the Web Crypto API, with rejection sampling so
// there's no modulo bias (not that Gary would notice).
export function cryptoRng(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}
