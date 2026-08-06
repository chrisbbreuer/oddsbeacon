ALTER TABLE `bet_sheet_items` ADD CONSTRAINT `bet_sheet_items_bet_sheet_id_fk` FOREIGN KEY (`bet_sheet_id`) REFERENCES `bet_sheets`(`id`);
