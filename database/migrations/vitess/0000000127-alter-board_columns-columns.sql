ALTER TABLE `board_columns` ADD CONSTRAINT `board_columns_board_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`);
