CREATE TABLE IF NOT EXISTS `logs` (
  `id` bigint PRIMARY KEY auto_increment,
  `timestamp` integer not null,
  `type` ENUM('warning', 'error', 'info', 'success') not null,
  `source` ENUM('file', 'cli', 'system') not null,
  `message` text not null,
  `project` varchar(255) not null,
  `stacktrace` text not null,
  `file` varchar(255) not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE INDEX `logs_timestamp_index` ON `logs` (`timestamp`);
CREATE INDEX `logs_type_timestamp_index` ON `logs` (`type`, `timestamp`);
CREATE INDEX `logs_source_timestamp_index` ON `logs` (`source`, `timestamp`);
CREATE INDEX `logs_project_timestamp_index` ON `logs` (`project`, `timestamp`);
