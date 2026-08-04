CREATE TABLE IF NOT EXISTS "markets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "market_type" TEXT not null default 'h2h',
  "label" TEXT default '',
  "line" REAL,
  "line_key" TEXT not null default '',
  "period" TEXT not null default 'full_game',
  "player_name" TEXT default '',
  "complete" INTEGER default 1,
  "status" TEXT not null default 'open',
  "position" REAL default 0,
  "market_event_id" INTEGER REFERENCES "market_events"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "markets_event_type_line_period" ON "markets" ("market_event_id", "market_type", "line_key", "period");
CREATE INDEX IF NOT EXISTS "markets_type" ON "markets" ("market_type");
