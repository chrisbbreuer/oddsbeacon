CREATE TABLE IF NOT EXISTS `payment_products` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` text not null,
  `description` varchar(255),
  `key` varchar(255) not null,
  `unit_price` integer not null,
  `status` varchar(255),
  `image` varchar(255),
  `provider_id` varchar(255),
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `payment_products_uuid_unique` ON `payment_products` (`uuid`);
