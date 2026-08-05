CREATE TABLE IF NOT EXISTS `odds` (
  `id` bigint PRIMARY KEY auto_increment,
  `price` decimal(10,2) not null,
  `american` decimal(10,2) default 0,
  `implied_prob` decimal(10,2) default 0,
  `point` decimal(10,2),
  `limit_amount` decimal(10,2) default 0,
  `available` tinyint(1) default 1,
  `observed_at` varchar(40) default '',
  `selection_id` bigint REFERENCES `selections`(`id`),
  `bookmaker_id` bigint REFERENCES `bookmakers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `odds_selection_bookmaker` ON `odds` (`selection_id`, `bookmaker_id`);
CREATE INDEX `odds_bookmaker` ON `odds` (`bookmaker_id`);
