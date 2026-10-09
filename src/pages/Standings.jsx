import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { PenCircle } from '../components/Drawings.jsx';
import { formatDuration } from '../lib/chess.js';
import { myGameIds } from '../lib/myGames.js';
import { Link } from '../lib/router.jsx';
import { toast } from '../lib/toast.jsx';
import PlayerSearch, { playerPath } from '../components/PlayerSearch.jsx';

const BOARDS = [
  ['daily', 'Daily'],
  ['classic', 'Classic'],
];
const COLORS = [
  ['', 'All'],
  ['w', 'White'],
  ['b', 'Black'],
];

const shortDate = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const todayUTC = () => new Date().toISOString().slice(0, 10);
const shiftDay = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

function Rank({ n }) {
  return (
    <span className="st-rank">
      {n}
      {n === 1 && <PenCircle className="st-ring" />}
    </span>
  );
}

// The name opens the player's page; Anonymous isn't a player, so no link.
function NameLink({ name }) {
  return name === 'Anonymous' ? <span className="st-name">{name}</span> : <Link className="st-name" to={playerPath(name)}>{name}</Link>;
}

// One line of the standings, newspaper style: rank, name, dot leaders, score.
// The name goes to the player; the score to the game's replay.
export function StandingsRow({ entry: e, rank, compact = false, mine = false }) {
  return (
    <li className={`st-row${mine ? ' mine' : ''}`}>
      <Rank n={rank} />
      <NameLink name={e.name} />
      <span className="st-dots" aria-hidden="true" />
      <Link className="st-score" to={`/replay/${e.id}`} title="Watch the replay">
        <span className="st-moves">{e.playerMoves}</span>
        {!compact && <span className="st-side">{e.playerColor === 'w' ? 'White' : 'Black'}</span>}
        {!compact && <span className="st-time">{formatDuration(e.durationMs)}</span>}
        {!compact && <span className="st-date">{shortDate(e.endedAt)}</span>}
      </Link>
    </li>
  );
}

// A line of a daily's standings: best score and the try it came on.
export function DailyRow({ entry: e, rank, mine = false }) {
  return (
    <li className={`st-row${mine ? ' mine' : ''}`}>
      <Rank n={rank} />
      <NameLink name={e.name} />
      <span className="st-dots" aria-hidden="true" />
      <Link className="st-score" to={`/replay/${e.id}`} title="Watch the replay">
        <span className="st-moves">{e.playerMoves}</span>
        <span className="st-tries">try {e.tries}</span>
        <span className="st-time">{formatDuration(e.durationMs)}</span>
      </Link>
    </li>
  );
}

export default function Standings() {
  // The Daily first; ?board=classic links straight to the classic standings.
  // ?daily=2026-10-09 opens a particular day (from a player's page).
  const params = new URLSearchParams(location.search);
  const [boardKind, setBoardKind] = useState(() => (params.get('board') === 'classic' ? 'classic' : 'daily'));
  const [color, setColor] = useState('');
  const [unique, setUnique] = useState(true);
  const [day, setDay] = useState(() => (/^\d{4}-\d\d-\d\d$/.test(params.get('daily') || '') ? params.get('daily') : todayUTC()));
  const [entries, setEntries] = useState(null);
  const [number, setNumber] = useState(null);
  const daily = boardKind === 'daily';

  useEffect(() => {
    let alive = true;
    setEntries(null);
    const req = daily ? api.leaderboard({ daily: day, limit: 100 }) : api.leaderboard({ color, unique, limit: 100 });
    req.then(
      (d) => {
        if (!alive) return;
        setEntries(d.entries);
        if (daily) setNumber(d.number);
      },
      (e) => {
        if (!alive) return;
        toast(e.message);
        setEntries([]);
      },
    );
    return () => {
      alive = false;
    };
  }, [color, unique, daily, day]);

  function pickBoard(k) {
    setBoardKind(k);
    history.replaceState(null, '', k === 'classic' ? '/standings?board=classic' : '/standings');
  }

  const mine = new Set(myGameIds());

  return (
    <div className="page">
      <h1 className="page-title">Standings</h1>
      <p className="page-dek">
        {daily
          ? `The Daily, one line per name: fewest moves, then fewest tries, then the faster game.`
          : `Classic, from the first move: fewest moves to get checkmated by ${BOT.name}. Ties go to the faster game.`}
      </p>
      <div className="player-search-row">
        <PlayerSearch />
      </div>
      <div className="filters">
        <div className="tabs" role="tablist">
          {BOARDS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={boardKind === k} className={boardKind === k ? 'on' : ''} onClick={() => pickBoard(k)}>
              {label}
            </button>
          ))}
          {!daily && <span className="tabs-sep" aria-hidden="true">|</span>}
          {!daily &&
            COLORS.map(([k, label]) => (
              <button key={k || 'all'} type="button" className={color === k ? 'on' : ''} onClick={() => setColor(k)}>
                {label}
              </button>
            ))}
        </div>
        {daily ? (
          <div className="day-nav">
            <button type="button" className="text-btn" disabled={number <= 1} onClick={() => setDay(shiftDay(day, -1))}>
              earlier
            </button>
            <span>{number ? `No. ${number}` : ''}{day === todayUTC() ? ', today' : `, ${shortDate(Date.parse(`${day}T12:00:00Z`))}`}</span>
            <button type="button" className="text-btn" disabled={day >= todayUTC()} onClick={() => setDay(shiftDay(day, 1))}>
              later
            </button>
          </div>
        ) : (
          <label className="check-row">
            <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
            One line per name
          </label>
        )}
      </div>
      {entries === null ? (
        <p className="muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty">
          No one has been checkmated {daily ? 'in this daily' : 'yet'}.{' '}
          <Link to={daily ? '/' : '/classic'}>You could be first.</Link>
        </p>
      ) : daily ? (
        <>
          <div className="st-row st-head" aria-hidden="true">
            <span className="st-rank">No.</span>
            <span className="st-name">Name</span>
            <span className="st-dots" />
            <span className="st-moves">Moves</span>
            <span className="st-tries">Tries</span>
            <span className="st-time">Time</span>
          </div>
          <ol className="standings">
            {entries.map((e, i) => <DailyRow key={e.id} entry={e} rank={i + 1} mine={mine.has(e.id)} />)}
          </ol>
        </>
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
