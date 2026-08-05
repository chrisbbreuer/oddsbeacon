CREATE TABLE IF NOT EXISTS "athlete_identities" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT not null,
  "external_id" TEXT not null,
  "canonical_url" TEXT not null,
  "external_name" TEXT default '',
  "aliases" TEXT default '[]',
  "profile_facts" TEXT default '{}',
  "last_seen_at" TEXT default '',
  "athlete_id" INTEGER REFERENCES "athletes"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "athlete_identities_provider_external" ON "athlete_identities" ("provider", "external_id");
CREATE INDEX IF NOT EXISTS "athlete_identities_athlete" ON "athlete_identities" ("athlete_id");
