// Chess rules shared by the Worker (authoritative) and the browser (replays,
// move lists, "mate odds"). chess.js does the move generation; this file only
// adds the bits it doesn't track for us when a game is loaded from a FEN.
import { Chess } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Board, side to move, castling rights, en passant. chess.js only writes the
// en passant square when a capture is actually possible, which is exactly the
// FIDE definition of "same position" for repetition.
export const positionKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

export const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

// Game-ending conditions, all applied automatically (chess.com style), since
// nobody is around to claim a draw against a bot. Checkmate is checked first:
// a mating move stands even if it also hits the 50-move limit.
// Returns null while the game goes on, else { reason, winner: 'w' | 'b' | null }.
export function outcome(chess, repetitions) {
  if (chess.isCheckmate()) return { reason: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' };
  if (chess.isStalemate()) return { reason: 'stalemate', winner: null };
  if (chess.isInsufficientMaterial()) return { reason: 'insufficient', winner: null };
  if (repetitions >= 3) return { reason: 'repetition', winner: null };
  if (chess.isDrawByFiftyMoves()) return { reason: 'fifty', winner: null };
  return null;
}

// Plays a UCI move on `chess` if it is legal. Returns the chess.js Move or null.
//
// Performance note (this runs on every request, and Cloudflare's free plan
// allows 10 ms of CPU): never call chess.moves({ verbose: true }) on the hot
// path. Each verbose Move regenerates every legal move to build its SAN, so a
// verbose list is quadratic. move() and moves() (SAN strings) are linear.
export function playUci(chess, uci) {
  if (!UCI_RE.test(uci)) return null;
  let m;
  try {
    m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
  // chess.js ignores a promotion letter on a non-promoting move ("e2e4q");
  // reject it so stored move lists stay canonical.
  if (m.lan !== uci) {
    chess.undo();
    return null;
  }
  return m;
}

// Positions seen since the last irreversible move (pawn move or capture).
// Nothing before one of those can ever repeat, so this list is all that's
// needed for threefold detection and it stays short. Returns the new list and
// how many times the current position has now occurred.
export function trackRepetition(keys, chess) {
  const fen = chess.fen();
  const halfmoves = Number(fen.split(' ')[4]);
  const key = positionKey(fen);
  const next = halfmoves === 0 ? [key] : [...keys, key];
  return { keys: next, count: next.filter((k) => k === key).length };
}

// Replays a list of UCI moves from the start. Used by the browser to build
// move lists and step through games; the server never needs the full replay.
export function replay(uciMoves) {
  const chess = new Chess();
  let keys = [positionKey(chess.fen())];
  const plies = [];
  for (const uci of uciMoves) {
    const m = playUci(chess, uci);
    if (!m) break;
    const rep = trackRepetition(keys, chess);
    keys = rep.keys;
    plies.push({
      uci,
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color,
      piece: m.piece,
      captured: m.captured,
      promotion: m.promotion,
      fen: chess.fen(),
      check: chess.inCheck(),
    });
  }
  return { plies, finalFen: chess.fen(), chess };
}

// How many of the side-to-move's legal moves are checkmate. The whole point
// of the game: this is the bot's chance of (accidentally) doing its job.
// SAN already marks mates with '#', so no need to play each move out.
export function matingMoves(fen) {
  const legal = new Chess(fen).moves();
  return { mates: legal.filter((san) => san.endsWith('#')).length, total: legal.length };
}
