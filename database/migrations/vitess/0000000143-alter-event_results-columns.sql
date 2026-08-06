ALTER TABLE `event_results` ADD CONSTRAINT `event_results_market_event_id_fk` FOREIGN KEY (`market_event_id`) REFERENCES `market_events`(`id`);
