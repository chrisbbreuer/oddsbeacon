CREATE TABLE IF NOT EXISTS `errors` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` varchar(255) not null,
  `message` varchar(255) not null,
  `stack` varchar(255),
  `status` integer,
  `additional_info` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `errors_created_at_index` ON `errors` (`created_at`);
