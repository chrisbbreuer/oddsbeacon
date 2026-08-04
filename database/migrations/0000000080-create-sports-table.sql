CREATE TABLE IF NOT EXISTS "sports" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "slug" TEXT not null,
  "title" TEXT not null,
  "grouping" TEXT not null,
  "espn_path" TEXT default '',
  "odds_api_key" TEXT default '',
  "active" INTEGER default 1,
  "position" REAL default 0,
  "non_sporting" INTEGER default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_slug" ON "sports" ("slug");
