CREATE TABLE IF NOT EXISTS `customers` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `email` varchar(255) not null,
  `phone` varchar(50),
  `total_spent` integer default 0,
  `last_order` varchar(255),
  `status` ENUM('Active', 'Inactive') not null default 'Active',
  `avatar` varchar(255) not null,
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `customers_email_unique` ON `customers` (`email`);
CREATE UNIQUE INDEX `customers_uuid_unique` ON `customers` (`uuid`);
