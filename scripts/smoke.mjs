// End-to-end API check against a running server (dev or deployed):
//   .\run node scripts\smoke.mjs                      (defaults to http://localhost:5180)
//   .\run node scripts\smoke.mjs https://fools-mate.<you>.workers.dev
// Plays real games through HTTP and checks the anti-cheat guarantees.
// It creates games named "smoke-test", so don't run it against prod casually.
// For a password-protected site, first run:  $env:SITE_PASSWORD = 'your password'
import { Chess } from 'chess.js';
import assert from 'node:assert/strict';

const BASE = (process.argv[2] || 'http://localhost:5180').replace(/\/$/, '');
const AUTH = process.env.SITE_PASSWORD ? { authorization: `Basic ${btoa(`smoke:${process.env.SITE_PASSWORD}`)}` } : {};

async function api(path, body) {
  const res = await fetch(BASE + path, body === undefined ? { headers: AUTH } : {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...AUTH },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('The site is password-protected: set $env:SITE_PASSWORD first.');
  return { status: res.status, data: await res.json() };
}

const randomMove = (fen) => {
  const legal = new Chess(fen).moves({ verbose: true });
  return legal[Math.floor(Math.random() * legal.length)].lan;
};

// 1. A full game as Black: the bot must open, every reply must be legal.
let { status, data } = await api('/api/games', { color: 'b', name: 'smoke-test' });
assert.equal(status, 201);
const { token } = data;
let game = data.game;
assert.equal(game.playerColor, 'b');
assert.equal(game.moves.length, 1, 'bot opens as White');

// 2. Anti-cheat: wrong token, stale ply, illegal move, garbage promotion.
const mv = randomMove(game.fen);
assert.equal((await api(`/api/games/${game.id}/move`, { token: 'nope', ply: game.ply, move: mv })).status, 403);
assert.equal((await api(`/api/games/${game.id}/move`, { token, ply: game.ply + 1, move: mv })).status, 409);
assert.equal((await api(`/api/games/${game.id}/move`, { token, ply: game.ply, move: 'a1a8' })).status, 400);
assert.equal((await api(`/api/games/${game.id}/move`, { token, ply: game.ply, move: 'e7e5q' })).status, 400);

// 3. Replaying the same request can't re-roll the bot's reply.
const first = await api(`/api/games/${game.id}/move`, { token, ply: game.ply, move: mv });
assert.equal(first.status, 200);
const again = await api(`/api/games/${game.id}/move`, { token, ply: game.ply, move: mv });
assert.equal(again.status, 409);
assert.deepEqual(again.data.game.moves, first.data.game.moves);
game = first.data.game;

// 4. Play it out with random moves; the server's moves must replay legally.
let requests = 0;
while (game.status === 'active') {
  const r = await api(`/api/games/${game.id}/move`, { token, ply: game.ply, move: randomMove(game.fen) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  game = r.data.game;
  requests++;
}
const chess = new Chess();
for (const uci of game.moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
assert.equal(chess.fen(), game.fen, 'stored moves replay to the stored position');
console.log(`game ${game.id}: ${game.result} by ${game.reason} after ${game.ply} plies (${requests} requests)`);

// 5. Resign, rename, public read without token, lists.
const g2 = await api('/api/games', { color: 'w', name: 'smoke-test' });
assert.equal(g2.data.game.moves.length, 0);
assert.equal((await api(`/api/games/${g2.data.game.id}/resign`, { token: g2.data.token })).data.game.result, 'resigned');
assert.equal((await api(`/api/games/${g2.data.game.id}/name`, { token: g2.data.token, name: '  smoke‮-test  ' })).data.game.name, 'smoke-test');
assert.equal((await api(`/api/games/${g2.data.game.id}`)).data.game.token, undefined);
assert.ok(Array.isArray((await api('/api/leaderboard')).data.entries));
assert.ok(Array.isArray((await api('/api/leaderboard?unique=1&color=w')).data.entries));
assert.ok((await api('/api/games?scope=recent')).data.games.length >= 2);
const stats = (await api('/api/stats')).data;
assert.ok(stats.games >= 2);
assert.equal((await api('/api/games/doesnotexist1')).status, 404);
console.log('stats', stats);
console.log('smoke test passed');
