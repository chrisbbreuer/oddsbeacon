CREATE TABLE IF NOT EXISTS "trading_halts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "active" INTEGER,
  "reason" TEXT,
  "actor" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
