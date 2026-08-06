CREATE TABLE IF NOT EXISTS `exchange_positions` (
  `id` bigint PRIMARY KEY auto_increment,
  `trading_strategy_id` bigint REFERENCES `trading_strategies`(`id`),
  `exchange_account_id` bigint REFERENCES `exchange_accounts`(`id`),
  `prediction_market_id` bigint REFERENCES `prediction_markets`(`id`),
  `venue` varchar(20),
  `market_external_id` varchar(120),
  `side` varchar(60),
  `size` decimal(10,2),
  `cost_basis` decimal(10,2),
  `avg_price` decimal(10,2),
  `realized_pnl` decimal(10,2),
  `status` varchar(20),
  `settlement_price` decimal(10,2),
  `opened_at` varchar(40),
  `settled_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `exchange_positions_strategy_status` ON `exchange_positions` (`trading_strategy_id`, `status`);
CREATE INDEX `exchange_positions_account` ON `exchange_positions` (`exchange_account_id`);
CREATE INDEX `exchange_positions_market` ON `exchange_positions` (`prediction_market_id`);
CREATE INDEX `exchange_positions_book` ON `exchange_positions` (`trading_strategy_id`, `market_external_id`, `side`, `status`);
