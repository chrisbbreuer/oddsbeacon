CREATE TABLE IF NOT EXISTS "exchange_orders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "trade_decision_id" INTEGER REFERENCES "trade_decisions"("id"),
  "exchange_account_id" INTEGER REFERENCES "exchange_accounts"("id"),
  "venue" TEXT,
  "client_order_id" TEXT,
  "external_order_id" TEXT,
  "market_external_id" TEXT,
  "side" TEXT,
  "limit_price" REAL,
  "size" REAL,
  "filled_size" REAL,
  "avg_fill_price" REAL,
  "status" TEXT,
  "error" TEXT,
  "placed_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "exchange_orders_decision" ON "exchange_orders" ("trade_decision_id");
CREATE INDEX IF NOT EXISTS "exchange_orders_account" ON "exchange_orders" ("exchange_account_id");
CREATE INDEX IF NOT EXISTS "exchange_orders_status" ON "exchange_orders" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_orders_client_order_id" ON "exchange_orders" ("client_order_id");
