CREATE TABLE IF NOT EXISTS `trade_decisions` (
  `id` bigint PRIMARY KEY auto_increment,
  `trading_strategy_id` bigint REFERENCES `trading_strategies`(`id`),
  `prediction_market_id` bigint REFERENCES `prediction_markets`(`id`),
  `venue` varchar(20),
  `side` varchar(60),
  `market_price` decimal(10,2),
  `fair_value` decimal(10,2),
  `edge` decimal(10,2),
  `confidence` decimal(10,2),
  `limit_price` decimal(10,2),
  `size` decimal(10,2),
  `notional` decimal(10,2),
  `rationale` text,
  `decided_by` varchar(60),
  `status` varchar(20),
  `status_reason` varchar(300),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `trade_decisions_strategy` ON `trade_decisions` (`trading_strategy_id`);
CREATE INDEX `trade_decisions_market` ON `trade_decisions` (`prediction_market_id`);
CREATE INDEX `trade_decisions_status` ON `trade_decisions` (`status`);
CREATE UNIQUE INDEX `trade_decisions_strategy_market` ON `trade_decisions` (`trading_strategy_id`, `prediction_market_id`);
