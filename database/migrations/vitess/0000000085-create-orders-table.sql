CREATE TABLE IF NOT EXISTS `orders` (
  `id` bigint PRIMARY KEY auto_increment,
  `status` varchar(255) not null,
  `total_amount` integer not null,
  `currency` varchar(3) not null default 'USD',
  `tax_amount` integer default 0,
  `discount_amount` integer default 0,
  `delivery_fee` integer default 0,
  `tip_amount` integer default 0,
  `order_type` varchar(255) not null,
  `delivery_address` varchar(255),
  `special_instructions` varchar(255),
  `estimated_delivery_time` varchar(255),
  `applied_coupon_id` varchar(255),
  `customer_id` bigint REFERENCES `customers`(`id`),
  `coupon_id` bigint REFERENCES `coupons`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `orders_uuid_unique` ON `orders` (`uuid`);
