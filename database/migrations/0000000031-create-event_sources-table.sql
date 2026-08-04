CREATE TABLE IF NOT EXISTS "event_sources" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT not null,
  "external_id" TEXT not null,
  "matched_by" TEXT default 'external_id',
  "confidence" REAL default 1,
  "external_title" TEXT default '',
  "last_seen_at" TEXT default '',
  "market_event_id" INTEGER REFERENCES "market_events"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_sources_provider_external" ON "event_sources" ("provider", "external_id");
CREATE INDEX IF NOT EXISTS "event_sources_event" ON "event_sources" ("market_event_id");
