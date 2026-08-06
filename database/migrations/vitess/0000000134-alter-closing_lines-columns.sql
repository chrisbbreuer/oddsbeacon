ALTER TABLE `closing_lines` ADD CONSTRAINT `closing_lines_selection_id_fk` FOREIGN KEY (`selection_id`) REFERENCES `selections`(`id`);
ALTER TABLE `closing_lines` ADD CONSTRAINT `closing_lines_bookmaker_id_fk` FOREIGN KEY (`bookmaker_id`) REFERENCES `bookmakers`(`id`);
