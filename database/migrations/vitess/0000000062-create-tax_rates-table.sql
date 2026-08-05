CREATE TABLE IF NOT EXISTS `tax_rates` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `rate` integer not null,
  `type` varchar(100) not null,
  `country` varchar(100) not null,
  `region` ENUM('North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica'),
  `status` ENUM('active', 'inactive') default 'active',
  `is_default` tinyint(1) default 0,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `tax_rates_uuid_unique` ON `tax_rates` (`uuid`);
