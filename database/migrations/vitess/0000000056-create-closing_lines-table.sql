CREATE TABLE IF NOT EXISTS `closing_lines` (
  `id` bigint PRIMARY KEY auto_increment,
  `price` decimal(10,2) not null,
  `implied_prob` decimal(10,2) default 0,
  `fair_prob` decimal(10,2) default 0,
  `point` decimal(10,2),
  `captured_at` varchar(40) not null,
  `seconds_before_start` decimal(10,2) default 0,
  `selection_id` bigint REFERENCES `selections`(`id`),
  `bookmaker_id` bigint REFERENCES `bookmakers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `closing_lines_selection_bookmaker` ON `closing_lines` (`selection_id`, `bookmaker_id`);
