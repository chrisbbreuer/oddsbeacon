CREATE TABLE IF NOT EXISTS `analytics_events` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(100) not null,
  `category` varchar(50) not null default 'custom',
  `path` text,
  `value` integer default 0,
  `currency` varchar(3) not null default 'USD',
  `properties` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `analytics_events_uuid_unique` ON `analytics_events` (`uuid`);
