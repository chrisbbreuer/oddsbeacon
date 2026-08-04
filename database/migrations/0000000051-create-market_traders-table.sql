CREATE TABLE IF NOT EXISTS "market_traders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "venue" TEXT,
  "external_id" TEXT,
  "alias" TEXT,
  "trade_count" REAL,
  "total_notional" REAL,
  "avg_trade_size" REAL,
  "max_trade_size" REAL,
  "resolved_trade_count" REAL,
  "winning_trade_count" REAL,
  "win_rate" REAL,
  "smart_score" REAL,
  "is_whale" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "market_traders_venue_external_id" ON "market_traders" ("venue", "external_id");
