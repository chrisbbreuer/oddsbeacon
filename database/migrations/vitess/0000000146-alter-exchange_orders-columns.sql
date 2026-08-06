ALTER TABLE `exchange_orders` ADD CONSTRAINT `exchange_orders_trade_decision_id_fk` FOREIGN KEY (`trade_decision_id`) REFERENCES `trade_decisions`(`id`);
ALTER TABLE `exchange_orders` ADD CONSTRAINT `exchange_orders_exchange_account_id_fk` FOREIGN KEY (`exchange_account_id`) REFERENCES `exchange_accounts`(`id`);
