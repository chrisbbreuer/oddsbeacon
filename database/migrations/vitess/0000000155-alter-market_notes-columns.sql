ALTER TABLE `market_notes` ADD CONSTRAINT `market_notes_prediction_market_id_fk` FOREIGN KEY (`prediction_market_id`) REFERENCES `prediction_markets`(`id`);
ALTER TABLE `market_notes` ADD CONSTRAINT `market_notes_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
