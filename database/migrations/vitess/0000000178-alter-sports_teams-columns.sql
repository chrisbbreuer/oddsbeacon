ALTER TABLE `sports_teams` ADD CONSTRAINT `sports_teams_sport_id_fk` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`);
