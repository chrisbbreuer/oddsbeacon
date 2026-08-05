CREATE TABLE IF NOT EXISTS `source_documents` (
  `id` bigint PRIMARY KEY auto_increment,
  `provider` varchar(40) not null,
  `kind` varchar(40) not null,
  `external_id` varchar(160) default '',
  `url` text not null,
  `url_hash` varchar(255) not null,
  `content_hash` varchar(255) not null,
  `storage_path` text not null,
  `http_status` integer default 200,
  `content_type` varchar(160) default 'text/html',
  `etag` text default '',
  `last_modified` varchar(160) default '',
  `byte_length` bigint default 0,
  `fetched_at` varchar(40) not null,
  `parsed_at` varchar(40) default '',
  `parser_version` varchar(40) default '',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `source_documents_version` ON `source_documents` (`provider`, `url_hash`, `content_hash`);
CREATE INDEX `source_documents_url_fetched` ON `source_documents` (`url_hash`, `fetched_at`);
