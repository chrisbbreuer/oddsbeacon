ALTER TABLE `markets` ADD CONSTRAINT `markets_market_event_id_fk` FOREIGN KEY (`market_event_id`) REFERENCES `market_events`(`id`);
