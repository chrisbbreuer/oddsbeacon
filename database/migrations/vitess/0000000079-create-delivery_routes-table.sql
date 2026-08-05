CREATE TABLE IF NOT EXISTS `delivery_routes` (
  `id` bigint PRIMARY KEY auto_increment,
  `driver` varchar(255) not null,
  `vehicle` varchar(255) not null,
  `stops` integer not null,
  `delivery_time` integer not null,
  `total_distance` integer not null,
  `last_active` varchar(255) not null,
  `driver_id` bigint REFERENCES `drivers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `delivery_routes_uuid_unique` ON `delivery_routes` (`uuid`);
