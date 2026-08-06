CREATE TABLE IF NOT EXISTS `backfill_tasks` (
  `id` bigint PRIMARY KEY auto_increment,
  `provider` varchar(40) not null,
  `kind` varchar(40) not null,
  `external_id` varchar(160) not null,
  `url` text not null,
  `status` varchar(255) default 'pending',
  `priority` integer default 100,
  `attempts` integer default 0,
  `available_at` varchar(40) default '',
  `locked_at` varchar(40) default '',
  `lock_token` varchar(64) default '',
  `completed_at` varchar(40) default '',
  `last_error` text default (''),
  `document_hash` varchar(64) default '',
  `payload` text default ('{}'),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `backfill_tasks_natural` ON `backfill_tasks` (`provider`, `kind`, `external_id`);
CREATE INDEX `backfill_tasks_claim` ON `backfill_tasks` (`status`, `available_at`, `priority`);
