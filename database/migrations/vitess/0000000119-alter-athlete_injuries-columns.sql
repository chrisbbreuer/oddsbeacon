ALTER TABLE `athlete_injuries` ADD CONSTRAINT `athlete_injuries_athlete_id_fk` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`);
