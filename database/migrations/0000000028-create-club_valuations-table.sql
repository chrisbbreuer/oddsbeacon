CREATE TABLE IF NOT EXISTS "club_valuations" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "squad_value_eur" REAL default 0,
  "squad_size" REAL default 0,
  "average_age_years" REAL default 0,
  "league_tier" REAL default 0,
  "competition" TEXT default '',
  "source" TEXT default 'transfermarkt',
  "external_id" TEXT default '',
  "captured_at" TEXT not null,
  "sports_team_id" INTEGER REFERENCES "sports_teams"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "club_valuations_team_captured" ON "club_valuations" ("sports_team_id", "captured_at");
