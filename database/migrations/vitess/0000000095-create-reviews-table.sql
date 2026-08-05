CREATE TABLE IF NOT EXISTS `reviews` (
  `id` bigint PRIMARY KEY auto_increment,
  `rating` integer not null,
  `title` varchar(100),
  `content` text,
  `is_verified_purchase` tinyint(1) default 0,
  `is_approved` tinyint(1) default 0,
  `is_featured` tinyint(1) default 0,
  `helpful_votes` integer default 0,
  `unhelpful_votes` integer default 0,
  `purchase_date` varchar(255),
  `images` varchar(255),
  `product_id` bigint REFERENCES `products`(`id`),
  `customer_id` bigint REFERENCES `customers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `reviews_uuid_unique` ON `reviews` (`uuid`);
