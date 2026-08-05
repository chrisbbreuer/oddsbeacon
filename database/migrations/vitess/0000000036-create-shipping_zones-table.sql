CREATE TABLE IF NOT EXISTS `shipping_zones` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `countries` text,
  `regions` text,
  `postal_codes` text,
  `status` ENUM('active', 'inactive', 'draft') not null,
  `shipping_method_id` bigint REFERENCES `shipping_methods`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `shipping_zones_uuid_unique` ON `shipping_zones` (`uuid`);
