CREATE TABLE IF NOT EXISTS "athlete_team_memberships" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "started_on" TEXT default '',
  "ended_on" TEXT default '',
  "squad_number" INTEGER default 0,
  "role" TEXT default 'player',
  "competition" TEXT default '',
  "source" TEXT default 'transfermarkt',
  "athlete_id" INTEGER REFERENCES "athletes"("id"),
  "sports_team_id" INTEGER REFERENCES "sports_teams"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_team_memberships_athlete_memberships_natural" ON "athlete_team_memberships" ("athlete_id", "sports_team_id", "started_on");
CREATE INDEX IF NOT EXISTS "athlete_team_memberships_athlete_memberships_team_dates" ON "athlete_team_memberships" ("sports_team_id", "started_on", "ended_on");
