ALTER TABLE `athletes` ADD CONSTRAINT `athletes_sport_id_fk` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`);
ALTER TABLE `athletes` ADD CONSTRAINT `athletes_sports_team_id_fk` FOREIGN KEY (`sports_team_id`) REFERENCES `sports_teams`(`id`);
