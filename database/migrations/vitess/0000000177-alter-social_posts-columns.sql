ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
