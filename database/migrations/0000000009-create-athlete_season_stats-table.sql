CREATE TABLE IF NOT EXISTS "athlete_season_stats" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "sports_team_id" INTEGER default 0,
  "season" TEXT not null,
  "competition" TEXT default '',
  "appearances" INTEGER default 0,
  "starts" INTEGER default 0,
  "minutes" INTEGER default 0,
  "points" REAL default 0,
  "goals" INTEGER default 0,
  "assists" INTEGER default 0,
  "metrics" TEXT default '{}',
  "provider" TEXT default 'transfermarkt',
  "athlete_id" INTEGER REFERENCES "athletes"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_season_stats_athlete_stats_natural" ON "athlete_season_stats" ("athlete_id", "provider", "season", "competition", "sports_team_id");
CREATE INDEX IF NOT EXISTS "athlete_season_stats_athlete_stats_lookup" ON "athlete_season_stats" ("athlete_id", "season");
