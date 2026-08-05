CREATE TABLE IF NOT EXISTS "market_events" (
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
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "market_events_sport_commence" ON "market_events" ("sport_id", "commence_at");
CREATE INDEX IF NOT EXISTS "market_events_status_commence" ON "market_events" ("status", "commence_at");
