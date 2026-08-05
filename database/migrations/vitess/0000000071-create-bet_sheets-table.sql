CREATE TABLE IF NOT EXISTS `bet_sheets` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(120),
  `token` varchar(64),
  `leg_count` decimal(10,2),
  `parlay_decimal` decimal(10,2),
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
