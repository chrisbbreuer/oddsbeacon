ALTER TABLE `cards` ADD CONSTRAINT `cards_board_id_fk` FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`);
ALTER TABLE `cards` ADD CONSTRAINT `cards_board_column_id_fk` FOREIGN KEY (`board_column_id`) REFERENCES `board_columns`(`id`);
ALTER TABLE `cards` ADD CONSTRAINT `cards_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
