CREATE TABLE IF NOT EXISTS "ai_insights" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "kind" TEXT not null default 'candidate_review',
  "selection_id" INTEGER REFERENCES "selections"("id") ON DELETE CASCADE,
  "market_event_id" INTEGER REFERENCES "market_events"("id") ON DELETE CASCADE,
  "feature_hash" TEXT not null default '',
  "stance" TEXT default 'pass',
  "stated_prob" REAL default 0,
  "confidence" REAL default 0,
  "summary" TEXT default '',
  "rationale" TEXT default '',
  "caveats" TEXT default '',
  "model" TEXT default '',
  "prompt_tokens" REAL default 0,
  "completion_tokens" REAL default 0,
  "cost_usd" REAL default 0,
  "latency_ms" REAL default 0,
  "outcome" REAL not null default -1,
  "brier_score" REAL default 0,
  "graded_at" TEXT default '',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "ai_insights_selection_created" ON "ai_insights" ("selection_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_insights_feature_hash" ON "ai_insights" ("feature_hash");
CREATE INDEX IF NOT EXISTS "ai_insights_event" ON "ai_insights" ("market_event_id");
