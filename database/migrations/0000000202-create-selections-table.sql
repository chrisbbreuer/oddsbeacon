CREATE TABLE IF NOT EXISTS "selections" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "market_event_id" INTEGER,
  "label" TEXT,
  "position" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
