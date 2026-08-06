CREATE TABLE IF NOT EXISTS `exchange_accounts` (
  `id` bigint PRIMARY KEY auto_increment,
  `user_id` bigint REFERENCES `users`(`id`),
  `venue` varchar(20),
  `label` varchar(60),
  `credentials` varchar(255),
  `masked_identifier` varchar(24),
  `status` varchar(20),
  `balance` decimal(10,2),
  `last_error` varchar(300),
  `last_synced_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `exchange_accounts_user_venue` ON `exchange_accounts` (`user_id`, `venue`);
