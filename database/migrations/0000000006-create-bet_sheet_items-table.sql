CREATE TABLE IF NOT EXISTS "bet_sheet_items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "pick" TEXT,
  "game" TEXT,
  "league" TEXT,
  "price" REAL,
  "bet_sheet_id" INTEGER REFERENCES "bet_sheets"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
