ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
