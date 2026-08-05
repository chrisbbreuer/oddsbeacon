CREATE TABLE IF NOT EXISTS `bet_sheet_items` (
  `id` bigint PRIMARY KEY auto_increment,
  `pick` varchar(100),
  `game` varchar(200),
  `league` varchar(60),
  `price` decimal(10,2),
  `bet_sheet_id` bigint REFERENCES `bet_sheets`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
