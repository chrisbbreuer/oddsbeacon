CREATE TABLE IF NOT EXISTS `notification_deliveries` (
  `id` bigint PRIMARY KEY auto_increment,
  `user_id` bigint REFERENCES `users`(`id`),
  `channel` varchar(255) not null,
  `recipient` text not null,
  `subject` varchar(255),
  `body` text not null,
  `status` varchar(255) not null default 'pending',
  `error` text,
  `metadata` text,
  `sent_at` datetime,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
