CREATE TABLE IF NOT EXISTS `drivers` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `phone` varchar(255) not null,
  `vehicle_number` varchar(255) not null,
  `license` varchar(255) not null,
  `status` ENUM('active', 'on_delivery', 'on_break') default 'active',
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `drivers_uuid_unique` ON `drivers` (`uuid`);
