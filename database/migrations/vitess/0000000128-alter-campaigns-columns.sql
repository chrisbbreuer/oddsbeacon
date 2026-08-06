ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_email_list_id_fk` FOREIGN KEY (`email_list_id`) REFERENCES `email_lists`(`id`);
