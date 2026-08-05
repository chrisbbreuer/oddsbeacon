CREATE TABLE IF NOT EXISTS "team_injuries" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "athlete_name" TEXT not null,
  "status" TEXT default '',
  "injury_type" TEXT default '',
  "severity" REAL default 0,
  "source" TEXT default 'espn',
  "captured_at" TEXT not null,
  "sports_team_id" INTEGER REFERENCES "sports_teams"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "team_injuries_team_captured" ON "team_injuries" ("sports_team_id", "captured_at");
