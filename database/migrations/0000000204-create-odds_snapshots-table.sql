CREATE TABLE IF NOT EXISTS "odds_snapshots" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "selection_id" INTEGER,
  "bookmaker_id" INTEGER,
  "price" REAL,
  "captured_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_odds_snapshots_sel_book" ON "odds_snapshots" ("selection_id", "bookmaker_id", "captured_at");
