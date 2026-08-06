ALTER TABLE `event_sources` ADD CONSTRAINT `event_sources_market_event_id_fk` FOREIGN KEY (`market_event_id`) REFERENCES `market_events`(`id`);
