CREATE TABLE IF NOT EXISTS `card_comments` (
  `id` bigint PRIMARY KEY auto_increment,
  `card_id` bigint not null REFERENCES `cards`(`id`),
  `user_id` bigint REFERENCES `users`(`id`),
  `body` text not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `card_comments_uuid_unique` ON `card_comments` (`uuid`);
