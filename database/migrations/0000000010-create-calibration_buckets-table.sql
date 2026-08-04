CREATE TABLE IF NOT EXISTS "calibration_buckets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "scope" TEXT not null default 'overall',
  "scope_key" TEXT not null default '',
  "bucket_lower" REAL not null default 0,
  "bucket_upper" REAL not null default 0,
  "predicted_avg" REAL default 0,
  "observed_rate" REAL default 0,
  "sample_size" REAL default 0,
  "brier_score" REAL default 0,
  "log_loss" REAL default 0,
  "avg_clv_pct" REAL default 0,
  "computed_at" TEXT not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "calibration_buckets_scope_bucket" ON "calibration_buckets" ("scope", "scope_key", "bucket_lower");
