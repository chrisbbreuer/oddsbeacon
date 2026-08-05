CREATE TABLE IF NOT EXISTS `websockets` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` ENUM('disconnection', 'error', 'success') not null,
  `socket` varchar(255) not null,
  `details` text not null,
  `time` integer not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
