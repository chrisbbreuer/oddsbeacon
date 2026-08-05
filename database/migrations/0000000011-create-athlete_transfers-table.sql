CREATE TABLE IF NOT EXISTS "athlete_transfers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "from_sports_team_id" INTEGER default 0,
  "to_sports_team_id" INTEGER default 0,
  "from_team_name" TEXT default '',
  "to_team_name" TEXT default '',
  "kind" TEXT default 'transfer',
  "season" TEXT default '',
  "transferred_on" TEXT default '',
  "fee_eur" INTEGER default 0,
  "market_value_eur" INTEGER default 0,
  "provider" TEXT default 'transfermarkt',
  "external_id" TEXT not null,
  "athlete_id" INTEGER REFERENCES "athletes"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_transfers_natural" ON "athlete_transfers" ("athlete_id", "provider", "external_id");
CREATE INDEX IF NOT EXISTS "athlete_transfers_date" ON "athlete_transfers" ("athlete_id", "transferred_on");
