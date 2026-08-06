ALTER TABLE `email_list_subscribers` ADD CONSTRAINT `email_list_subscribers_email_list_id_fk` FOREIGN KEY (`email_list_id`) REFERENCES `email_lists`(`id`);
ALTER TABLE `email_list_subscribers` ADD CONSTRAINT `email_list_subscribers_subscriber_id_fk` FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`);
