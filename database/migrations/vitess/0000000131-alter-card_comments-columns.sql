ALTER TABLE `card_comments` ADD CONSTRAINT `card_comments_card_id_fk` FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`);
ALTER TABLE `card_comments` ADD CONSTRAINT `card_comments_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
