CREATE TABLE IF NOT EXISTS `book_market_coverage` (
  `id` bigint PRIMARY KEY auto_increment,
  `market_type` varchar(40) not null,
  `line_count` decimal(10,2) default 0,
  `last_seen_at` varchar(40) default '',
  `bookmaker_id` bigint REFERENCES `bookmakers`(`id`),
  `market_event_id` bigint REFERENCES `market_events`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `book_market_coverage_book_event_type` ON `book_market_coverage` (`bookmaker_id`, `market_event_id`, `market_type`);
CREATE INDEX `book_market_coverage_event` ON `book_market_coverage` (`market_event_id`);
