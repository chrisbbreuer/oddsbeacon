CREATE TABLE IF NOT EXISTS `teams` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `description` text,
  `member_count` integer default 0,
  `status` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);
CREATE UNIQUE INDEX `teams_uuid_unique` ON `teams` (`uuid`);
