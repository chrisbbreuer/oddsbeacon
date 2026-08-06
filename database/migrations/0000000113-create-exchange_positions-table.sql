CREATE TABLE IF NOT EXISTS "exchange_positions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "trading_strategy_id" INTEGER REFERENCES "trading_strategies"("id"),
  "exchange_account_id" INTEGER REFERENCES "exchange_accounts"("id"),
  "prediction_market_id" INTEGER REFERENCES "prediction_markets"("id"),
  "venue" TEXT,
  "market_external_id" TEXT,
  "side" TEXT,
  "size" REAL,
  "cost_basis" REAL,
  "avg_price" REAL,
  "realized_pnl" REAL,
  "status" TEXT,
  "settlement_price" REAL,
  "opened_at" TEXT,
  "settled_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "exchange_positions_strategy_status" ON "exchange_positions" ("trading_strategy_id", "status");
CREATE INDEX IF NOT EXISTS "exchange_positions_account" ON "exchange_positions" ("exchange_account_id");
CREATE INDEX IF NOT EXISTS "exchange_positions_market" ON "exchange_positions" ("prediction_market_id");
CREATE INDEX IF NOT EXISTS "exchange_positions_book" ON "exchange_positions" ("trading_strategy_id", "market_external_id", "side", "status");
