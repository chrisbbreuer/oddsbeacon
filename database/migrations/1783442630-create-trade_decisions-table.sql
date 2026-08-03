CREATE TABLE IF NOT EXISTS "trade_decisions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "trading_strategy_id" INTEGER REFERENCES "trading_strategies"("id"),
  "prediction_market_id" INTEGER REFERENCES "prediction_markets"("id"),
  "venue" TEXT,
  "side" TEXT,
  "market_price" REAL,
  "fair_value" REAL,
  "edge" REAL,
  "confidence" REAL,
  "limit_price" REAL,
  "size" REAL,
  "notional" REAL,
  "rationale" TEXT,
  "decided_by" TEXT,
  "status" TEXT,
  "status_reason" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "trade_decisions_strategy" ON "trade_decisions" ("trading_strategy_id");
CREATE INDEX IF NOT EXISTS "trade_decisions_market" ON "trade_decisions" ("prediction_market_id");
CREATE INDEX IF NOT EXISTS "trade_decisions_status" ON "trade_decisions" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "trade_decisions_strategy_market" ON "trade_decisions" ("trading_strategy_id", "prediction_market_id");
