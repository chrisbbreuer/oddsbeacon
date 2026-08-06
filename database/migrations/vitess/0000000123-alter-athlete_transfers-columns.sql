ALTER TABLE `athlete_transfers` ADD CONSTRAINT `athlete_transfers_athlete_id_fk` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`);
