ALTER TABLE `market_trades` ADD CONSTRAINT `market_trades_prediction_market_id_fk` FOREIGN KEY (`prediction_market_id`) REFERENCES `prediction_markets`(`id`);
ALTER TABLE `market_trades` ADD CONSTRAINT `market_trades_market_trader_id_fk` FOREIGN KEY (`market_trader_id`) REFERENCES `market_traders`(`id`);
