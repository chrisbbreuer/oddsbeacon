CREATE TABLE IF NOT EXISTS "selections" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "label" TEXT not null,
  "side" TEXT not null,
  "point" REAL,
  "point_key" TEXT not null default '',
  "position" REAL default 0,
  "sports_team_id" INTEGER REFERENCES "sports_teams"("id") ON DELETE SET NULL,
  "outcome" REAL not null default -1,
  "graded_at" TEXT default '',
  "market_id" INTEGER REFERENCES "markets"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "selections_market_side_point" ON "selections" ("market_id", "side", "point_key");
CREATE INDEX IF NOT EXISTS "selections_team" ON "selections" ("sports_team_id");
