CREATE TABLE IF NOT EXISTS `pages` (
  `id` bigint PRIMARY KEY auto_increment,
  `title` varchar(255) not null,
  `template` varchar(255) not null,
  `views` integer default 0,
  `published_at` datetime,
  `conversions` integer default 0,
  `author_id` bigint REFERENCES `authors`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `pages_uuid_unique` ON `pages` (`uuid`);
