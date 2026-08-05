CREATE TABLE IF NOT EXISTS `tags` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(50) not null,
  `slug` varchar(50) not null,
  `description` varchar(255),
  `color` varchar(20),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);
CREATE UNIQUE INDEX `tags_uuid_unique` ON `tags` (`uuid`);
