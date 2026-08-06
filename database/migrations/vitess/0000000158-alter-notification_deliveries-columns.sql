ALTER TABLE `notification_deliveries` ADD CONSTRAINT `notification_deliveries_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
