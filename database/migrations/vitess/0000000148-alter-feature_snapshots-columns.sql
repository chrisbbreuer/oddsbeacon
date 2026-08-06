ALTER TABLE `feature_snapshots` ADD CONSTRAINT `feature_snapshots_selection_id_fk` FOREIGN KEY (`selection_id`) REFERENCES `selections`(`id`);
