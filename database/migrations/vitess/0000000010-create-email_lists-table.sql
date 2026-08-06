CREATE TABLE IF NOT EXISTS `email_lists` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `slug` varchar(120),
  `description` varchar(500),
  `subscriber_count` integer default 0,
  `active_count` integer default 0,
  `unsubscribed_count` integer default 0,
  `bounced_count` integer default 0,
  `status` ENUM('active', 'inactive', 'archived') not null default 'active',
  `is_public` integer default 1,
  `double_opt_in` integer default 1,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `email_lists_slug_unique` ON `email_lists` (`slug`);
CREATE UNIQUE INDEX `email_lists_uuid_unique` ON `email_lists` (`uuid`);
