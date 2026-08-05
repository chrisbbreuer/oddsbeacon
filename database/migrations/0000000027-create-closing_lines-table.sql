CREATE TABLE IF NOT EXISTS "closing_lines" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "price" REAL not null,
  "implied_prob" REAL default 0,
  "fair_prob" REAL default 0,
  "point" REAL,
  "captured_at" TEXT not null,
  "seconds_before_start" REAL default 0,
  "selection_id" INTEGER REFERENCES "selections"("id"),
  "bookmaker_id" INTEGER REFERENCES "bookmakers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "closing_lines_selection_bookmaker" ON "closing_lines" ("selection_id", "bookmaker_id");
