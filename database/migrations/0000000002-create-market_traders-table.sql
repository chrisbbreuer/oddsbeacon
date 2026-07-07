CREATE TABLE IF NOT EXISTS "market_traders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "venue" TEXT,
  "external_id" TEXT,
  "alias" TEXT,
  "trade_count" INTEGER,
  "total_notional" REAL,
  "avg_trade_size" REAL,
  "max_trade_size" REAL,
  "resolved_trade_count" INTEGER,
  "winning_trade_count" INTEGER,
  "win_rate" REAL,
  "smart_score" REAL,
  "is_whale" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);