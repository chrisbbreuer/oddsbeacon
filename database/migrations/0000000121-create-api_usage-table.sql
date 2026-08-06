CREATE TABLE IF NOT EXISTS "api_usage" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "api_key_id" INTEGER REFERENCES "api_keys"("id"),
  "day" TEXT,
  "endpoint" TEXT,
  "requests" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_usage_bucket" ON "api_usage" ("api_key_id", "day", "endpoint");
CREATE INDEX IF NOT EXISTS "api_usage_day" ON "api_usage" ("day");
