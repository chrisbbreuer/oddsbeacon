CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `email` varchar(255) not null,
  `password` varchar(255) not null,
  `avatar` text,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE INDEX `users_email_name_index` ON `users` (`email`, `name`);
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
CREATE UNIQUE INDEX `users_uuid_unique` ON `users` (`uuid`);
