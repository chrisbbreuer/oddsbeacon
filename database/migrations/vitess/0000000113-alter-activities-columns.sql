ALTER TABLE `activities` ADD CONSTRAINT `activities_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
