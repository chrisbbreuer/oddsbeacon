CREATE TABLE IF NOT EXISTS "trading_strategies" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "name" TEXT,
  "venue" TEXT,
  "categories" TEXT,
  "bankroll" REAL,
  "max_stake" REAL,
  "min_edge" REAL,
  "min_confidence" REAL,
  "max_open_positions" REAL,
  "daily_loss_limit" REAL,
  "auto_execute" INTEGER,
  "status" TEXT,
  "halted_reason" TEXT,
  "last_run_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "trading_strategies_user" ON "trading_strategies" ("user_id");
CREATE INDEX IF NOT EXISTS "trading_strategies_status" ON "trading_strategies" ("status");
