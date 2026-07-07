CREATE TABLE IF NOT EXISTS "prediction_markets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "venue" TEXT,
  "external_id" TEXT,
  "question" TEXT,
  "category" TEXT,
  "status" TEXT,
  "result" TEXT,
  "volume" REAL,
  "liquidity" REAL,
  "last_price" REAL,
  "ends_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);