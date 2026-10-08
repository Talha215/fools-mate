import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { resultCopy } from '../components/EndModal.jsx';
import { IconEye } from '../components/Icons.jsx';
import { timeAgo } from '../lib/chess.js';
import { myGameIds } from '../lib/myGames.js';
import { Piece } from '../lib/pieces.jsx';
import { Link } from '../lib/router.jsx';

export default function Games() {
  const [live, setLive] = useState(null);
  const [recent, setRecent] = useState(null);
  const [mine, setMine] = useState(null);

  useEffect(() => {
    const loadLive = () => api.games({ scope: 'live', limit: 12 }).then((d) => setLive(d.games), () => setLive([]));
    loadLive();
    const t = setInterval(loadLive, 10000);
    api.games({ scope: 'recent', limit: 30 }).then((d) => setRecent(d.games), () => setRecent([]));
    const ids = myGameIds().slice(0, 30);
    if (ids.length) api.games({ ids: ids.join(',') }).then((d) => setMine(d.games), () => setMine([]));
    else setMine([]);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Games</h1>
        <p className="muted">Every game is saved. Click one to watch the replay, or spectate a game in progress.</p>
      </div>
      <GameSection title="Live now" games={live} empty="Nobody is playing right now." live />
      <GameSection title="Your games" games={mine} empty="Games you play on this device show up here." />
      <GameSection title="Recently finished" games={recent} empty="No finished games yet." />
    </div>
  );
}

function GameSection({ title, games, empty, live }) {
  return (
    <section className="card games-card">
      <div className="card-head">
        <h3>
          {live && <span className="live-dot" />}
          {title}
        </h3>
      </div>
      {games === null ? (
        <div className="muted pad">Loading…</div>
      ) : games.length === 0 ? (
        <div className="empty">{empty}</div>
      ) : (
        <ul className="game-rows">
          {games.map((g) => (
            <GameRow key={g.id} g={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GameRow({ g }) {
  const active = g.status === 'active';
  const copy = resultCopy(g);
  return (
    <li>
      <Link to={`/replay/${g.id}`} className="game-row">
        <Piece type="k" color={g.playerColor} />
        <span className="gr-name">{g.name}</span>
        {active ? (
          <span className="live-badge"><IconEye size={14} /> Watch</span>
        ) : (
          <span className={`result-pill ${copy.tone}`}>{copy.title}</span>
        )}
        <span className="gr-moves"><b>{g.playerMoves}</b> moves</span>
        <span className="gr-when">{timeAgo(active ? g.updatedAt : g.endedAt)}</span>
      </Link>
    </li>
  );
}
