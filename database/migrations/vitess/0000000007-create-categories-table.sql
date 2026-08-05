CREATE TABLE IF NOT EXISTS `categories` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(50) not null,
  `description` varchar(255),
  `slug` varchar(255) not null,
  `image_url` varchar(255),
  `is_active` tinyint(1),
  `parent_category_id` varchar(255),
  `display_order` integer not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `categories_uuid_unique` ON `categories` (`uuid`);
