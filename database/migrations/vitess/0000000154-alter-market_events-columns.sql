ALTER TABLE `market_events` ADD CONSTRAINT `market_events_home_sports_team_id_fk` FOREIGN KEY (`home_sports_team_id`) REFERENCES `sports_teams`(`id`) ON DELETE SET NULL;
ALTER TABLE `market_events` ADD CONSTRAINT `market_events_away_sports_team_id_fk` FOREIGN KEY (`away_sports_team_id`) REFERENCES `sports_teams`(`id`) ON DELETE SET NULL;
ALTER TABLE `market_events` ADD CONSTRAINT `market_events_sport_id_fk` FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`);
