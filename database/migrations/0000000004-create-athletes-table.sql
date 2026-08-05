CREATE TABLE IF NOT EXISTS "athletes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "search_key" TEXT not null,
  "given_name" TEXT default '',
  "family_name" TEXT default '',
  "date_of_birth" TEXT default '',
  "place_of_birth" TEXT default '',
  "nationality" TEXT default '',
  "second_nationality" TEXT default '',
  "position" TEXT default '',
  "secondary_positions" TEXT default '[]',
  "height_cm" INTEGER default 0,
  "preferred_foot" TEXT default '',
  "shirt_number" INTEGER default 0,
  "joined_on" TEXT default '',
  "contract_expires_on" TEXT default '',
  "agent_name" TEXT default '',
  "outfitter" TEXT default '',
  "status" TEXT default 'active',
  "image_url" TEXT default '',
  "last_seen_at" TEXT default '',
  "sport_id" INTEGER REFERENCES "sports"("id"),
  "sports_team_id" INTEGER REFERENCES "sports_teams"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "athletes_sport_search_key" ON "athletes" ("sport_id", "search_key");
CREATE INDEX IF NOT EXISTS "athletes_current_team" ON "athletes" ("sports_team_id");
