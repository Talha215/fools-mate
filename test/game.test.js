import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { newGame, playerMove, playerMoveCount, resign } from '../worker/game.js';
import { matingMoves, replay, outcome } from '../shared/rules.js';

const asMove = (uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

// Plays the player's move with the bot forced to reply `botUci` (when the
// game isn't already over), so tests can script exact lines.
function play(state, uci, botUci) {
  const after = new Chess(state.fen);
  after.move(asMove(uci));
  const legal = after.moves({ verbose: true });
  const res = playerMove(state, uci, () => {
    const i = legal.findIndex((m) => m.lan === botUci);
    if (i < 0) throw new Error(`scripted bot move ${botUci} is not legal`);
    return i;
  });
  assert.ok(res.state, res.error);
  return res.state;
}

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

test('the bot only ever plays legal moves (fuzz)', () => {
  let seed = 42;
  const rng = (n) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
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

test('matingMoves counts the bot\'s mating options', () => {
  // After 1.f3 e5 2.g4, Black has exactly one mate: Qh4#.
  const c = new Chess();
  for (const m of ['f3', 'e5', 'g4']) c.move(m);
  const { mates, total } = matingMoves(c.fen());
  assert.equal(mates, 1);
  assert.equal(total, c.moves().length);
});

test('a promotion letter on a non-promoting move is rejected', () => {
  const s = newGame('w', () => 0);
  assert.match(playerMove(s, 'e2e4q', () => 0).error, /Illegal/);
});
