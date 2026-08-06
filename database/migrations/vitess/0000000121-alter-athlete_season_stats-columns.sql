ALTER TABLE `athlete_season_stats` ADD CONSTRAINT `athlete_season_stats_athlete_id_fk` FOREIGN KEY (`athlete_id`) REFERENCES `athletes`(`id`);
