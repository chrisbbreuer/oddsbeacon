ALTER TABLE `comments` ADD CONSTRAINT `comments_post_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`);
ALTER TABLE `comments` ADD CONSTRAINT `comments_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
