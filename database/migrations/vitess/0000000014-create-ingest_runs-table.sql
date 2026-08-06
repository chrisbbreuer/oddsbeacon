CREATE TABLE IF NOT EXISTS `ingest_runs` (
  `id` bigint PRIMARY KEY auto_increment,
  `provider` varchar(40) not null,
  `kind` varchar(40) not null default 'odds',
  `status` varchar(255) not null default 'running',
  `started_at` varchar(40) not null,
  `finished_at` varchar(40) default '',
  `duration_ms` decimal(10,2) default 0,
  `request_count` decimal(10,2) default 0,
  `rows_read` decimal(10,2) default 0,
  `rows_written` decimal(10,2) default 0,
  `unmatched_count` decimal(10,2) default 0,
  `quota_remaining` decimal(10,2) default -1,
  `quota_used` decimal(10,2) default -1,
  `error` text default (''),
  `summary` text default (''),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `ingest_runs_provider_started` ON `ingest_runs` (`provider`, `started_at`);
CREATE INDEX `ingest_runs_status` ON `ingest_runs` (`status`);
