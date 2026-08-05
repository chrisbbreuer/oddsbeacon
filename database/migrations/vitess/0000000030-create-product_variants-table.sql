CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` bigint PRIMARY KEY auto_increment,
  `variant` varchar(100) not null,
  `type` varchar(50) not null,
  `description` varchar(255),
  `options` varchar(255),
  `status` ENUM('active', 'inactive', 'draft') not null,
  `product_id` bigint REFERENCES `products`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `product_variants_uuid_unique` ON `product_variants` (`uuid`);
