CREATE TABLE IF NOT EXISTS `market_traders` (
  `id` bigint PRIMARY KEY auto_increment,
  `venue` varchar(20),
  `external_id` varchar(120),
  `alias` varchar(120),
  `trade_count` decimal(10,2),
  `total_notional` decimal(10,2),
  `avg_trade_size` decimal(10,2),
  `max_trade_size` decimal(10,2),
  `resolved_trade_count` decimal(10,2),
  `winning_trade_count` decimal(10,2),
  `win_rate` decimal(10,2),
  `smart_score` decimal(10,2),
  `is_whale` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `market_traders_venue_external_id` ON `market_traders` (`venue`, `external_id`);
