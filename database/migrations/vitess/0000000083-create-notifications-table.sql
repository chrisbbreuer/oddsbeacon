CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` varchar(255) not null,
  `data` varchar(255) not null,
  `read_at` datetime,
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `notifications_uuid_unique` ON `notifications` (`uuid`);
