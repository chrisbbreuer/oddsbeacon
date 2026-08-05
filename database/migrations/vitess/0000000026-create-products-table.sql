CREATE TABLE IF NOT EXISTS `products` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `description` varchar(255),
  `price` integer not null,
  `image_url` varchar(255),
  `is_available` tinyint(1),
  `inventory_count` integer,
  `preparation_time` integer not null,
  `allergens` varchar(255),
  `nutritional_info` varchar(255),
  `category_id` bigint REFERENCES `categories`(`id`),
  `manufacturer_id` bigint REFERENCES `manufacturers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `products_uuid_unique` ON `products` (`uuid`);
