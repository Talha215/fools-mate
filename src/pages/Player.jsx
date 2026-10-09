import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ResultRow } from './Archive.jsx';
import PlayerSearch from '../components/PlayerSearch.jsx';
import { Link } from '../lib/router.jsx';

const shortDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Everything played under one name. Names aren't accounts: this is everyone
// who typed it.
export default function Player({ name }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.player(name).then((d) => alive && setData(d), (e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [name]);

  if (error) return <div className="page-msg"><p>{error}</p></div>;
  if (!data) return <div className="page-msg">Looking them up…</div>;

  const { modes, dailies, recent } = data;
  const total = Object.values(modes).reduce((n, m) => n + m.games, 0);
  const mated = Object.values(modes).reduce((n, m) => n + (m.mated || 0), 0);
  const anon = data.name === 'Anonymous';

  return (
    <div className="page">
      <h1 className="page-title">{data.name}</h1>
      <p className="page-dek">
        {total ? `${total} game${total === 1 ? '' : 's'}, checkmated ${mated} time${mated === 1 ? '' : 's'}.` : 'No games under this name yet.'}{' '}
        Names aren't accounts, so this is everyone who played as "{data.name}".
      </p>
      <div className="player-search-row">
        <PlayerSearch />
      </div>

      {anon ? (
        <p className="empty">Anonymous players are everybody at once, so there's nothing useful to show here.</p>
      ) : (
        <div className="archive">
          <section className="archive-section">
            <h3 className="col-head">The Daily</h3>
            {dailies.length === 0 ? (
              <p className="muted">No dailies yet.</p>
            ) : (
              <ul className="results">
                {dailies.map((d) => (
                  <li key={d.date} className={`res-row${d.best ? ' mated' : ''}`}>
                    <Link to={`/standings?daily=${d.date}`}>
                      <span className="res-players">No. {d.number}</span>
                      <span className="res-score">{d.best ?? '–'}</span>
                      <span className="res-note">{d.best ? `best ${d.best} moves` : 'not mated'}, {d.tries} {d.tries === 1 ? 'try' : 'tries'}</span>
                      <span className="res-when">{shortDate(d.date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="archive-section">
            <h3 className="col-head">Records</h3>
            <dl className="records">
              <dt>Classic best</dt>
              <dd>{modes.classic?.best ? `${modes.classic.best} moves` : '–'}</dd>
              <dt>Classic games</dt>
              <dd>{modes.classic?.games ?? 0}</dd>
              <dt>Endless best</dt>
              <dd>{modes.endless?.best ? `${modes.endless.best} moves` : '–'}</dd>
              <dt>Endless games</dt>
              <dd>{modes.endless?.games ?? 0}</dd>
              <dt>Daily tries, all told</dt>
              <dd>{modes.daily?.games ?? 0}</dd>
            </dl>
          </section>
          <section className="archive-section">
            <h3 className="col-head">Recent results</h3>
            {recent.length === 0 ? (
              <p className="muted">Nothing finished yet (resignations aren't listed).</p>
            ) : (
              <ul className="results">
                {recent.map((g) => <ResultRow key={g.id} game={g} />)}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
