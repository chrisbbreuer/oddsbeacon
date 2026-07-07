CREATE TABLE IF NOT EXISTS "prediction_markets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "venue" TEXT,
  "external_id" INTEGER,
  "question" TEXT,
  "category" TEXT,
  "status" TEXT,
  "result" TEXT,
  "volume" INTEGER,
  "liquidity" INTEGER,
  "last_price" INTEGER,
  "ends_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);