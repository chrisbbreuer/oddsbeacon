ALTER TABLE `team_invitations` ADD CONSTRAINT `team_invitations_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`);
