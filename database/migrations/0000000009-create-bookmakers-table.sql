CREATE TABLE IF NOT EXISTS "bookmakers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "slug" TEXT not null,
  "kind" TEXT not null default 'sportsbook',
  "accent" TEXT default 'slate',
  "short" TEXT default '',
  "provider_key" TEXT default '',
  "region" TEXT default 'us',
  "sharp" INTEGER default 0,
  "consensus_weight" REAL default 1,
  "active" INTEGER default 1,
  "url" TEXT default '',
  "last_seen_at" TEXT default '',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "bookmakers_slug" ON "bookmakers" ("slug");
