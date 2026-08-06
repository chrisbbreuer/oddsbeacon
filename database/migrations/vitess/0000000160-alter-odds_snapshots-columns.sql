ALTER TABLE `odds_snapshots` ADD CONSTRAINT `odds_snapshots_selection_id_fk` FOREIGN KEY (`selection_id`) REFERENCES `selections`(`id`);
ALTER TABLE `odds_snapshots` ADD CONSTRAINT `odds_snapshots_bookmaker_id_fk` FOREIGN KEY (`bookmaker_id`) REFERENCES `bookmakers`(`id`);
