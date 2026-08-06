CREATE TABLE IF NOT EXISTS `trading_strategies` (
  `id` bigint PRIMARY KEY auto_increment,
  `user_id` bigint REFERENCES `users`(`id`),
  `name` varchar(80),
  `venue` varchar(20),
  `categories` varchar(300),
  `bankroll` decimal(10,2),
  `max_stake` decimal(10,2),
  `min_edge` decimal(10,2),
  `min_confidence` decimal(10,2),
  `max_open_positions` decimal(10,2),
  `daily_loss_limit` decimal(10,2),
  `auto_execute` tinyint(1),
  `status` varchar(20),
  `halted_reason` varchar(300),
  `last_run_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `trading_strategies_user` ON `trading_strategies` (`user_id`);
CREATE INDEX `trading_strategies_status` ON `trading_strategies` (`status`);
