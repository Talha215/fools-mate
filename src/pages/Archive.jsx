import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { BOT } from '../../shared/bot.js';
import { scoreline, timeAgo } from '../lib/chess.js';
import { myGameIds } from '../lib/myGames.js';
import { Link } from '../lib/router.jsx';

const SHORT_REASON = { stalemate: 'stalemate', repetition: 'repetition', fifty: '50 moves', insufficient: 'no material' };

function describe(g) {
  const d = g.mode === 'daily' ? `daily No. ${g.dailyNumber}, ` : '';
  return d + describeResult(g);
}

function describeResult(g) {
  if (g.status === 'active') return `${g.playerMoves} ${g.playerMoves === 1 ? 'move' : 'moves'} in`;
  if (g.result === 'mated') return `mated in ${g.playerMoves}`;
  if (g.result === 'won') return 'void';
  if (g.result === 'draw') return `drawn, ${SHORT_REASON[g.reason] || 'draw'}`;
  return 'resigned';
}

// "Fool v Gary  0–1  mated in 2", the way results columns print them.
export function ResultRow({ game: g }) {
  const active = g.status === 'active';
  const white = g.playerColor === 'w' ? g.name : BOT.name;
  const black = g.playerColor === 'w' ? BOT.name : g.name;
  return (
    <li className={`res-row${g.result === 'mated' ? ' mated' : ''}`}>
      <Link to={`/replay/${g.id}`}>
        <span className="res-players">{white} v {black}</span>
        <span className="res-score">{active ? 'in play' : scoreline(g)}</span>
        <span className="res-note">{describe(g)}</span>
        <span className="res-when">{timeAgo(active ? g.updatedAt : g.endedAt)}</span>
      </Link>
    </li>
  );
}

export default function Archive() {
  const [live, setLive] = useState(null);
  const [recent, setRecent] = useState(null);
  const [mine, setMine] = useState(null);

  useEffect(() => {
    const loadLive = () => api.games({ scope: 'live', limit: 12 }).then((d) => setLive(d.games), () => setLive([]));
    loadLive();
    const t = setInterval(loadLive, 10000);
    api.games({ scope: 'recent', limit: 40 }).then((d) => setRecent(d.games), () => setRecent([]));
    const ids = myGameIds().slice(0, 30);
    if (ids.length) api.games({ ids: ids.join(',') }).then((d) => setMine(d.games), () => setMine([]));
    else setMine([]);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">Archive</h1>
      <p className="page-dek">Every game is kept. Open one to play it back, or to watch one that's still going.</p>
      <div className="archive">
        <Section title="In play now" games={live} empty="Nobody is playing right now." />
        <Section title="Your games" games={mine} empty="Games you play on this device will be listed here." />
        <Section title="Results" games={recent} empty="No games have finished yet." />
      </div>
    </div>
  );
}

function Section({ title, games, empty }) {
  return (
    <section className="archive-section">
      <h3 className="col-head">{title}</h3>
      {games === null ? (
        <p className="muted">Loading…</p>
      ) : games.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="results">
          {games.map((g) => <ResultRow key={g.id} game={g} />)}
        </ul>
      )}
    </section>
  );
}
