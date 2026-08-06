ALTER TABLE `labels` ADD CONSTRAINT `labels_board_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`);
