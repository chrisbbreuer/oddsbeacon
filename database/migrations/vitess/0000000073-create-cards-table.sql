CREATE TABLE IF NOT EXISTS `cards` (
  `id` bigint PRIMARY KEY auto_increment,
  `column_id` integer not null,
  `board_id` integer not null REFERENCES `boards`(`id`),
  `title` varchar(300) not null,
  `description` text,
  `position` integer,
  `created_by_user_id` integer,
  `due_date` varchar(255),
  `archived` tinyint(1),
  `board_column_id` bigint REFERENCES `board_columns`(`id`),
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `cards_uuid_unique` ON `cards` (`uuid`);
