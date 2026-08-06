CREATE TABLE IF NOT EXISTS `prediction_markets` (
  `id` bigint PRIMARY KEY auto_increment,
  `venue` varchar(20),
  `external_id` varchar(120),
  `question` varchar(300),
  `outcome_label` varchar(120) default '',
  `category` varchar(60),
  `status` varchar(20),
  `result` varchar(120),
  `volume` decimal(10,2),
  `liquidity` decimal(10,2),
  `last_price` decimal(10,2),
  `ends_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `prediction_markets_venue_external_id` ON `prediction_markets` (`venue`, `external_id`);
