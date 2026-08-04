CREATE TABLE IF NOT EXISTS "sports_teams" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "search_key" TEXT not null,
  "short_name" TEXT default '',
  "abbreviation" TEXT default '',
  "aliases" TEXT default '',
  "logo" TEXT default '',
  "espn_id" TEXT default '',
  "record" TEXT default '',
  "sport_id" INTEGER REFERENCES "sports"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_teams_sport_search_key" ON "sports_teams" ("sport_id", "search_key");
CREATE INDEX IF NOT EXISTS "sports_teams_espn_id" ON "sports_teams" ("espn_id");
