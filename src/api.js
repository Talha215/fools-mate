async function request(path, body) {
  const res = await fetch(
    path,
    body === undefined
      ? undefined
      : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.game = data.game; // the server's view of the game, to resync from
    throw err;
  }
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  return p.toString();
};

export const api = {
  createGame: (color, name) => request('/api/games', { color, name }),
  game: (id) => request(`/api/games/${id}`),
  move: (id, token, ply, move) => request(`/api/games/${id}/move`, { token, ply, move }),
  resign: (id, token) => request(`/api/games/${id}/resign`, { token }),
  rename: (id, token, name) => request(`/api/games/${id}/name`, { token, name }),
  leaderboard: ({ color, unique, limit } = {}) =>
    request(`/api/leaderboard?${qs({ color, unique: unique ? 1 : '', limit })}`),
  games: (params) => request(`/api/games?${qs(params)}`),
  stats: () => request('/api/stats'),
};
