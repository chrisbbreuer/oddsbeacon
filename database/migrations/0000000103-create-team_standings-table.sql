CREATE TABLE IF NOT EXISTS "team_standings" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "wins" REAL default 0,
  "losses" REAL default 0,
  "ties" REAL default 0,
  "games_played" REAL default 0,
  "win_percent" REAL default 0,
  "points_for" REAL default 0,
  "points_against" REAL default 0,
  "point_differential" REAL default 0,
  "playoff_seed" REAL default 0,
  "group_name" TEXT default '',
  "source" TEXT default 'espn',
  "captured_at" TEXT not null,
  "sports_team_id" INTEGER REFERENCES "sports_teams"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "team_standings_team_captured" ON "team_standings" ("sports_team_id", "captured_at");
