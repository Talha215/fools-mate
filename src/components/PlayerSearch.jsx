import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../lib/router.jsx';

export const playerPath = (name) => `/player/${encodeURIComponent(name)}`;

// "Find a player": names starting with what's typed, most games first.
export default function PlayerSearch() {
  const [q, setQ] = useState('');
  const [names, setNames] = useState([]);

  useEffect(() => {
    if (!q.trim()) {
      setNames([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      api.players(q.trim()).then((d) => alive && setNames(d.names), () => {});
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <form
      className="player-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(playerPath(names[0]?.name || q.trim()));
      }}
    >
      <label className="blank">
        <span>Find a player</span>
        <input value={q} maxLength={20} placeholder="Name" onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      {names.length > 0 && (
        <ul className="search-results">
          {names.map((n) => (
            <li key={n.name}>
              <button type="button" onClick={() => navigate(playerPath(n.name))}>
                {n.name} <span>{n.games} game{n.games === 1 ? '' : 's'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
