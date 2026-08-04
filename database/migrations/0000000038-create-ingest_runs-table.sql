CREATE TABLE IF NOT EXISTS "ingest_runs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT not null,
  "kind" TEXT not null default 'odds',
  "status" TEXT not null default 'running',
  "started_at" TEXT not null,
  "finished_at" TEXT default '',
  "duration_ms" REAL default 0,
  "request_count" REAL default 0,
  "rows_read" REAL default 0,
  "rows_written" REAL default 0,
  "unmatched_count" REAL default 0,
  "quota_remaining" REAL default -1,
  "quota_used" REAL default -1,
  "error" TEXT default '',
  "summary" TEXT default '',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "ingest_runs_provider_started" ON "ingest_runs" ("provider", "started_at");
CREATE INDEX IF NOT EXISTS "ingest_runs_status" ON "ingest_runs" ("status");
