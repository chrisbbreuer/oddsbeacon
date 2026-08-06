CREATE TABLE IF NOT EXISTS `authors` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `email` varchar(255) not null,
  `bio` varchar(500),
  `avatar` varchar(255),
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE INDEX `authors_email_name_index` ON `authors` (`email`, `name`);
CREATE UNIQUE INDEX `authors_email_unique` ON `authors` (`email`);
CREATE UNIQUE INDEX `authors_uuid_unique` ON `authors` (`uuid`);
