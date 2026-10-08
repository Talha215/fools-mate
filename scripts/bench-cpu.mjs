// Measures the CPU cost of one move request's game logic. Cloudflare's free
// plan allows 10 ms of CPU per request, so keep an eye on this if the bot
// ever gets a real brain:  .\run node scripts\bench-cpu.mjs
import { Chess } from 'chess.js';
import { newGame, playerMove } from '../worker/game.js';

let seed = 7;
const rng = (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
const samples = [];
for (let g = 0; g < 20; g++) {
  let s = newGame('w', rng);
  while (!s.result && s.moves.length < 300) {
    const legal = new Chess(s.fen).moves({ verbose: true });
    const uci = legal[rng(legal.length)].lan;
    const t = performance.now();
    s = playerMove(s, uci, rng).state;
    samples.push(performance.now() - t);
  }
}
samples.sort((a, b) => a - b);
const at = (q) => samples[Math.min(samples.length - 1, Math.floor(samples.length * q))].toFixed(2);
console.log(`move requests: ${samples.length}  median ${at(0.5)} ms  p95 ${at(0.95)} ms  p99 ${at(0.99)} ms  max ${at(1)} ms`);
