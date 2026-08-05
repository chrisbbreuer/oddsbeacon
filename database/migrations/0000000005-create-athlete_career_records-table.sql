CREATE TABLE IF NOT EXISTS "athlete_career_records" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT not null,
  "category" TEXT not null,
  "external_id" TEXT not null,
  "title" TEXT default '',
  "season" TEXT default '',
  "competition" TEXT default '',
  "sports_team_id" INTEGER default 0,
  "team_name" TEXT default '',
  "occurred_on" TEXT default '',
  "ended_on" TEXT default '',
  "details" TEXT default '{}',
  "athlete_id" INTEGER REFERENCES "athletes"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_career_records_natural" ON "athlete_career_records" ("athlete_id", "provider", "category", "external_id");
CREATE INDEX IF NOT EXISTS "athlete_career_records_timeline" ON "athlete_career_records" ("athlete_id", "category", "occurred_on");
