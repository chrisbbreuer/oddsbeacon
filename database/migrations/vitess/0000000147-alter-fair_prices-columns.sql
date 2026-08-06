ALTER TABLE `fair_prices` ADD CONSTRAINT `fair_prices_best_bookmaker_id_fk` FOREIGN KEY (`best_bookmaker_id`) REFERENCES `bookmakers`(`id`) ON DELETE SET NULL;
ALTER TABLE `fair_prices` ADD CONSTRAINT `fair_prices_selection_id_fk` FOREIGN KEY (`selection_id`) REFERENCES `selections`(`id`);
