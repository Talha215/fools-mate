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

export function newGame(playerColor, rng) {
  const chess = new Chess();
  const state = {
    playerColor,
    fen: chess.fen(),
    moves: [],
    keys: [positionKey(chess.fen())],
    result: null,
    reason: null,
  };
  // The bot has White, so it opens.
  return playerColor === 'b' ? botReply(state, chess, rng) : state;
}

// Applies the player's move and, unless that ended the game, the bot's reply.
// Returns { state } or { error } (state is never mutated).
export function playerMove(state, uci, rng) {
  if (state.result) return { error: 'This game is already over.' };
  const chess = new Chess(state.fen);
  if (chess.turn() !== state.playerColor) return { error: "It's not your turn." };
  if (!playUci(chess, uci)) return { error: `Illegal move: ${uci}` };
  const next = advance(state, chess, uci);
  return { state: next.result ? next : botReply(next, chess, rng) };
}

export function resign(state) {
  return { ...state, result: 'resigned', reason: 'resign' };
}

export function playerMoveCount(state) {
  const parity = state.playerColor === 'w' ? 0 : 1;
  return state.moves.filter((_, i) => i % 2 === parity).length;
}

function botReply(state, chess, rng) {
  const legal = chess.moves(); // SAN; see the performance note on playUci
  const pick = chooseMove(chess, legal, rng);
  // Never trust the brain blindly, even this one.
  if (!legal.includes(pick)) throw new Error(`Bot chose a move that isn't legal: ${pick}`);
  return advance(state, chess, chess.move(pick).lan);
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
