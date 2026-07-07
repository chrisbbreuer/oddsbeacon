CREATE TABLE IF NOT EXISTS "market_trades" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "prediction_market_id" INTEGER REFERENCES "prediction_markets"("id"),
  "market_trader_id" INTEGER REFERENCES "market_traders"("id"),
  "venue" TEXT,
  "external_id" TEXT,
  "side" TEXT,
  "price" REAL,
  "size" REAL,
  "notional" REAL,
  "is_winner" INTEGER,
  "traded_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);