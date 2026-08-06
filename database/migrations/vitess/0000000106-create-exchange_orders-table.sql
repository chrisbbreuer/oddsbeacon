CREATE TABLE IF NOT EXISTS `exchange_orders` (
  `id` bigint PRIMARY KEY auto_increment,
  `trade_decision_id` bigint REFERENCES `trade_decisions`(`id`),
  `exchange_account_id` bigint REFERENCES `exchange_accounts`(`id`),
  `venue` varchar(20),
  `client_order_id` varchar(80),
  `external_order_id` varchar(120),
  `market_external_id` varchar(120),
  `side` varchar(60),
  `limit_price` decimal(10,2),
  `size` decimal(10,2),
  `filled_size` decimal(10,2),
  `avg_fill_price` decimal(10,2),
  `status` varchar(20),
  `error` varchar(500),
  `placed_at` varchar(40),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `exchange_orders_decision` ON `exchange_orders` (`trade_decision_id`);
CREATE INDEX `exchange_orders_account` ON `exchange_orders` (`exchange_account_id`);
CREATE INDEX `exchange_orders_status` ON `exchange_orders` (`status`);
CREATE UNIQUE INDEX `exchange_orders_client_order_id` ON `exchange_orders` (`client_order_id`);
