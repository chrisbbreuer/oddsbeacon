ALTER TABLE `campaign_sends` ADD CONSTRAINT `campaign_sends_campaign_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`);
ALTER TABLE `campaign_sends` ADD CONSTRAINT `campaign_sends_subscriber_id_fk` FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`);
ALTER TABLE `campaign_sends` ADD CONSTRAINT `campaign_sends_email_list_id_fk` FOREIGN KEY (`email_list_id`) REFERENCES `email_lists`(`id`);
