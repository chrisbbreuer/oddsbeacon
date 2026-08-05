CREATE TABLE IF NOT EXISTS `waitlist_products` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `email` varchar(255) not null,
  `phone` varchar(100),
  `quantity` integer not null,
  `notification_preference` ENUM('sms', 'email', 'both') not null,
  `source` varchar(100) not null,
  `notes` text,
  `status` ENUM('waiting', 'purchased', 'notified', 'cancelled') not null default 'waiting',
  `notified_at` date,
  `purchased_at` date,
  `cancelled_at` date,
  `product_id` bigint REFERENCES `products`(`id`),
  `customer_id` bigint REFERENCES `customers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `waitlist_products_uuid_unique` ON `waitlist_products` (`uuid`);
