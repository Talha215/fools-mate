-- Game modes: 'classic' (from move one), 'daily' (today's shared Gary v Gary
-- position) and 'endless' (a fresh one each game, unranked). Existing games
-- become 'classic'.
ALTER TABLE games ADD COLUMN mode TEXT NOT NULL DEFAULT 'classic' CHECK (mode IN ('classic', 'daily', 'endless'));
ALTER TABLE games ADD COLUMN daily_date TEXT;                    -- UTC date, daily games only
ALTER TABLE games ADD COLUMN start_ply INTEGER NOT NULL DEFAULT 0; -- where Gary v Gary hands over (daily, endless)

-- Partial, like the others, so ordinary moves don't write to them.
CREATE INDEX games_daily_board ON games (daily_date, player_moves, duration_ms) WHERE result = 'mated' AND mode = 'daily';
-- "Tries": a name's daily games that day, counted up to a given game.
CREATE INDEX games_daily_tries ON games (daily_date, lower(name), created_at) WHERE mode = 'daily';
