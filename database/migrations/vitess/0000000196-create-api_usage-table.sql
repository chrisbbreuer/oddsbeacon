CREATE TABLE IF NOT EXISTS `api_usage` (
  `id` bigint PRIMARY KEY auto_increment,
  `api_key_id` bigint REFERENCES `api_keys`(`id`),
  `day` varchar(10),
  `endpoint` varchar(120),
  `requests` decimal(10,2),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `api_usage_bucket` ON `api_usage` (`api_key_id`, `day`, `endpoint`);
CREATE INDEX `api_usage_day` ON `api_usage` (`day`);
