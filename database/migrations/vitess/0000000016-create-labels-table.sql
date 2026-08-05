CREATE TABLE IF NOT EXISTS `labels` (
  `id` bigint PRIMARY KEY auto_increment,
  `board_id` integer not null REFERENCES `boards`(`id`),
  `name` varchar(60) not null,
  `color` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `labels_uuid_unique` ON `labels` (`uuid`);
