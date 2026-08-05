CREATE TABLE IF NOT EXISTS "athlete_market_values" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "value_eur" INTEGER not null,
  "valued_on" TEXT not null,
  "team_name" TEXT default '',
  "provider" TEXT default 'transfermarkt',
  "athlete_id" INTEGER REFERENCES "athletes"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_market_values_athlete_values_natural" ON "athlete_market_values" ("athlete_id", "provider", "valued_on");
CREATE INDEX IF NOT EXISTS "athlete_market_values_athlete_values_date" ON "athlete_market_values" ("athlete_id", "valued_on");
