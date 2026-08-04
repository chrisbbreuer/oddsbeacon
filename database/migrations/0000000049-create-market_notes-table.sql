CREATE TABLE IF NOT EXISTS "market_notes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "prediction_market_id" INTEGER REFERENCES "prediction_markets"("id"),
  "user_id" INTEGER REFERENCES "users"("id"),
  "author_name" TEXT,
  "stance" TEXT,
  "body" TEXT,
  "hidden" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "market_notes_market_created" ON "market_notes" ("prediction_market_id", "created_at");
CREATE INDEX IF NOT EXISTS "market_notes_author" ON "market_notes" ("user_id");
