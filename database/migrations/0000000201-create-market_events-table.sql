CREATE TABLE IF NOT EXISTS "market_events" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "category" TEXT,
  "league" TEXT,
  "market" TEXT,
  "starts_at" TEXT,
  "updated_minutes_ago" INTEGER,
  "complete" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
