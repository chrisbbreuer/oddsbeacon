CREATE TABLE IF NOT EXISTS "odds_snapshots" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "price" REAL not null,
  "implied_prob" REAL default 0,
  "point" REAL,
  "captured_at" TEXT not null,
  "is_opening" INTEGER default 0,
  "selection_id" INTEGER REFERENCES "selections"("id"),
  "bookmaker_id" INTEGER REFERENCES "bookmakers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "odds_snapshots_selection_bookmaker_captured" ON "odds_snapshots" ("selection_id", "bookmaker_id", "captured_at");
CREATE INDEX IF NOT EXISTS "odds_snapshots_quote_time" ON "odds_snapshots" ("selection_id", "bookmaker_id", "captured_at");
CREATE INDEX IF NOT EXISTS "odds_snapshots_captured" ON "odds_snapshots" ("captured_at");
