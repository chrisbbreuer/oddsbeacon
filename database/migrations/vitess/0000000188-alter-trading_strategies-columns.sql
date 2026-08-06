ALTER TABLE `trading_strategies` ADD CONSTRAINT `trading_strategies_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
