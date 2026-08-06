ALTER TABLE `athlete_identities` ADD CONSTRAINT `athlete_identities_athlete_id_fk` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`);
