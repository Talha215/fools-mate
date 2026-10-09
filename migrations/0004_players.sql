-- Player pages and player search: every game by name, newest first.
CREATE INDEX games_by_name ON games (lower(name), created_at);
