CREATE TABLE IF NOT EXISTS "team_identities" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT not null,
  "external_id" TEXT not null,
  "canonical_url" TEXT default '',
  "external_name" TEXT default '',
  "last_seen_at" TEXT default '',
  "sports_team_id" INTEGER REFERENCES "sports_teams"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_identities_provider_external" ON "team_identities" ("provider", "external_id");
CREATE INDEX IF NOT EXISTS "team_identities_team" ON "team_identities" ("sports_team_id");
