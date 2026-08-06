CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "name" TEXT,
  "prefix" TEXT,
  "hash" TEXT,
  "last_used_at" TEXT,
  "revoked_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "api_keys_user" ON "api_keys" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_prefix" ON "api_keys" ("prefix");
