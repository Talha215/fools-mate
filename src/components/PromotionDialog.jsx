import { useEffect } from 'react';
import { Piece } from '../lib/pieces.jsx';

const CHOICES = ['q', 'n', 'r', 'b'];

// Lichess-style picker: the four pieces stacked on the promotion file, from
// the promotion square toward the middle of the board. Click outside cancels.
export default function PromotionDialog({ square, color, orientation, onPick, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const file = square.charCodeAt(0) - 97;
  const left = (orientation === 'white' ? file : 7 - file) * 12.5;
  const fromTop = (color === 'w') === (orientation === 'white');
  return (
    <div className="promotion-overlay" onClick={onCancel}>
      {CHOICES.map((t, i) => (
        <button
          key={t}
          type="button"
          className="promotion-choice"
          style={{ left: `${left}%`, top: `${(fromTop ? i : 7 - i) * 12.5}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onPick(t);
          }}
          title={{ q: 'Queen', n: 'Knight', r: 'Rook', b: 'Bishop' }[t]}
        >
          <Piece type={t} color={color} />
        </button>
      ))}
    </div>
  );
}
