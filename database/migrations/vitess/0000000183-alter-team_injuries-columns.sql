ALTER TABLE `team_injuries` ADD CONSTRAINT `team_injuries_sports_team_id_fk` FOREIGN KEY (`sports_team_id`) REFERENCES `sports_teams`(`id`);
