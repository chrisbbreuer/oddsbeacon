ALTER TABLE `athlete_team_memberships` ADD CONSTRAINT `athlete_team_memberships_athlete_id_fk` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`);
ALTER TABLE `athlete_team_memberships` ADD CONSTRAINT `athlete_team_memberships_sports_team_id_fk` FOREIGN KEY (`sports_team_id`) REFERENCES `sports_teams`(`id`);
