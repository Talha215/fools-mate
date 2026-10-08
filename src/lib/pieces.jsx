// The cburnett piece set ships as CSS scoped to chessground's board
// (".cg-wrap piece.knight.white"). We also want those pieces as small icons
// (material counts, promotion picker, colour buttons), so this injects the same
// stylesheet with every selector also matching ".pc.knight.white". One copy of
// the artwork, usable anywhere.
import cburnett from 'chessground/assets/chessground.cburnett.css?raw';

export function installPieceStyles() {
  const style = document.createElement('style');
  style.textContent = cburnett.replace(/\.cg-wrap piece\.(\w+)\.(\w+)/g, '.cg-wrap piece.$1.$2, .pc.$1.$2');
  document.head.appendChild(style);
}

const ROLES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

// <Piece type="n" color="w" /> renders a knight icon sized by CSS.
export function Piece({ type, color, className = '' }) {
  return <i className={`pc ${ROLES[type] || type} ${color === 'w' || color === 'white' ? 'white' : 'black'} ${className}`} />;
}
