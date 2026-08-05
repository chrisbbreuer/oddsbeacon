CREATE TABLE IF NOT EXISTS `receipts` (
  `id` bigint PRIMARY KEY auto_increment,
  `printer` varchar(100),
  `document` varchar(100) not null,
  `timestamp` datetime not null,
  `status` ENUM('success', 'failed', 'warning') not null,
  `size` integer default 0,
  `pages` integer default 0,
  `duration` integer default 0,
  `metadata` varchar(255) default '{}',
  `print_device_id` bigint REFERENCES `print_devices`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `receipts_uuid_unique` ON `receipts` (`uuid`);
