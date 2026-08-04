PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_market_events" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT not null,
  "category" TEXT default '',
  "league" TEXT default '',
  "commence_at" TEXT not null,
  "status" TEXT not null default 'scheduled',
  "home_sports_team_id" INTEGER REFERENCES "sports_teams"("id") ON DELETE SET NULL,
  "away_sports_team_id" INTEGER REFERENCES "sports_teams"("id") ON DELETE SET NULL,
  "venue" TEXT default '',
  "broadcast" TEXT default '',
  "status_detail" TEXT default '',
  "last_seen_at" TEXT default '',
  "closing_captured_at" TEXT default '',
  "sport_id" INTEGER REFERENCES "sports"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "market" TEXT,
  "starts_at" TEXT,
  "updated_minutes_ago" REAL,
  "complete" INTEGER
);
INSERT INTO "_qb_tmp_market_events" ("id", "title", "category", "league", "created_at", "updated_at", "market", "starts_at", "updated_minutes_ago", "complete") SELECT "id", "title", "category", "league", "created_at", "updated_at", "market", "starts_at", "updated_minutes_ago", "complete" FROM "market_events";
DROP TABLE "market_events";
ALTER TABLE "_qb_tmp_market_events" RENAME TO "market_events";
CREATE INDEX IF NOT EXISTS "market_events_sport_commence" ON "market_events" ("sport_id", "commence_at");
CREATE INDEX IF NOT EXISTS "market_events_status_commence" ON "market_events" ("status", "commence_at");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
DROP INDEX IF EXISTS "market_traders_market_traders_venue_external_id";
DROP INDEX IF EXISTS "prediction_markets_prediction_markets_venue_external_id";
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_selections" (
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
  "updated_at" TEXT,
  "market_event_id" INTEGER REFERENCES "market_events"("id")
);
INSERT INTO "_qb_tmp_selections" ("id", "label", "position", "created_at", "updated_at", "market_event_id") SELECT "id", "label", "position", "created_at", "updated_at", "market_event_id" FROM "selections";
DROP TABLE "selections";
ALTER TABLE "_qb_tmp_selections" RENAME TO "selections";
CREATE UNIQUE INDEX IF NOT EXISTS "selections_market_side_point" ON "selections" ("market_id", "side", "point_key");
CREATE INDEX IF NOT EXISTS "selections_team" ON "selections" ("sports_team_id");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
