CREATE TABLE IF NOT EXISTS "odds" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "selection_id" INTEGER,
  "bookmaker_id" INTEGER,
  "price" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
