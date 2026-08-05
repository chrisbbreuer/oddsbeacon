CREATE TABLE IF NOT EXISTS `boards` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(120) not null,
  `description` text,
  `icon` varchar(80),
  `color` varchar(40),
  `position` integer,
  `archived` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `boards_uuid_unique` ON `boards` (`uuid`);
