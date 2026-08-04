CREATE TABLE IF NOT EXISTS "event_results" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "home_score" REAL not null default 0,
  "away_score" REAL not null default 0,
  "winner_side" TEXT not null default '',
  "period_scores" TEXT default '',
  "completed" INTEGER default 1,
  "source" TEXT default 'espn',
  "settled_at" TEXT not null,
  "graded_at" TEXT default '',
  "market_event_id" INTEGER REFERENCES "market_events"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_results_event" ON "event_results" ("market_event_id");
