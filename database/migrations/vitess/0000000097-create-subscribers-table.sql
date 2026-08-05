CREATE TABLE IF NOT EXISTS `subscribers` (
  `id` bigint PRIMARY KEY auto_increment,
  `email` varchar(255) not null,
  `status` ENUM('subscribed', 'unsubscribed', 'pending', 'bounced') not null default 'subscribed',
  `source` varchar(100) default 'homepage',
  `unsubscribed_at` datetime,
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);
CREATE UNIQUE INDEX `subscribers_uuid_unique` ON `subscribers` (`uuid`);
