CREATE TABLE IF NOT EXISTS "source_documents" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "provider" TEXT not null,
  "kind" TEXT not null,
  "external_id" TEXT default '',
  "url" TEXT not null,
  "url_hash" TEXT not null,
  "content_hash" TEXT not null,
  "storage_path" TEXT not null,
  "http_status" INTEGER default 200,
  "content_type" TEXT default 'text/html',
  "etag" TEXT default '',
  "last_modified" TEXT default '',
  "byte_length" INTEGER default 0,
  "fetched_at" TEXT not null,
  "parsed_at" TEXT default '',
  "parser_version" TEXT default '',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "source_documents_version" ON "source_documents" ("provider", "url_hash", "content_hash");
CREATE INDEX IF NOT EXISTS "source_documents_url_fetched" ON "source_documents" ("url_hash", "fetched_at");
