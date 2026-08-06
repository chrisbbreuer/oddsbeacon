CREATE TABLE IF NOT EXISTS `alert_subscriptions` (
  `id` bigint PRIMARY KEY auto_increment,
  `user_id` bigint REFERENCES `users`(`id`),
  `kind` varchar(30),
  `leagues` varchar(300),
  `venue` varchar(20),
  `min_value` decimal(10,2),
  `channels` varchar(120),
  `active` tinyint(1),
  `last_sent_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `alert_subscriptions_user` ON `alert_subscriptions` (`user_id`);
CREATE INDEX `alert_subscriptions_kind_active` ON `alert_subscriptions` (`kind`, `active`);
