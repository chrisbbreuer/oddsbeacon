CREATE TABLE IF NOT EXISTS `requests` (
  `id` bigint PRIMARY KEY auto_increment,
  `method` ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'),
  `path` varchar(255),
  `status_code` integer,
  `duration_ms` integer,
  `ip_address` varchar(255),
  `memory_usage` integer,
  `user_agent` varchar(255),
  `error_message` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `deleted_at` datetime
);
CREATE INDEX `requests_created_at_index` ON `requests` (`created_at`);
CREATE INDEX `requests_duration_ms_index` ON `requests` (`duration_ms`);
CREATE INDEX `requests_status_code_index` ON `requests` (`status_code`);
