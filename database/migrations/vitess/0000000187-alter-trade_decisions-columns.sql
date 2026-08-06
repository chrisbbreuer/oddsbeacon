ALTER TABLE `trade_decisions` ADD CONSTRAINT `trade_decisions_trading_strategy_id_fk` FOREIGN KEY (`trading_strategy_id`) REFERENCES `trading_strategies`(`id`);
ALTER TABLE `trade_decisions` ADD CONSTRAINT `trade_decisions_prediction_market_id_fk` FOREIGN KEY (`prediction_market_id`) REFERENCES `prediction_markets`(`id`);
