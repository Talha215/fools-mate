import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { newGame, playerMove, playerMoveCount, resign } from '../worker/game.js';
import { playUci, replay, outcome } from '../shared/rules.js';
import { garyOptions } from '../shared/gary.js';

// Plays the player's move with Gary forced to reply `botUci` (when the game
// isn't already over), so the rules tests can script exact lines whatever
// Gary's personality is.
function play(state, uci, botUci) {
  const res = playerMove(state, uci, () => 0, () => ({ uci: botUci }));
  assert.ok(res.state, res.error);
  return res.state;
}

const seeded = (seed) => (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
const after = (...san) => {
  const c = new Chess();
  for (const m of san) c.move(m);
  return c;
};

test("fool's mate as White scores 2 and counts as success", () => {
  let s = newGame('w', () => 0);
  s = play(s, 'f2f3', 'e7e5');
  assert.equal(s.result, null);
  s = play(s, 'g2g4', 'd8h4');
  assert.equal(s.result, 'mated');
  assert.equal(s.reason, 'checkmate');
  assert.equal(playerMoveCount(s), 2);
  assert.deepEqual(s.moves, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
});

test('as Black the bot opens and the player move count excludes bot moves', () => {
  const s = newGame('b', () => 0);
  assert.equal(s.moves.length, 1);
  assert.equal(new Chess(s.fen).turn(), 'b');
  assert.equal(playerMoveCount(s), 0);
});

test('checkmating the bot is a "won" (failure)', () => {
  // Scholar's mate delivered by the player.
  let s = newGame('w', () => 0);
  s = play(s, 'e2e4', 'e7e5');
  s = play(s, 'f1c4', 'b8c6');
  s = play(s, 'd1h5', 'g8f6');
  s = play(s, 'h5f7');
  assert.equal(s.result, 'won');
});

test('illegal and out-of-turn moves are rejected without changing state', () => {
  const s = newGame('w', () => 0);
  assert.match(playerMove(s, 'e2e5', () => 0).error, /Illegal/);
  assert.match(playerMove(s, 'nonsense', () => 0).error, /Illegal/);
  const b = newGame('b', () => 0);
  assert.match(playerMove({ ...b, playerColor: 'w' }, 'e2e4', () => 0).error, /not your turn/);
  assert.equal(s.moves.length, 0);
});

test('promotion requires the piece letter and underpromotion works', () => {
  const fen = '8/P6k/8/8/8/8/8/K7 w - - 0 1';
  const s = { playerColor: 'w', fen, moves: [], keys: [], result: null, reason: null };
  assert.match(playerMove(s, 'a7a8', () => 0).error, /Illegal/);
  const r = playerMove(s, 'a7a8n', () => 0);
  assert.ok(r.state);
  assert.equal(new Chess(r.state.fen).get('a8').type, 'n');
});

test('castling and en passant are legal player moves', () => {
  const castle = { playerColor: 'w', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', moves: [], keys: [], result: null, reason: null };
  assert.ok(playerMove(castle, 'e1g1', () => 0).state);
  assert.ok(playerMove(castle, 'e1c1', () => 0).state);
  const ep = { playerColor: 'w', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', moves: [], keys: [], result: null, reason: null };
  const r = playerMove(ep, 'e5d6', () => 0);
  assert.ok(r.state);
  assert.equal(new Chess(r.state.fen).get('d5'), undefined);
});

test('threefold repetition ends the game as a draw', () => {
  // Knights shuffle out and back twice; the start position occurs a 3rd time.
  let s = newGame('w', () => 0);
  s = play(s, 'g1f3', 'g8f6');
  s = play(s, 'f3g1', 'f6g8');
  s = play(s, 'g1f3', 'g8f6');
  assert.equal(s.result, null);
  s = play(s, 'f3g1', 'f6g8');
  assert.equal(s.result, 'draw');
  assert.equal(s.reason, 'repetition');
});

test('stalemate and insufficient material are draws', () => {
  const stale = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(outcome(stale, 1), { reason: 'stalemate', winner: null });
  const bare = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
  assert.deepEqual(outcome(bare, 1), { reason: 'insufficient', winner: null });
});

test('fifty-move rule ends the game', () => {
  const s = { playerColor: 'w', fen: '4k3/8/8/8/8/8/R7/4K3 w - - 99 80', moves: [], keys: [], result: null, reason: null };
  const r = playerMove(s, 'a2a3', () => 0).state;
  assert.equal(r.result, 'draw');
  assert.equal(r.reason, 'fifty');
});

test('resigning is recorded as resigned', () => {
  assert.equal(resign(newGame('w', () => 0)).result, 'resigned');
});

test('Gary only ever plays legal moves (fuzz)', () => {
  const rng = seeded(42);
  for (let g = 0; g < 30; g++) {
    let s = newGame(g % 2 ? 'b' : 'w', rng);
    while (!s.result && s.moves.length < 400) {
      const legal = new Chess(s.fen).moves({ verbose: true });
      const r = playerMove(s, legal[rng(legal.length)].lan, rng);
      assert.ok(r.state, r.error);
      s = r.state;
    }
    // Every recorded move replays cleanly from the start.
    assert.equal(replay(s.moves).plies.length, s.moves.length);
  }
});

test("Gary's first three moves are random, so fool's mate is a 1-in-30 shot, not forced", () => {
  const c = after('f3', 'e5', 'g4');
  const o = garyOptions(c);
  assert.equal(o.kind, 'opening');
  assert.equal(o.pool.length, c.moves().length);
  assert.equal(o.mates, 1);
  // Scholar-style mate when Gary has White: his 3rd move is random too.
  const s = after('e4', 'f6', 'a3', 'g5');
  assert.equal(garyOptions(s).kind, 'opening');
  assert.equal(garyOptions(s).mates, 1);
});

test('from his 4th move, Gary plays his only check', () => {
  // The same fool's mate trap, three moves later.
  const o = garyOptions(after('a3', 'a6', 'h3', 'h6', 'f3', 'e5', 'g4'));
  assert.equal(o.kind, 'check');
  assert.deepEqual(o.pool.map((m) => m.uci), ['d8h4']);
  assert.equal(o.mates, 1);
});

test('from his 4th move, with no checks, Gary moves a non-king piece toward your king', () => {
  const o = garyOptions(after('a3', 'a6', 'h3', 'h6', 'b3', 'b6', 'c3'));
  assert.equal(o.kind, 'charge');
  const d = (a, b) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(a.charCodeAt(1) - b.charCodeAt(1)));
  assert.ok(o.pool.length > 0);
  assert.ok(o.pool.every((m) => m.piece !== 'k' && d(m.to, 'e1') < d(m.from, 'e1')));
});

test("Gary's options follow his rules in every position (fuzz)", () => {
  const rng = seeded(7);
  const d = (a, b) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(a.charCodeAt(1) - b.charCodeAt(1)));
  for (let g = 0; g < 12; g++) {
    const chess = new Chess();
    while (!chess.isGameOver() && chess.history().length < 160) {
      const o = garyOptions(chess);
      const legal = chess.moves({ verbose: true });
      assert.equal(o.legal, legal.length);
      const lan = new Set(legal.map((m) => m.lan));
      for (const m of o.pool) assert.ok(lan.has(m.uci), `${m.uci} is not legal in ${chess.fen()}`);
      const checks = legal.filter((m) => /[+#]$/.test(m.san));
      if (chess.moveNumber() <= 3) {
        assert.equal(o.kind, 'opening');
        assert.equal(o.pool.length, legal.length);
      } else if (checks.length) {
        assert.equal(o.kind, 'check');
        assert.equal(o.pool.length, checks.length);
      } else if (o.kind === 'charge') {
        const king = chess.board().flat().find((p) => p && p.type === 'k' && p.color !== chess.turn()).square;
        for (const m of o.pool) assert.ok(m.piece !== 'k' && d(m.to, king) < d(m.from, king));
      } else {
        assert.equal(o.pool.length, legal.length);
      }
      assert.equal(o.mates, legal.filter((m) => m.san.endsWith('#')).length);
      chess.move(legal[rng(legal.length)].san);
    }
  }
});

test('a promotion letter on a non-promoting move is rejected', () => {
  const s = newGame('w', () => 0);
  assert.match(playerMove(s, 'e2e4q', () => 0).error, /Illegal/);
});

test('the daily position is the same all day, different each day, and handed over live', async () => {
  const { dailyPosition, dailyNumber } = await import('../shared/daily.js');
  const a = dailyPosition('2026-10-09');
  assert.deepEqual(dailyPosition('2026-10-09'), a);
  assert.equal(a.number, 1);
  assert.equal(dailyNumber('2026-10-10'), 2);
  const seen = new Set();
  for (let d = 1; d <= 60; d++) {
    const date = new Date(Date.UTC(2026, 9, 9 + d)).toISOString().slice(0, 10);
    const p = dailyPosition(date);
    assert.ok(p.moves.length >= 12 && p.moves.length <= 24, `${date}: ${p.moves.length} plies`);
    const c = new Chess();
    for (const uci of p.moves) assert.ok(playUci(c, uci), `${date}: ${uci}`);
    assert.equal(c.fen(), p.fen);
    assert.ok(!c.isGameOver() && !c.inCheck());
    assert.equal(p.playerColor, c.turn());
    seen.add(p.fen);
  }
  assert.ok(seen.size > 55, 'days should differ');
});

test('a daily game counts only the player moves after the hand-over', async () => {
  const { dailyPosition } = await import('../shared/daily.js');
  const { newDailyGame } = await import('../worker/game.js');
  const s = newDailyGame(dailyPosition('2026-10-09'));
  assert.equal(s.startPly, s.moves.length);
  assert.equal(playerMoveCount(s), 0);
  const uci = new Chess(s.fen).moves({ verbose: true })[0].lan;
  const r = playerMove(s, uci, seeded(3));
  assert.ok(r.state, r.error);
  assert.equal(playerMoveCount(r.state), 1);
  assert.equal(r.state.startPly, s.startPly);
});
