CREATE TABLE IF NOT EXISTS `email_list_subscribers` (
  `id` bigint PRIMARY KEY auto_increment,
  `email_list_id` bigint not null REFERENCES `email_lists`(`id`),
  `subscriber_id` bigint not null REFERENCES `subscribers`(`id`),
  `status` ENUM('subscribed', 'unsubscribed', 'pending', 'bounced') not null default 'subscribed',
  `source` varchar(100) default 'api',
  `subscribed_at` datetime,
  `unsubscribed_at` datetime,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `email_list_subscribers_uuid_unique` ON `email_list_subscribers` (`uuid`);
