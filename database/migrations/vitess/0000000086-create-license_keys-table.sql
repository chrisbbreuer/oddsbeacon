CREATE TABLE IF NOT EXISTS `license_keys` (
  `id` bigint PRIMARY KEY auto_increment,
  `key` varchar(255) not null,
  `template` ENUM('Standard License', 'Premium License', 'Enterprise License') not null,
  `expiry_date` datetime not null,
  `status` ENUM('active', 'inactive', 'unassigned') default 'unassigned',
  `customer_id` bigint REFERENCES `customers`(`id`),
  `product_id` bigint REFERENCES `products`(`id`),
  `order_id` bigint REFERENCES `orders`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `license_keys_key_unique` ON `license_keys` (`key`);
CREATE UNIQUE INDEX `license_keys_uuid_unique` ON `license_keys` (`uuid`);
