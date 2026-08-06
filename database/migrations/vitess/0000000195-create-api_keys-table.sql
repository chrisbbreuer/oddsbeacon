CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` bigint PRIMARY KEY auto_increment,
  `user_id` bigint REFERENCES `users`(`id`),
  `name` varchar(80),
  `prefix` varchar(40),
  `hash` varchar(120),
  `last_used_at` varchar(40),
  `revoked_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `api_keys_user` ON `api_keys` (`user_id`);
CREATE UNIQUE INDEX `api_keys_prefix` ON `api_keys` (`prefix`);
