// Gary's one idea, shared by the Worker (which picks his move) and the
// browser (which shows his options). Gary attacks the king:
//   1. If he can give check, he plays one of his checks.
//   2. Otherwise he moves a piece (never his king) closer to your king.
//   3. If nothing can get closer, any legal move will do.
// Every move in the chosen group is equally likely, and he can't tell a
// check from a checkmate. That's the whole brain.

// Destination square and promotion piece at the end of a SAN move.
const SAN_TARGET = /([a-h][1-8])(?:=([QRBN]))?[+#]?$/;

// King-move distance between two squares.
const dist = (a, b) => Math.max(Math.abs(a.charCodeAt(0) - b.charCodeAt(0)), Math.abs(a.charCodeAt(1) - b.charCodeAt(1)));

// Returns { kind: 'check' | 'charge' | 'any', pool, mates, mating, legal }:
// pool is the group Gary picks from, each move as
// { from, to, promotion, uci, san, piece, check, mate }.
//
// Moves are generated one square at a time with chess.moves({ square }):
// linear in the number of moves (the server has a 10 ms CPU budget, see
// shared/rules.js), and the SAN still carries "+"/"#" for checks and mates.
// SAN from a per-square list can skip disambiguation ("Nd7" for "Nbd7"), so
// use from/to/uci to identify moves, not san.
export function garyOptions(chess) {
  const me = chess.turn();
  let enemyKing = null;
  const moves = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p) continue;
      if (p.color !== me) {
        if (p.type === 'k') enemyKing = p.square;
        continue;
      }
      for (const san of chess.moves({ square: p.square })) moves.push(describe(p, san));
    }
  }
  const checks = moves.filter((m) => m.check);
  if (checks.length) return group('check', checks, moves.length);
  const closer = moves.filter((m) => m.piece !== 'k' && dist(m.to, enemyKing) < dist(m.from, enemyKing));
  if (closer.length) return group('charge', closer, moves.length);
  return group('any', moves, moves.length);
}

function group(kind, pool, legal) {
  const mating = pool.filter((m) => m.mate);
  return { kind, pool, mates: mating.length, mating, legal };
}

function describe(piece, san) {
  let to;
  let promotion;
  if (san.startsWith('O-O')) {
    to = (san.startsWith('O-O-O') ? 'c' : 'g') + piece.square[1];
  } else {
    const m = san.match(SAN_TARGET);
    to = m[1];
    promotion = m[2]?.toLowerCase();
  }
  return {
    from: piece.square,
    to,
    promotion,
    uci: piece.square + to + (promotion || ''),
    san,
    piece: piece.type,
    check: /[+#]$/.test(san),
    mate: san.endsWith('#'),
  };
}
