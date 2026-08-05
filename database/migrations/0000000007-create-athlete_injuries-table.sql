CREATE TABLE IF NOT EXISTS "athlete_injuries" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "injury_type" TEXT not null,
  "started_on" TEXT default '',
  "ended_on" TEXT default '',
  "days_missed" INTEGER default 0,
  "games_missed" INTEGER default 0,
  "status" TEXT default 'resolved',
  "provider" TEXT default 'transfermarkt',
  "athlete_id" INTEGER REFERENCES "athletes"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_injuries_natural" ON "athlete_injuries" ("athlete_id", "provider", "started_on", "injury_type");
CREATE INDEX IF NOT EXISTS "athlete_injuries_dates" ON "athlete_injuries" ("athlete_id", "started_on", "ended_on");
