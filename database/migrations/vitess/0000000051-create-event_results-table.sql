CREATE TABLE IF NOT EXISTS `event_results` (
  `id` bigint PRIMARY KEY auto_increment,
  `home_score` decimal(10,2) not null default 0,
  `away_score` decimal(10,2) not null default 0,
  `winner_side` varchar(20) not null default '',
  `period_scores` varchar(255) default '',
  `completed` tinyint(1) default 1,
  `source` varchar(40) default 'espn',
  `settled_at` varchar(40) not null,
  `graded_at` varchar(40) default '',
  `market_event_id` bigint REFERENCES `market_events`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `event_results_event` ON `event_results` (`market_event_id`);
