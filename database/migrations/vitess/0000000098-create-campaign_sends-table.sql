CREATE TABLE IF NOT EXISTS `campaign_sends` (
  `id` bigint PRIMARY KEY auto_increment,
  `campaign_id` integer not null REFERENCES `campaigns`(`id`),
  `subscriber_id` integer not null REFERENCES `subscribers`(`id`),
  `email_list_id` integer not null REFERENCES `email_lists`(`id`),
  `status` ENUM('queued', 'sent', 'failed', 'bounced', 'complained') not null default 'queued',
  `provider_message_id` varchar(255),
  `error` varchar(255),
  `sent_at` datetime,
  `opened_at` datetime,
  `clicked_at` datetime,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `campaign_sends_uuid_unique` ON `campaign_sends` (`uuid`);
