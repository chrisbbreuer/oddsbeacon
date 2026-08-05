CREATE TABLE IF NOT EXISTS `social_posts` (
  `id` bigint PRIMARY KEY auto_increment,
  `content` text not null,
  `platform` ENUM('twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube') not null,
  `status` ENUM('draft', 'scheduled', 'published', 'failed') not null default 'draft',
  `scheduled_at` datetime,
  `published_at` datetime,
  `likes` integer default 0,
  `shares` integer default 0,
  `comments` integer default 0,
  `reach` integer default 0,
  `image_url` varchar(255),
  `external_id` varchar(255),
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `social_posts_uuid_unique` ON `social_posts` (`uuid`);
