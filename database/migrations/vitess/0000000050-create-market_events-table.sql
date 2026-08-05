CREATE TABLE IF NOT EXISTS `market_events` (
  `id` bigint PRIMARY KEY auto_increment,
  `title` varchar(200) not null,
  `category` varchar(60) default '',
  `league` varchar(60) default '',
  `commence_at` varchar(40) not null,
  `status` varchar(255) not null default 'scheduled',
  `home_sports_team_id` decimal(10,2) REFERENCES `sports_teams`(`id`) ON DELETE SET NULL,
  `away_sports_team_id` decimal(10,2) REFERENCES `sports_teams`(`id`) ON DELETE SET NULL,
  `venue` varchar(160) default '',
  `broadcast` varchar(80) default '',
  `status_detail` varchar(80) default '',
  `last_seen_at` varchar(40) default '',
  `closing_captured_at` varchar(40) default '',
  `sport_id` bigint REFERENCES `sports`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `market_events_sport_commence` ON `market_events` (`sport_id`, `commence_at`);
CREATE INDEX `market_events_status_commence` ON `market_events` (`status`, `commence_at`);
