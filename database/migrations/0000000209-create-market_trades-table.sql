CREATE TABLE IF NOT EXISTS "market_trades" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "prediction_market_id" INTEGER,
  "market_trader_id" INTEGER not null default 0,
  "venue" TEXT,
  "external_id" TEXT,
  "side" TEXT,
  "price" REAL,
  "size" REAL,
  "notional" REAL,
  "is_winner" INTEGER not null default -1,
  "traded_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "market_trades_venue_external_id" ON "market_trades" ("venue", "external_id");
CREATE INDEX IF NOT EXISTS "market_trades_market" ON "market_trades" ("prediction_market_id");
CREATE INDEX IF NOT EXISTS "market_trades_trader" ON "market_trades" ("market_trader_id");
