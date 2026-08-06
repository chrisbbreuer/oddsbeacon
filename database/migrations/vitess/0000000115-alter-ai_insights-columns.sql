ALTER TABLE `ai_insights` ADD CONSTRAINT `ai_insights_selection_id_fk` FOREIGN KEY (`selection_id`) REFERENCES `selections`(`id`) ON DELETE CASCADE;
ALTER TABLE `ai_insights` ADD CONSTRAINT `ai_insights_market_event_id_fk` FOREIGN KEY (`market_event_id`) REFERENCES `market_events`(`id`) ON DELETE CASCADE;
