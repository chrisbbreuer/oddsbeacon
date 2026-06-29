CREATE TABLE IF NOT EXISTS "bookmakers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "slug" TEXT,
  "kind" TEXT,
  "accent" TEXT,
  "short" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
