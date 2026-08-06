ALTER TABLE `odds` ADD CONSTRAINT `odds_selection_id_fk` FOREIGN KEY (`selection_id`) REFERENCES `selections`(`id`);
ALTER TABLE `odds` ADD CONSTRAINT `odds_bookmaker_id_fk` FOREIGN KEY (`bookmaker_id`) REFERENCES `bookmakers`(`id`);
