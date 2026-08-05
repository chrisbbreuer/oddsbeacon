CREATE TABLE IF NOT EXISTS "backfill_tasks" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT not null,
  "kind" TEXT not null,
  "external_id" TEXT not null,
  "url" TEXT not null,
  "status" TEXT default 'pending',
  "priority" INTEGER default 100,
  "attempts" INTEGER default 0,
  "available_at" TEXT default '',
  "locked_at" TEXT default '',
  "lock_token" TEXT default '',
  "completed_at" TEXT default '',
  "last_error" TEXT default '',
  "document_hash" TEXT default '',
  "payload" TEXT default '{}',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "backfill_tasks_natural" ON "backfill_tasks" ("provider", "kind", "external_id");
CREATE INDEX IF NOT EXISTS "backfill_tasks_claim" ON "backfill_tasks" ("status", "available_at", "priority");
