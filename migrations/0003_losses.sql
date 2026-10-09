-- "Latest losses" on the front page: newest successful checkmates first.
CREATE INDEX games_mated_recent ON games (ended_at) WHERE result = 'mated';
