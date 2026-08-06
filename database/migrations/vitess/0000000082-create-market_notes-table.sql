CREATE TABLE IF NOT EXISTS `market_notes` (
  `id` bigint PRIMARY KEY auto_increment,
  `prediction_market_id` bigint REFERENCES `prediction_markets`(`id`),
  `user_id` bigint REFERENCES `users`(`id`),
  `author_name` varchar(60),
  `stance` varchar(10),
  `body` text,
  `hidden` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `market_notes_market_created` ON `market_notes` (`prediction_market_id`, `created_at`);
CREATE INDEX `market_notes_author` ON `market_notes` (`user_id`);
