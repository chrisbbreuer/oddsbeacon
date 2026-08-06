ALTER TABLE `team_identities` ADD CONSTRAINT `team_identities_sports_team_id_fk` FOREIGN KEY (`sports_team_id`) REFERENCES `sports_teams`(`id`);
