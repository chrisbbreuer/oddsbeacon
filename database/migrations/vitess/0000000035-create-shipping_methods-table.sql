CREATE TABLE IF NOT EXISTS `shipping_methods` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `description` text,
  `base_rate` integer not null,
  `free_shipping` integer,
  `status` ENUM('active', 'inactive', 'draft') not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `shipping_methods_uuid_unique` ON `shipping_methods` (`uuid`);
