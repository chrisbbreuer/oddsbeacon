ALTER TABLE `athlete_career_records` ADD CONSTRAINT `athlete_career_records_athlete_id_fk` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`);
