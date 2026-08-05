CREATE TABLE IF NOT EXISTS `loyalty_rewards` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `description` text,
  `points_required` integer not null,
  `reward_type` varchar(255) not null,
  `discount_percentage` integer,
  `free_product_id` varchar(255),
  `is_active` tinyint(1),
  `expiry_days` integer,
  `image_url` varchar(255),
  `product_id` bigint REFERENCES `products`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `loyalty_rewards_uuid_unique` ON `loyalty_rewards` (`uuid`);
