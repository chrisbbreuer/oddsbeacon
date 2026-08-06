CREATE TABLE IF NOT EXISTS `activities` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` varchar(50) not null,
  `description` varchar(500) not null,
  `subject_type` varchar(100),
  `subject_id` integer,
  `causer` varchar(100),
  `properties` varchar(255),
  `ip_address` varchar(45),
  `user_id` bigint REFERENCES `users`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `activities_uuid_unique` ON `activities` (`uuid`);
