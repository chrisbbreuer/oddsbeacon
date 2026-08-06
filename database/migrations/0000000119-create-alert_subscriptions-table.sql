CREATE TABLE IF NOT EXISTS "alert_subscriptions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "kind" TEXT,
  "leagues" TEXT,
  "venue" TEXT,
  "min_value" REAL,
  "channels" TEXT,
  "active" INTEGER,
  "last_sent_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE INDEX IF NOT EXISTS "alert_subscriptions_user" ON "alert_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "alert_subscriptions_kind_active" ON "alert_subscriptions" ("kind", "active");
