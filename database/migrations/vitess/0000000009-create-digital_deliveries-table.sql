CREATE TABLE IF NOT EXISTS `digital_deliveries` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `description` varchar(255) not null,
  `download_limit` integer,
  `expiry_days` integer not null,
  `requires_login` tinyint(1) default 0,
  `automatic_delivery` tinyint(1) default 0,
  `status` ENUM('active', 'inactive') default 'active',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `digital_deliveries_uuid_unique` ON `digital_deliveries` (`uuid`);
