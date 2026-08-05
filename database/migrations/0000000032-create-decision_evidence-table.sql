CREATE TABLE IF NOT EXISTS "decision_evidence" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "trade_decision_id" INTEGER REFERENCES "trade_decisions"("id"),
  "kind" TEXT,
  "summary" TEXT,
  "value" REAL,
  "contribution" REAL,
  "sample_size" REAL,
  "window_hours" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "decision_evidence_decision" ON "decision_evidence" ("trade_decision_id");
