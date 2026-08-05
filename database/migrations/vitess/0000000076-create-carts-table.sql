CREATE TABLE IF NOT EXISTS `carts` (
  `id` bigint PRIMARY KEY auto_increment,
  `status` ENUM('active', 'abandoned', 'converted', 'expired') default 'active',
  `total_items` integer default 0,
  `subtotal` integer default 0,
  `tax_amount` integer default 0,
  `discount_amount` integer default 0,
  `total` integer default 0,
  `expires_at` datetime not null,
  `currency` varchar(3) default 'USD',
  `notes` text,
  `applied_coupon_id` varchar(255) not null,
  `customer_id` bigint REFERENCES `customers`(`id`),
  `coupon_id` bigint REFERENCES `coupons`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `carts_uuid_unique` ON `carts` (`uuid`);
