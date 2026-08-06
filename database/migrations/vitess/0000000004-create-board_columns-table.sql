CREATE TABLE IF NOT EXISTS `board_columns` (
  `id` bigint PRIMARY KEY auto_increment,
  `board_id` bigint not null REFERENCES `boards`(`id`),
  `name` varchar(80) not null,
  `position` integer,
  `card_limit` integer,
  `color` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `board_columns_uuid_unique` ON `board_columns` (`uuid`);
