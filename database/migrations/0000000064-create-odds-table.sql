CREATE TABLE IF NOT EXISTS "odds" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "price" REAL not null,
  "american" REAL default 0,
  "implied_prob" REAL default 0,
  "point" REAL,
  "limit_amount" REAL default 0,
  "available" INTEGER default 1,
  "observed_at" TEXT default '',
  "selection_id" INTEGER REFERENCES "selections"("id"),
  "bookmaker_id" INTEGER REFERENCES "bookmakers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "odds_selection_bookmaker" ON "odds" ("selection_id", "bookmaker_id");
CREATE INDEX IF NOT EXISTS "odds_bookmaker" ON "odds" ("bookmaker_id");
