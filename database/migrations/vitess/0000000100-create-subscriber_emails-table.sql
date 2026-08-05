CREATE TABLE IF NOT EXISTS `subscriber_emails` (
  `id` bigint PRIMARY KEY auto_increment,
  `email` varchar(255) not null,
  `source` varchar(100) default 'homepage',
  `subscriber_id` bigint REFERENCES `subscribers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `subscriber_emails_uuid_unique` ON `subscriber_emails` (`uuid`);
