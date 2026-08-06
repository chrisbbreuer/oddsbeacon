ALTER TABLE `club_valuations` ADD CONSTRAINT `club_valuations_sports_team_id_fk` FOREIGN KEY (`sports_team_id`) REFERENCES `sports_teams`(`id`);
