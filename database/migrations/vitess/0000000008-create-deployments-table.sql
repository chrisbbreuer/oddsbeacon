CREATE TABLE IF NOT EXISTS `deployments` (
  `id` bigint PRIMARY KEY auto_increment,
  `commit_hash` varchar(40) not null,
  `commit_message` varchar(500),
  `branch` varchar(255) not null,
  `status` varchar(255) not null,
  `environment` varchar(255) not null,
  `duration` integer,
  `author` varchar(255) not null,
  `url` varchar(500),
  `error_log` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `deployments_uuid_unique` ON `deployments` (`uuid`);
