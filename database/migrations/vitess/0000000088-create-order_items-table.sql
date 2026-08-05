CREATE TABLE IF NOT EXISTS `order_items` (
  `id` bigint PRIMARY KEY auto_increment,
  `quantity` integer not null default 1,
  `price` integer not null,
  `special_instructions` varchar(255),
  `order_id` bigint REFERENCES `orders`(`id`),
  `product_id` bigint REFERENCES `products`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
