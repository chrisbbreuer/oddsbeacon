CREATE TABLE IF NOT EXISTS `manufacturers` (
  `id` bigint PRIMARY KEY auto_increment,
  `manufacturer` varchar(100) not null,
  `description` text,
  `country` varchar(100) not null,
  `featured` tinyint(1) default 0,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `manufacturers_manufacturer_unique` ON `manufacturers` (`manufacturer`);
CREATE UNIQUE INDEX `manufacturers_uuid_unique` ON `manufacturers` (`uuid`);
