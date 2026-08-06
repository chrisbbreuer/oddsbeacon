CREATE TABLE IF NOT EXISTS `trading_halts` (
  `id` bigint PRIMARY KEY auto_increment,
  `active` tinyint(1),
  `reason` varchar(300),
  `actor` varchar(120),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
