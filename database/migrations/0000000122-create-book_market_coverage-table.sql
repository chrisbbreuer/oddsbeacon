CREATE TABLE IF NOT EXISTS "book_market_coverage" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "market_type" TEXT not null,
  "line_count" REAL default 0,
  "last_seen_at" TEXT default '',
  "bookmaker_id" INTEGER REFERENCES "bookmakers"("id"),
  "market_event_id" INTEGER REFERENCES "market_events"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "book_market_coverage_book_event_type" ON "book_market_coverage" ("bookmaker_id", "market_event_id", "market_type");
CREATE INDEX IF NOT EXISTS "book_market_coverage_event" ON "book_market_coverage" ("market_event_id");
