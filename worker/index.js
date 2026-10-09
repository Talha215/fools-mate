// Cloudflare Worker: the JSON API under /api. Everything else is the static
// React app (see "assets" in wrangler.jsonc).
import { newDailyGame, newGame, playerMove, playerMoveCount, resign } from './game.js';
import { cryptoRng } from './bot.js';
import { dailyNumber, dailyPosition, isDate, positionFromSeed, todayUTC } from '../shared/daily.js';

const LIVE_WINDOW_MS = 2 * 60 * 1000; // "playing now" = moved in the last 2 minutes
const STALE_ACTIVE_MS = 7 * 24 * 60 * 60 * 1000; // abandoned games are pruned after a week

export default {
  async fetch(request, env, ctx) {
    // Private mode: while the SITE_PASSWORD secret is set, every request that
    // reaches the Worker needs it. That's only /api/* unless run_worker_first is
    // true in wrangler.jsonc (needed to hide the pages too).
    // `wrangler secret delete SITE_PASSWORD` turns it off. Unset in local dev.
    if (env.SITE_PASSWORD && !(await hasSitePassword(request, env.SITE_PASSWORD))) {
      return new Response("Fool's Mate is private for now.", {
        status: 401,
        headers: { 'www-authenticate': 'Basic realm="Fool\'s Mate", charset="UTF-8"', 'cache-control': 'no-store' },
      });
    }
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, ctx, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
      console.error(err);
      return json({ error: 'Something went wrong on our side.' }, 500);
    }
  },
};

async function route(request, env, ctx, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === '/api/health') return json({ ok: true });
  if (pathname === '/api/stats' && method === 'GET') return json(await stats(env));
  if (pathname === '/api/daily' && method === 'GET') return json({ daily: dailyFor(url.searchParams.get('date')) });
  if (pathname === '/api/player' && method === 'GET') return json(await player(env, url));
  if (pathname === '/api/players' && method === 'GET') return json(await searchPlayers(env, url));
  if (pathname === '/api/leaderboard' && method === 'GET') return json(await leaderboard(env, url));
  if (pathname === '/api/games' && method === 'GET') return json(await listGames(env, url));
  if (pathname === '/api/games' && method === 'POST') return json(await createGame(request, env, ctx), 201);

  const m = pathname.match(/^\/api\/games\/([A-Za-z0-9]{6,16})(?:\/(move|resign|name))?$/);
  if (m) {
    const [, id, action] = m;
    if (!action && method === 'GET') return json(await getGame(env, id));
    if (action && method === 'POST') {
      const body = await readBody(request);
      if (action === 'move') return json(await move(env, id, body));
      if (action === 'resign') return json(await resignGame(env, id, body));
      if (action === 'name') return json(await rename(env, id, body));
    }
  }
  throw new HttpError(404, 'Not found');
}

// ---------------------------------------------------------------- handlers

async function createGame(request, env, ctx) {
  const body = await readBody(request);
  const mode = body.mode === 'daily' || body.mode === 'endless' ? body.mode : 'classic';
  const daily = mode === 'daily';
  // The daily is always today's (UTC): nobody can start yesterday's for the
  // standings. Endless gets a fresh Gary v Gary position from a random seed.
  const day = daily ? dailyPosition(todayUTC()) : mode === 'endless' ? positionFromSeed(`endless ${randomToken()}`) : null;
  const color = day ? day.playerColor : body.color === 'b' || body.color === 'w' ? body.color : cryptoRng(2) ? 'b' : 'w';
  const state = day ? newDailyGame(day) : newGame(color, cryptoRng);
  const id = randomId(10);
  const token = randomToken();
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO games (id, token_hash, name, player_color, moves, ply, fen, rep_keys, created_at, updated_at,
       mode, daily_date, start_ply)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, await sha256(token), cleanName(body.name), color, state.moves.join(' '), state.moves.length,
      state.fen, JSON.stringify(state.keys), now, now, mode, daily ? day.date : null,
      state.startPly || 0)
    .run();
  await bump(env, { games: 1 });

  // Opportunistic housekeeping instead of a cron: occasionally drop games
  // nobody has touched in a week. Runs after the response is sent.
  if (cryptoRng(25) === 0) {
    ctx.waitUntil(
      env.DB.prepare(`DELETE FROM games WHERE status = 'active' AND updated_at < ?`).bind(now - STALE_ACTIVE_MS).run(),
    );
  }

  const row = await loadRow(env, id);
  return { token, game: await publicGame(env, row) };
}

async function getGame(env, id) {
  return { game: await publicGame(env, await loadRow(env, id)) };
}

async function move(env, id, body) {
  const row = await loadRow(env, id);
  await authorize(row, body.token);
  if (row.status !== 'active') throw new HttpError(409, 'This game is already over.', { game: await publicGame(env, row) });
  // The client says which ply it thinks it's on. A mismatch means a double
  // submit or a second tab; never apply a move to a position the player
  // didn't see.
  if (body.ply !== row.ply) throw new HttpError(409, 'Out of sync with the server.', { game: await publicGame(env, row) });
  if (typeof body.move !== 'string') throw new HttpError(400, 'Missing move.');

  const res = playerMove(stateOf(row), body.move, cryptoRng);
  if (res.error) throw new HttpError(400, res.error, { game: await publicGame(env, row) });

  const updated = await save(env, row, res.state);
  return { game: await publicGame(env, updated) };
}

async function resignGame(env, id, body) {
  const row = await loadRow(env, id);
  await authorize(row, body.token);
  if (row.status !== 'active') return { game: await publicGame(env, row) };
  const updated = await save(env, row, resign(stateOf(row)));
  return { game: await publicGame(env, updated) };
}

// Lets a player put their name on a game after the fact, e.g. they played as
// "Anonymous" and then got the 2-move fool's mate.
async function rename(env, id, body) {
  const row = await loadRow(env, id);
  await authorize(row, body.token);
  const name = cleanName(body.name);
  await env.DB.prepare(`UPDATE games SET name = ? WHERE id = ?`).bind(name, id).run();
  return { game: await publicGame(env, { ...row, name }) };
}

async function listGames(env, url) {
  const limit = clampInt(url.searchParams.get('limit'), 1, 50, 20);
  const ids = (url.searchParams.get('ids') || '').split(',').filter((s) => /^[A-Za-z0-9]{6,16}$/.test(s)).slice(0, 50);
  let rows;
  if (ids.length) {
    rows = await all(env, `SELECT * FROM games WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at DESC`, ids);
  } else if (url.searchParams.get('scope') === 'live') {
    rows = await all(env, `SELECT * FROM games WHERE status = 'active' AND updated_at > ? ORDER BY updated_at DESC LIMIT ?`,
      [Date.now() - LIVE_WINDOW_MS, limit]);
  } else if (url.searchParams.get('scope') === 'losses') {
    // The front page's "Latest losses": successful checkmates only. A daily
    // one is listed only if it was that name's new best for the day, so one
    // person's thirty tries don't fill the column.
    rows = await all(env, `
      SELECT g.*, CASE WHEN g.mode = 'daily' THEN (
               SELECT COUNT(*) FROM games t WHERE t.mode = 'daily' AND t.daily_date = g.daily_date
                 AND lower(t.name) = lower(g.name) AND t.created_at <= g.created_at) END AS tries
      FROM games g
      WHERE g.result = 'mated' AND (g.mode != 'daily' OR NOT EXISTS (
        SELECT 1 FROM games p WHERE p.mode = 'daily' AND p.daily_date = g.daily_date AND lower(p.name) = lower(g.name)
          AND p.result = 'mated' AND p.player_moves <= g.player_moves AND p.ended_at < g.ended_at))
      ORDER BY g.ended_at DESC LIMIT ?`, [limit]);
    return { games: rows.map((r) => ({ ...summary(r), tries: r.tries ?? undefined })) };
  } else {
    // Finished games; resignations (mostly "start again") only on request.
    const resigned = url.searchParams.get('resigned') === '1' ? '' : `AND result != 'resigned'`;
    rows = await all(env, `SELECT * FROM games WHERE status = 'finished' ${resigned} ORDER BY ended_at DESC LIMIT ?`, [limit]);
  }
  return { games: rows.map(summary) };
}

// Today's daily position (or another date's, for showing past dailies).
function dailyFor(date) {
  const d = isDate(date) ? date : todayUTC();
  if (dailyNumber(d) < 1 || d > todayUTC()) throw new HttpError(404, 'There is no daily for that date.');
  return dailyPosition(d);
}

// One line per name for a day's daily: their best score, and "tries", how
// many daily games that name had started that day up to and including it.
// Ranked by moves, then fewer tries, then the faster game.
async function dailyBoard(env, date, limit) {
  return all(env, `
    SELECT b.*, (SELECT COUNT(*) FROM games t
                 WHERE t.mode = 'daily' AND t.daily_date = b.daily_date
                   AND lower(t.name) = lower(b.name) AND t.created_at <= b.created_at) AS tries
    FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY player_moves, created_at) AS rn
          FROM games WHERE mode = 'daily' AND daily_date = ? AND result = 'mated'
            AND lower(name) != 'anonymous') b
    WHERE b.rn = 1
    ORDER BY b.player_moves, tries, b.duration_ms
    LIMIT ?`, [date, limit]);
}

// Everything one name has played: per-day daily bests (with tries), classic
// best, endless tally, recent results. Names aren't accounts, so this is
// "everyone who typed this name".
async function player(env, url) {
  const name = cleanName(url.searchParams.get('name'));
  const [dailies, totals, recent] = await env.DB.batch([
    env.DB.prepare(`
      SELECT daily_date, COUNT(*) AS tries, MIN(CASE WHEN result = 'mated' THEN player_moves END) AS best
      FROM games WHERE lower(name) = lower(?) AND mode = 'daily'
      GROUP BY daily_date ORDER BY daily_date DESC LIMIT 60`).bind(name),
    env.DB.prepare(`
      SELECT mode, COUNT(*) AS games, SUM(result = 'mated') AS mated, MIN(CASE WHEN result = 'mated' THEN player_moves END) AS best
      FROM games WHERE lower(name) = lower(?) GROUP BY mode`).bind(name),
    env.DB.prepare(`
      SELECT * FROM games WHERE lower(name) = lower(?) AND status = 'finished' AND result != 'resigned'
      ORDER BY created_at DESC LIMIT 30`).bind(name),
  ]);
  return {
    name,
    dailies: dailies.results.map((r) => ({ date: r.daily_date, number: dailyNumber(r.daily_date), tries: r.tries, best: r.best })),
    modes: Object.fromEntries(totals.results.map((r) => [r.mode, { games: r.games, mated: r.mated, best: r.best }])),
    recent: recent.results.map(summary),
  };
}

// Names starting with what's been typed, for the search box.
async function searchPlayers(env, url) {
  const q = cleanName(url.searchParams.get('q')).toLowerCase();
  if (!url.searchParams.get('q') || q === 'anonymous') return { names: [] };
  // A prefix range rather than LIKE, so the lower(name) index is used.
  const rows = await all(env, `
    SELECT name, COUNT(*) AS games FROM games
    WHERE lower(name) >= ? AND lower(name) < ? AND lower(name) != 'anonymous'
    GROUP BY lower(name) ORDER BY games DESC LIMIT 8`, [q, q + String.fromCharCode(0xffff)]);
  return { names: rows.map((r) => ({ name: r.name, games: r.games })) };
}

async function leaderboard(env, url) {
  const limit = clampInt(url.searchParams.get('limit'), 1, 100, 50);
  const dailyParam = url.searchParams.get('daily');
  if (dailyParam) {
    const date = dailyParam === 'today' ? todayUTC() : dailyParam;
    if (!isDate(date)) throw new HttpError(400, 'Bad date.');
    const rows = await dailyBoard(env, date, limit);
    return { date, number: dailyNumber(date), entries: rows.map((r) => ({ ...summary(r), tries: r.tries })) };
  }
  const color = url.searchParams.get('color');
  const colorSql = color === 'w' || color === 'b' ? `AND player_color = '${color}'` : '';
  const order = 'player_moves ASC, duration_ms ASC, ended_at ASC';
  const sql = url.searchParams.get('unique') === '1'
    ? `SELECT * FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY ${order}) AS rn
         FROM games WHERE result = 'mated' AND mode = 'classic' ${colorSql}
       ) WHERE rn = 1 ORDER BY ${order} LIMIT ?`
    : `SELECT * FROM games WHERE result = 'mated' AND mode = 'classic' ${colorSql} ORDER BY ${order} LIMIT ?`;
  const rows = await all(env, sql, [limit]);
  return { entries: rows.map(summary) };
}

async function stats(env) {
  const [counters, best, live] = await env.DB.batch([
    env.DB.prepare(`SELECT key, value FROM counters`),
    env.DB.prepare(`SELECT MIN(player_moves) AS best FROM games WHERE result = 'mated' AND mode = 'classic'`),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM games WHERE status = 'active' AND updated_at > ?`).bind(Date.now() - LIVE_WINDOW_MS),
  ]);
  const c = Object.fromEntries(counters.results.map((r) => [r.key, r.value]));
  return { ...c, best: best.results[0]?.best ?? null, live: live.results[0]?.n ?? 0 };
}

// ---------------------------------------------------------------- storage

async function loadRow(env, id) {
  const row = await env.DB.prepare(`SELECT * FROM games WHERE id = ?`).bind(id).first();
  if (!row) throw new HttpError(404, 'Game not found.');
  return row;
}

function stateOf(row) {
  return {
    playerColor: row.player_color,
    fen: row.fen,
    moves: row.moves ? row.moves.split(' ') : [],
    keys: JSON.parse(row.rep_keys),
    startPly: row.start_ply || 0,
    result: row.result,
    reason: row.reason,
  };
}

// Writes the new state only if nobody else wrote this game since we read it
// (same ply). That makes each ply happen exactly once, which also means the
// bot's random reply can't be re-rolled by replaying a request.
async function save(env, row, state) {
  const now = Date.now();
  const finished = state.result != null;
  const next = {
    ...row,
    moves: state.moves.join(' '),
    ply: state.moves.length,
    fen: state.fen,
    rep_keys: JSON.stringify(state.keys),
    status: finished ? 'finished' : 'active',
    result: state.result,
    reason: state.reason,
    player_moves: playerMoveCount(state),
    updated_at: now,
    ended_at: finished ? now : null,
    duration_ms: finished ? now - row.created_at : null,
  };
  const res = await env.DB.prepare(
    `UPDATE games SET moves = ?, ply = ?, fen = ?, rep_keys = ?, status = ?, result = ?, reason = ?,
       player_moves = ?, updated_at = ?, ended_at = ?, duration_ms = ?
     WHERE id = ? AND ply = ? AND status = 'active'`,
  )
    .bind(next.moves, next.ply, next.fen, next.rep_keys, next.status, next.result, next.reason,
      next.player_moves, next.updated_at, next.ended_at, next.duration_ms, row.id, row.ply)
    .run();
  if (res.meta.changes !== 1) {
    throw new HttpError(409, 'Out of sync with the server.', { game: await publicGame(env, await loadRow(env, row.id)) });
  }
  if (finished) await bump(env, { [state.result]: 1, plies: next.ply });
  return next;
}

async function bump(env, deltas) {
  await env.DB.batch(
    Object.entries(deltas).map(([key, d]) =>
      env.DB.prepare(`UPDATE counters SET value = value + ? WHERE key = ?`).bind(d, key)),
  );
}

async function all(env, sql, params) {
  const res = await env.DB.prepare(sql).bind(...params).all();
  return res.results;
}

// ---------------------------------------------------------------- shaping

function summary(row) {
  return {
    id: row.id,
    name: row.name,
    playerColor: row.player_color,
    status: row.status,
    result: row.result,
    reason: row.reason,
    playerMoves: row.player_moves,
    ply: row.ply,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    mode: row.mode || 'classic',
    dailyDate: row.daily_date ?? null,
    dailyNumber: row.daily_date ? dailyNumber(row.daily_date) : null,
    startPly: row.start_ply || 0,
  };
}

async function publicGame(env, row) {
  const game = { ...summary(row), moves: row.moves ? row.moves.split(' ') : [], fen: row.fen };
  if (row.mode === 'daily') {
    const t = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM games WHERE mode = 'daily' AND daily_date = ? AND lower(name) = lower(?) AND created_at <= ?`,
    ).bind(row.daily_date, row.name, row.created_at).first();
    game.tries = t?.n ?? 1;
    if (row.result === 'mated') {
      // Place on the day's board; if this wasn't the name's best run, report
      // the run that is.
      const board = await dailyBoard(env, row.daily_date, 1000);
      const i = board.findIndex((e) => e.id === row.id);
      const j = i >= 0 ? i : board.findIndex((e) => e.name.toLowerCase() === row.name.toLowerCase());
      game.rank = j >= 0 ? j + 1 : null;
      game.bestToday = j >= 0 ? { playerMoves: board[j].player_moves, tries: board[j].tries, isThis: i >= 0 } : null;
    }
    return game;
  }
  if (row.mode === 'endless') return game; // never ranked
  if (row.result === 'mated') {
    // Leaderboard position among all successful classic runs.
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS better FROM games WHERE result = 'mated' AND mode = 'classic' AND (
         player_moves < ?1 OR (player_moves = ?1 AND (duration_ms < ?2 OR (duration_ms = ?2 AND ended_at < ?3))))`,
    ).bind(row.player_moves, row.duration_ms, row.ended_at).first();
    game.rank = (r?.better ?? 0) + 1;
  }
  return game;
}

// ---------------------------------------------------------------- helpers

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

// HTTP Basic auth: the browser shows its own login box and then sends the
// header on every request, including the app's fetch() calls. Any username
// works; only the password is checked. Hashing both sides first makes the
// comparison constant-time.
async function hasSitePassword(request, password) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const given = decoded.slice(decoded.indexOf(':') + 1);
  return (await sha256(given)) === (await sha256(password));
}

async function authorize(row, token) {
  if (typeof token !== 'string' || (await sha256(token)) !== row.token_hash) {
    throw new HttpError(403, "That's not your game.");
  }
}

function cleanName(name) {
  const s = String(name ?? '')
    .normalize('NFKC')
    // control chars, zero-width and bidi-override characters
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...s].slice(0, 20).join('') || 'Anonymous';
}

function clampInt(v, min, max, dflt) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function randomId(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[cryptoRng(ALPHABET.length)];
  return s;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(s) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
