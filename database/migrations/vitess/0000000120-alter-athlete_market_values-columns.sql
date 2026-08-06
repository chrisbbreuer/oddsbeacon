ALTER TABLE `athlete_market_values` ADD CONSTRAINT `athlete_market_values_athlete_id_fk` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`);
