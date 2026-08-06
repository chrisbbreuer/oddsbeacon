ALTER TABLE `selections` ADD CONSTRAINT `selections_sports_team_id_fk` FOREIGN KEY (`sports_team_id`) REFERENCES `sports_teams`(`id`) ON DELETE SET NULL;
ALTER TABLE `selections` ADD CONSTRAINT `selections_market_id_fk` FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`);
