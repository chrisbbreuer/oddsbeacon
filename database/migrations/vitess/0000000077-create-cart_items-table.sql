CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` bigint PRIMARY KEY auto_increment,
  `quantity` integer not null,
  `unit_price` integer not null,
  `total_price` integer not null,
  `tax_rate` integer,
  `tax_amount` integer,
  `discount_percentage` integer,
  `discount_amount` integer,
  `product_name` varchar(255) not null,
  `product_sku` varchar(100),
  `product_image` varchar(255),
  `notes` text,
  `cart_id` bigint REFERENCES `carts`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `cart_items_uuid_unique` ON `cart_items` (`uuid`);
