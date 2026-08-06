ALTER TABLE `exchange_accounts` ADD CONSTRAINT `exchange_accounts_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`);
