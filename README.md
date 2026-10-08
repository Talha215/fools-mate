# Fool's Mate

Chess against **Gary**, a computer that plays a random legal move every turn.
The goal is upside down: **get checkmated in as few of your own moves as possible.**
The theoretical best is 2 (Fool's Mate: 1. f3 e5 2. g4?? Qh4#), which needs the
bot to pick the right 1-in-300 line.

- Getting checkmated: success, goes in the standings, scored by your move count (ties: faster game).
- Checkmating the bot, stalemate, threefold repetition, 50-move rule, insufficient material: fail.
- Every game is saved and replayable at `/replay/<id>`, including games still in progress (spectating).

## Run it locally

This project brings its own Node 24 in `.node\` (the rest of `Web Apps` stays on Node 16).
`run.cmd` puts it first on PATH for one command:

```powershell
.\run npm install          # first time only
.\run npm run dev          # http://localhost:5180
.\run npm test             # rules + bot unit tests
.\run node scripts\smoke.mjs   # end-to-end API check against the dev server
```

On a fresh clone, `.node\` is missing; get it with
`powershell -ExecutionPolicy Bypass -File scripts\get-node.ps1`.

`npm run dev` applies database migrations to a local SQLite copy of D1 (in `.wrangler\`)
and runs the Worker inside the real Workers runtime, so dev behaves like production.

## Deploy (Cloudflare free tier)

Run these in a normal PowerShell window in this folder (Wrangler asks a few questions, so it
needs a real terminal). Your Cloudflare email address must be verified first.

One time:

```powershell
.\run npx wrangler login                                # browser opens: log in, click Allow
.\run npx wrangler d1 create fools-mate --binding DB    # creates the DB, writes its id into wrangler.jsonc
.\run npx wrangler secret put SITE_PASSWORD             # private mode (see below); answer y to create the Worker
```

Every deploy, including the first:

```powershell
.\run npm run deploy     # build, apply DB migrations remotely, upload
```

The first deploy may ask you to register a workers.dev subdomain; pick any name. The site is
then at `https://fools-mate.<your-subdomain>.workers.dev` (a brand-new subdomain can take a few
minutes to start resolving).

**Private mode.** While the `SITE_PASSWORD` secret exists, every page and API call asks for it
(the browser's own login box: any username, that password). Go public with
`.\run npx wrangler secret delete SITE_PASSWORD`; no redeploy needed. Local dev never asks,
unless you put `SITE_PASSWORD=...` in a `.dev.vars` file.

Free plan limits that matter:
100k requests/day (1 per move), D1 100k rows written/day (about 2 per move, because D1 also counts
index entries; the indexes are partial to keep this low), 5 GB storage, 10 ms CPU per request.
In practice that's roughly 50k moves a day before anything throttles.
A move request uses about 0.3 ms of CPU (`.\run node scripts\bench-cpu.mjs` measures it).

**Before making it public:** chessground (the board) is GPL-3.0, so this app is too, and anyone
using the site must be able to get the source. Push the repo somewhere public and set
`SOURCE_URL` in `src/config.js`; the footer links to it.

## How it works

```
browser (React + chessground)  --POST move-->  Worker (worker/index.js)  -->  D1 (SQLite)
                                <--game state--   validates, bot replies
```

The server is authoritative, which is what makes the leaderboard meaningful:

- The browser only ever sends the player's move. The bot's reply is chosen on the server
  with `crypto.getRandomValues`, so nobody can pick it from the console.
- Only the device that started a game can move in it: it holds a random token, the server stores its SHA-256.
- Each move must name the ply it was made on, and the row is updated with `WHERE ply = ?`.
  A replayed or duplicate request gets `409`, so a bad bot reply can't be re-rolled, and two tabs can't fork a game.
- Draws are applied automatically (chess.com style). Threefold repetition is tracked with the
  positions since the last pawn move or capture (`rep_keys`), since nothing earlier can repeat.

| Path | What |
| --- | --- |
| `worker/index.js` | API routes, storage, leaderboard, stats |
| `worker/game.js` | Pure game state machine (unit tested) |
| `worker/bot.js` | **The bot's brain.** `chooseMove(chess, legalSanMoves, rng)` |
| `shared/rules.js` | Rules helpers used by both server and browser |
| `migrations/` | D1 schema |
| `src/pages/Game.jsx` | Live game: optimistic moves, premoves, promotion, Gary's options |
| `src/pages/Replay.jsx` | Replays, spectating (polls while a game is live), PGN export |
| `src/lib/annotate.js` | Annotates games from the loser-wins side (`??` on missed mates) and writes PGN |
| `src/components/Board.jsx` | chessground wrapper |
| `src/lib/sound.js` | All sounds are synthesised (no audio files) |
| `shared/bot.js` | The opponent's name as shown on the site |

### Design

The site is set like a typewritten chess-club bulletin: newsprint, ink rules, Old Standard
for headlines and Courier Prime for text (both self-hosted, OFL). The chess-print details are
deliberate: the result slip is rubber-stamped, the front-page problem prints its solution upside
down, annotations use real chess notation (`!`, `??`), and the "Diagram" board theme hatches
the dark squares like a printed book. Gary doesn't talk; the scoresheet notes do the commentary.
Pages: `/` front page, `/standings`, `/archive`, `/game/<id>`, `/replay/<id>`
(the old `/leaderboard` and `/games` URLs still work).

### Changing the bot

Edit `chooseMove` in `worker/bot.js`. It receives a chess.js instance and the legal moves as
SAN strings, and must return one of them (the caller rejects anything else). Keep it under the
10 ms CPU budget, and avoid `chess.moves({ verbose: true })` on the server: it is quadratic
(see the note in `shared/rules.js`).

### API

| Method | Path | Body |
| --- | --- | --- |
| POST | `/api/games` | `{ color?: 'w'\|'b', name? }` returns `{ token, game }` |
| GET | `/api/games/:id` | public game state |
| POST | `/api/games/:id/move` | `{ token, ply, move: 'e2e4' }` |
| POST | `/api/games/:id/resign` | `{ token }` |
| POST | `/api/games/:id/name` | `{ token, name }` |
| GET | `/api/games?scope=recent\|live` or `?ids=a,b` | game summaries |
| GET | `/api/leaderboard?color=w\|b&unique=1&limit=50` | best runs |
| GET | `/api/stats` | totals for the home page |

## Known limits

- Names aren't accounts: anyone can type any name. "Best run per player" groups by name.
- No rate limiting. A script could play thousands of games hunting for a 2-move loss. It still
  can't fake one; it just gets more lottery tickets. Cloudflare's free WAF rate-limit rule can cap this.
- Abandoned games are pruned after 7 days of inactivity.

## Credits

Board: [chessground](https://github.com/lichess-org/chessground) (lichess.org, GPL-3.0).
Rules: [chess.js](https://github.com/jhlywa/chess.js) (BSD-2). Pieces: cburnett set by Colin M.L. Burnett.
