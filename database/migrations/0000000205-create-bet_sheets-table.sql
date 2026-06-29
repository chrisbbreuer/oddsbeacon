CREATE TABLE IF NOT EXISTS "bet_sheets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER,
  "token" TEXT,
  "name" TEXT,
  "leg_count" INTEGER,
  "parlay_decimal" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_bet_sheets_owner" ON "bet_sheets" ("user_id", "token");
