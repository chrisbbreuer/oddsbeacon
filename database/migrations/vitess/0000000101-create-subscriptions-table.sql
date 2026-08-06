CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` varchar(512) not null,
  `plan` varchar(100),
  `provider_id` varchar(255) not null,
  `provider_status` varchar(255) not null,
  `unit_price` integer not null,
  `provider_type` varchar(255) not null,
  `provider_price_id` varchar(255),
  `quantity` integer,
  `trial_ends_at` datetime,
  `ends_at` datetime,
  `last_used_at` datetime,
  `user_id` bigint REFERENCES `users`(`id`),
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `subscriptions_provider_id_unique` ON `subscriptions` (`provider_id`);
CREATE UNIQUE INDEX `subscriptions_uuid_unique` ON `subscriptions` (`uuid`);
