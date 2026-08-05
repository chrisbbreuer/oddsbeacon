CREATE TABLE IF NOT EXISTS `product_units` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `abbreviation` varchar(10) not null,
  `type` varchar(255) not null,
  `description` varchar(255),
  `is_default` tinyint(1) default 0,
  `product_id` bigint REFERENCES `products`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `product_units_uuid_unique` ON `product_units` (`uuid`);
