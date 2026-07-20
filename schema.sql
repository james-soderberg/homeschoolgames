-- D1 schema for the shared global leaderboards.
-- Apply with:
--   npx wrangler d1 execute homeschoolgames-scores --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS scores (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  board  TEXT    NOT NULL,   -- the streak-rail key, e.g. hsg_lb_circa__easy
  name   TEXT    NOT NULL,   -- already sanitized: "First L."
  score  INTEGER NOT NULL,
  hinted INTEGER NOT NULL DEFAULT 0,
  ts     INTEGER NOT NULL    -- ms epoch; tie-breaker (earlier wins)
);

CREATE INDEX IF NOT EXISTS idx_scores_board ON scores(board, score DESC, ts ASC);

-- Best-effort per-IP write throttle (fixed window).
CREATE TABLE IF NOT EXISTS rate (
  ip    TEXT    PRIMARY KEY,
  ts    INTEGER NOT NULL,
  count INTEGER NOT NULL
);
