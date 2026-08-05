CREATE TABLE IF NOT EXISTS `market_trades` (
  `id` bigint PRIMARY KEY auto_increment,
  `prediction_market_id` decimal(10,2) REFERENCES `prediction_markets`(`id`),
  `market_trader_id` decimal(10,2) REFERENCES `market_traders`(`id`),
  `venue` varchar(20),
  `external_id` varchar(120),
  `side` varchar(120),
  `price` decimal(10,2),
  `size` decimal(10,2),
  `notional` decimal(10,2),
  `is_winner` decimal(10,2),
  `traded_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `market_trades_venue_external_id` ON `market_trades` (`venue`, `external_id`);
CREATE INDEX `market_trades_market` ON `market_trades` (`prediction_market_id`);
CREATE INDEX `market_trades_trader` ON `market_trades` (`market_trader_id`);
