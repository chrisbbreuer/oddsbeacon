CREATE TABLE IF NOT EXISTS `coupons` (
  `id` bigint PRIMARY KEY auto_increment,
  `code` varchar(50) not null,
  `description` varchar(255),
  `status` ENUM('Active', 'Scheduled', 'Expired') not null default 'Active',
  `is_active` tinyint(1) not null default 1,
  `discount_type` ENUM('fixed_amount', 'percentage') not null,
  `discount_value` integer not null,
  `min_order_amount` integer,
  `max_discount_amount` integer,
  `free_product_id` varchar(255),
  `usage_limit` integer,
  `usage_count` integer default 0,
  `start_date` date,
  `end_date` date,
  `product_id` bigint REFERENCES `products`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);
CREATE UNIQUE INDEX `coupons_uuid_unique` ON `coupons` (`uuid`);
