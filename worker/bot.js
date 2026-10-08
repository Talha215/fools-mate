// Gary's entire brain.
//
// Given the position (a chess.js instance) and every legal move in it as SAN
// strings ("e4", "Nxf7+", "e8=Q#"), return one of those strings. Today that's a
// uniformly random pick. A future bot can be as clever (or as cursed) as you
// like, as long as it returns an element of `legalMoves`; the caller
// re-validates it either way. Keep it cheap: Cloudflare's free plan allows
// 10 ms of CPU per request (measure with scripts/bench-cpu.mjs).
//
// `rng(n)` returns a uniform integer in [0, n). The Worker passes a crypto
// source; tests pass a seeded one.
export function chooseMove(chess, legalMoves, rng) {
  return legalMoves[rng(legalMoves.length)];
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
