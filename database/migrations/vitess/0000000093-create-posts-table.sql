CREATE TABLE IF NOT EXISTS `posts` (
  `id` bigint PRIMARY KEY auto_increment,
  `title` varchar(255) not null,
  `poster` varchar(255),
  `content` text not null,
  `excerpt` varchar(500),
  `focus_keyword` varchar(100),
  `meta_description` varchar(160),
  `canonical_url` varchar(255),
  `views` integer default 0,
  `published_at` datetime,
  `status` ENUM('published', 'draft', 'archived') not null default 'draft',
  `is_featured` integer,
  `author_id` bigint REFERENCES `authors`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `posts_uuid_unique` ON `posts` (`uuid`);
