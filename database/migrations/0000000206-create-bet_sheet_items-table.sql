CREATE TABLE IF NOT EXISTS "bet_sheet_items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "bet_sheet_id" INTEGER,
  "selection_id" INTEGER,
  "bookmaker_id" INTEGER,
  "market_event_id" INTEGER,
  "pick" TEXT,
  "game" TEXT,
  "league" TEXT,
  "price" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "idx_bet_sheet_items_sheet" ON "bet_sheet_items" ("bet_sheet_id");
