CREATE TABLE IF NOT EXISTS `event_sources` (
  `id` bigint PRIMARY KEY auto_increment,
  `provider` varchar(40) not null,
  `external_id` varchar(160) not null,
  `matched_by` varchar(255) default 'external_id',
  `confidence` decimal(10,2) default 1,
  `external_title` varchar(240) default '',
  `last_seen_at` varchar(40) default '',
  `market_event_id` bigint REFERENCES `market_events`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `event_sources_provider_external` ON `event_sources` (`provider`, `external_id`);
CREATE INDEX `event_sources_event` ON `event_sources` (`market_event_id`);
