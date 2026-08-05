CREATE TABLE IF NOT EXISTS `shipping_rates` (
  `id` bigint PRIMARY KEY auto_increment,
  `weight_from` real not null,
  `weight_to` real not null,
  `rate` integer not null,
  `shipping_method_id` bigint REFERENCES `shipping_methods`(`id`),
  `shipping_zone_id` bigint REFERENCES `shipping_zones`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `shipping_rates_uuid_unique` ON `shipping_rates` (`uuid`);
