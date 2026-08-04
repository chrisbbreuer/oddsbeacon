CREATE TABLE IF NOT EXISTS "exchange_accounts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "venue" TEXT,
  "label" TEXT,
  "credentials" TEXT,
  "masked_identifier" TEXT,
  "status" TEXT,
  "balance" REAL,
  "last_error" TEXT,
  "last_synced_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "exchange_accounts_user_venue" ON "exchange_accounts" ("user_id", "venue");
