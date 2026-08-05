CREATE TABLE IF NOT EXISTS `odds_snapshots` (
  `id` bigint PRIMARY KEY auto_increment,
  `price` decimal(10,2) not null,
  `implied_prob` decimal(10,2) default 0,
  `point` decimal(10,2),
  `captured_at` varchar(40) not null,
  `is_opening` tinyint(1) default 0,
  `selection_id` bigint REFERENCES `selections`(`id`),
  `bookmaker_id` bigint REFERENCES `bookmakers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `odds_snapshots_selection_bookmaker_captured` ON `odds_snapshots` (`selection_id`, `bookmaker_id`, `captured_at`);
CREATE INDEX `odds_snapshots_quote_time` ON `odds_snapshots` (`selection_id`, `bookmaker_id`, `captured_at`);
CREATE INDEX `odds_snapshots_captured` ON `odds_snapshots` (`captured_at`);
