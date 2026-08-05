CREATE TABLE IF NOT EXISTS `print_devices` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `mac_address` varchar(50) not null,
  `location` varchar(100) not null,
  `terminal` varchar(50) not null,
  `status` ENUM('online', 'offline', 'warning') not null,
  `last_ping` integer default 0,
  `print_count` integer default 0,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `print_devices_uuid_unique` ON `print_devices` (`uuid`);
