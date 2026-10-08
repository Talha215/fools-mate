import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { formatDuration, timeAgo } from '../lib/chess.js';
import { myGameIds } from '../lib/myGames.js';
import { Piece } from '../lib/pieces.jsx';
import { Link, navigate } from '../lib/router.jsx';
import { toast } from '../lib/toast.jsx';

const FILTERS = [
  ['', 'All'],
  ['w', 'As White'],
  ['b', 'As Black'],
];

export function RankBadge({ n }) {
  return <span className={`rank rank-${n <= 3 ? n : 'n'}`}>{n}</span>;
}

export default function Leaderboard() {
  const [color, setColor] = useState('');
  const [unique, setUnique] = useState(true);
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    let alive = true;
    setEntries(null);
    api.leaderboard({ color, unique, limit: 100 }).then(
      (d) => alive && setEntries(d.entries),
      (e) => {
        if (!alive) return;
        toast(e.message);
        setEntries([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [color, unique]);

  const mine = new Set(myGameIds());

  return (
    <div className="page">
      <div className="page-head">
        <h1>Fastest losses</h1>
        <p className="muted">
          Fewest of your own moves before {BOT.name} checkmated you. Ties go to the quicker game.
        </p>
      </div>
      <div className="lb-controls">
        <div className="seg" role="tablist">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={color === k} className={color === k ? 'on' : ''} onClick={() => setColor(k)}>
              {label}
            </button>
          ))}
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
          Best run per player
        </label>
      </div>
      <div className="card table-card">
        {entries === null ? (
          <div className="muted pad">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="empty">Nobody has managed to lose yet. <Link to="/">Be the first.</Link></div>
        ) : (
          <table className="lb">
            <thead>
              <tr>
                <th className="c-rank">#</th>
                <th>Player</th>
                <th className="c-num">Moves</th>
                <th className="c-side">Side</th>
                <th className="c-num hide-sm">Time</th>
                <th className="hide-sm">When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={e.id}
                  className={mine.has(e.id) ? 'mine' : ''}
                  onClick={() => navigate(`/replay/${e.id}`)}
                  title="Watch the replay"
                >
                  <td className="c-rank"><RankBadge n={i + 1} /></td>
                  <td>
                    <span className="c-name">
                      <Link to={`/replay/${e.id}`} onClick={(ev) => ev.stopPropagation()}>{e.name}</Link>
                      {mine.has(e.id) && <span className="pb-tag">You</span>}
                    </span>
                  </td>
                  <td className="c-num"><b>{e.playerMoves}</b></td>
                  <td className="c-side"><Piece type="k" color={e.playerColor} /></td>
                  <td className="c-num hide-sm">{formatDuration(e.durationMs)}</td>
                  <td className="hide-sm muted">{timeAgo(e.endedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
