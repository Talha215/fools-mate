-- One row per game. The server is authoritative: the browser only ever sends
-- the player's move, and the bot's reply is chosen here.
CREATE TABLE games (
  id           TEXT PRIMARY KEY,
  token_hash   TEXT NOT NULL,                -- SHA-256 of the player's secret; only they can move
  name         TEXT NOT NULL,
  player_color TEXT NOT NULL CHECK (player_color IN ('w', 'b')),
  moves        TEXT NOT NULL DEFAULT '',     -- space-separated UCI, for replays
  ply          INTEGER NOT NULL DEFAULT 0,   -- optimistic-concurrency guard: each ply is played once
  fen          TEXT NOT NULL,
  rep_keys     TEXT NOT NULL,                -- JSON array: positions since last pawn move/capture (threefold)
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  result       TEXT CHECK (result IN ('mated', 'won', 'draw', 'resigned')),
  reason       TEXT,
  player_moves INTEGER NOT NULL DEFAULT 0,   -- the score: fewer is better
  created_at   INTEGER NOT NULL,             -- epoch ms
  updated_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  duration_ms  INTEGER                       -- leaderboard tie-break
);

-- Partial indexes: D1 bills every index entry touched as a row written, so
-- each index only covers the rows its queries need. An ordinary move then
-- writes 2 rows (the game + its spot in the active index), not 4.
CREATE INDEX games_leaderboard ON games (player_moves, duration_ms, ended_at) WHERE result = 'mated';
CREATE INDEX games_finished ON games (ended_at) WHERE status = 'finished';
CREATE INDEX games_active ON games (updated_at) WHERE status = 'active';

-- Running totals for the home page, so stats never need a full table scan
-- (D1 bills by rows read).
CREATE TABLE counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT INTO counters (key, value) VALUES
  ('games', 0), ('mated', 0), ('won', 0), ('draw', 0), ('resigned', 0), ('plies', 0);
