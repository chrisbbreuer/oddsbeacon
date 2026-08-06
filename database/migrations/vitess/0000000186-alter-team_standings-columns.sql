ALTER TABLE `team_standings` ADD CONSTRAINT `team_standings_sports_team_id_fk` FOREIGN KEY (`sports_team_id`) REFERENCES `sports_teams`(`id`);
