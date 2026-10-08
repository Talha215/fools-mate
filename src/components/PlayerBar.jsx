import { Piece } from '../lib/pieces.jsx';

// The strip above/below the board: avatar, name, material, and a right slot.
export default function PlayerBar({ avatar, name, tag, side, material, active, status, right }) {
  const mine = material?.[side];
  const opp = side === 'w' ? 'b' : 'w';
  return (
    <div className={`player-bar${active ? ' active' : ''}`}>
      <div className="pb-avatar">{avatar}</div>
      <div className="pb-main">
        <div className="pb-name">
          <span className="pb-name-text">{name}</span>
          {tag && <span className="pb-tag">{tag}</span>}
          {status && <span className="pb-status">{status}</span>}
        </div>
        <div className="pb-material">
          {mine?.pieces.map((t, i) => (
            <Piece key={i} type={t} color={opp} className={i > 0 && mine.pieces[i - 1] === t ? 'stack' : ''} />
          ))}
          {mine?.score > 0 && <span className="pb-score">+{mine.score}</span>}
        </div>
      </div>
      {right && <div className="pb-right">{right}</div>}
    </div>
  );
}
