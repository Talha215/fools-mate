// The authoritative game state machine. Pure: no storage, no request handling,
// so it can be unit tested without a Worker runtime.
//
// A game state is { playerColor, fen, moves: string[] (UCI), keys: string[]
// (repetition keys since the last irreversible move), result, reason }.
//
// Results are from the challenge's point of view, which is upside down:
//   'mated'    the player got checkmated: SUCCESS, goes on the leaderboard
//   'won'      the player checkmated the bot (oops)
//   'draw'     stalemate, repetition, 50 moves, insufficient material
//   'resigned' the player gave up on losing
import { Chess } from 'chess.js';
import { outcome, playUci, positionKey, trackRepetition } from '../shared/rules.js';
import { chooseMove } from './bot.js';

// `choose(chess, rng)` picks Gary's move; tests swap in scripted lines.
export function newGame(playerColor, rng, choose = chooseMove) {
  const chess = new Chess();
  const state = {
    playerColor,
    fen: chess.fen(),
    moves: [],
    keys: [positionKey(chess.fen())],
    result: null,
    reason: null,
  };
  // Gary has White, so he opens.
  return playerColor === 'b' ? botReply(state, chess, rng, choose) : state;
}

// A daily or endless game: Gary's moves for both sides up to the position, then the
// player takes over as the side to move. `daily` comes from shared/daily.js.
// startPly marks the hand-over, so only moves after it count for the player.
export function newDailyGame(daily) {
  const chess = new Chess();
  for (const uci of daily.moves) if (!playUci(chess, uci)) throw new Error(`Bad daily move ${uci}`);
  return {
    playerColor: daily.playerColor,
    fen: chess.fen(),
    moves: [...daily.moves],
    keys: [positionKey(chess.fen())],
    startPly: daily.moves.length,
    result: null,
    reason: null,
  };
}

// Applies the player's move and, unless that ended the game, Gary's reply.
// Returns { state } or { error } (state is never mutated).
export function playerMove(state, uci, rng, choose = chooseMove) {
  if (state.result) return { error: 'This game is already over.' };
  const chess = new Chess(state.fen);
  if (chess.turn() !== state.playerColor) return { error: "It's not your turn." };
  if (!playUci(chess, uci)) return { error: `Illegal move: ${uci}` };
  const next = advance(state, chess, uci);
  return { state: next.result ? next : botReply(next, chess, rng, choose) };
}

export function resign(state) {
  return { ...state, result: 'resigned', reason: 'resign' };
}

// Every game starts from the standard position, so White's moves are the
// even plies. Daily games skip Gary's warm-up moves before startPly.
export function playerMoveCount(state) {
  const parity = state.playerColor === 'w' ? 0 : 1;
  const start = state.startPly || 0;
  return state.moves.filter((_, i) => i >= start && i % 2 === parity).length;
}

function botReply(state, chess, rng, choose) {
  const pick = choose(chess, rng);
  // Never trust the brain blindly, even this one.
  const move = pick && playUci(chess, pick.uci);
  if (!move) throw new Error(`Gary chose a move that isn't legal: ${pick?.uci}`);
  return advance(state, chess, move.lan);
}

function advance(state, chess, uci) {
  const rep = trackRepetition(state.keys, chess);
  const over = outcome(chess, rep.count);
  let result = null;
  if (over) {
    if (!over.winner) result = 'draw';
    else result = over.winner === state.playerColor ? 'won' : 'mated';
  }
  return {
    ...state,
    fen: chess.fen(),
    moves: [...state.moves, uci],
    keys: rep.keys,
    result,
    reason: over ? over.reason : null,
  };
}
