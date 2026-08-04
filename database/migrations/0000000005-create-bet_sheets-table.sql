CREATE TABLE IF NOT EXISTS "bet_sheets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "token" TEXT,
  "leg_count" REAL,
  "parlay_decimal" REAL,
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
