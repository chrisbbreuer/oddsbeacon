CREATE TABLE IF NOT EXISTS `comments` (
  `id` bigint PRIMARY KEY auto_increment,
  `author_name` varchar(100) not null,
  `author_email` varchar(255) not null,
  `content` text not null,
  `body` text,
  `post_title` varchar(255),
  `status` ENUM('pending', 'approved', 'spam', 'trash') not null default 'pending',
  `ip_address` varchar(45),
  `user_agent` text,
  `is_approved` integer default 0,
  `post_id` bigint REFERENCES `posts`(`id`),
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `comments_uuid_unique` ON `comments` (`uuid`);
