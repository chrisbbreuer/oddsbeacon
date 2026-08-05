CREATE TABLE IF NOT EXISTS `notification_deliveries` (
  `id` bigint PRIMARY KEY auto_increment,
  `user_id` integer REFERENCES `users`(`id`),
  `channel` ENUM('email', 'sms', 'chat', 'database', 'push', 'broadcast') not null,
  `recipient` text not null,
  `subject` varchar(255),
  `body` text not null,
  `status` ENUM('pending', 'sent', 'delivered', 'failed') not null default 'pending',
  `error` text,
  `metadata` varchar(255),
  `sent_at` datetime,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
