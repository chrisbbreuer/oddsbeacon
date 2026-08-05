CREATE TABLE IF NOT EXISTS `releases` (
  `id` bigint PRIMARY KEY auto_increment,
  `version` varchar(50) not null,
  `type` varchar(255) not null,
  `status` varchar(255) not null,
  `notes` varchar(255),
  `downloads` integer,
  `author` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `releases_uuid_unique` ON `releases` (`uuid`);
