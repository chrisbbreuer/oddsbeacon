ALTER TABLE `bet_sheets` ADD CONSTRAINT `bet_sheets_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
