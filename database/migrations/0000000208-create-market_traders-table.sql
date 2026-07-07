CREATE TABLE IF NOT EXISTS "market_traders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "venue" TEXT,
  "external_id" TEXT,
  "alias" TEXT,
  "trade_count" INTEGER not null default 0,
  "total_notional" REAL not null default 0,
  "avg_trade_size" REAL not null default 0,
  "max_trade_size" REAL not null default 0,
  "resolved_trade_count" INTEGER not null default 0,
  "winning_trade_count" INTEGER not null default 0,
  "win_rate" REAL not null default 0,
  "smart_score" REAL not null default 0,
  "is_whale" INTEGER not null default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "market_traders_venue_external_id" ON "market_traders" ("venue", "external_id");
