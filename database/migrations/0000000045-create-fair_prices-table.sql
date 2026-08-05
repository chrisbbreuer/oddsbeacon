CREATE TABLE IF NOT EXISTS "fair_prices" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "prob_consensus" REAL not null default 0,
  "prob_sharp" REAL default 0,
  "prob_multiplicative" REAL default 0,
  "prob_power" REAL default 0,
  "prob_shin" REAL default 0,
  "method_spread" REAL default 0,
  "fair_price" REAL default 0,
  "best_price" REAL default 0,
  "best_bookmaker_id" INTEGER REFERENCES "bookmakers"("id") ON DELETE SET NULL,
  "edge_pct" REAL default 0,
  "kelly_fraction" REAL default 0,
  "overround_pct" REAL default 0,
  "book_count" REAL default 0,
  "sharp_book_count" REAL default 0,
  "computed_at" TEXT not null,
  "selection_id" INTEGER REFERENCES "selections"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "fair_prices_selection" ON "fair_prices" ("selection_id");
CREATE INDEX IF NOT EXISTS "fair_prices_edge" ON "fair_prices" ("edge_pct");
