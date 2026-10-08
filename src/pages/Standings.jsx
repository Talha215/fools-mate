import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { PenCircle } from '../components/Drawings.jsx';
import { formatDuration } from '../lib/chess.js';
import { myGameIds } from '../lib/myGames.js';
import { Link } from '../lib/router.jsx';
import { toast } from '../lib/toast.jsx';

const FILTERS = [
  ['', 'All'],
  ['w', 'White'],
  ['b', 'Black'],
];

const shortDate = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

// One line of the standings, newspaper style: rank, name, dot leaders, score.
export function StandingsRow({ entry: e, rank, compact = false, mine = false }) {
  return (
    <li className={`st-row${mine ? ' mine' : ''}`}>
      <Link to={`/replay/${e.id}`}>
        <span className="st-rank">
          {rank}
          {rank === 1 && <PenCircle className="st-ring" />}
        </span>
        <span className="st-name">{e.name}</span>
        <span className="st-dots" aria-hidden="true" />
        <span className="st-moves">{e.playerMoves}</span>
        {!compact && <span className="st-side">{e.playerColor === 'w' ? 'White' : 'Black'}</span>}
        {!compact && <span className="st-time">{formatDuration(e.durationMs)}</span>}
        {!compact && <span className="st-date">{shortDate(e.endedAt)}</span>}
      </Link>
    </li>
  );
}

export default function Standings() {
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
      <h1 className="page-title">Standings</h1>
      <p className="page-dek">Fewest moves to get checkmated by {BOT.name}. Ties go to the faster game.</p>
      <div className="filters">
        <div className="tabs" role="tablist">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={color === k} className={color === k ? 'on' : ''} onClick={() => setColor(k)}>
              {label}
            </button>
          ))}
        </div>
        <label className="check-row">
          <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
          One line per name
        </label>
      </div>
      {entries === null ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty">No one has been checkmated yet. <Link to="/">You could be first.</Link></p>
      ) : (
        <>
          <div className="st-row st-head" aria-hidden="true">
            <span className="st-rank">No.</span>
            <span className="st-name">Name</span>
            <span className="st-dots" />
            <span className="st-moves">Moves</span>
            <span className="st-side">Side</span>
            <span className="st-time">Time</span>
            <span className="st-date">Date</span>
          </div>
          <ol className="standings">
            {entries.map((e, i) => <StandingsRow key={e.id} entry={e} rank={i + 1} mine={mine.has(e.id)} />)}
          </ol>
        </>
      )}
    </div>
  );
}
