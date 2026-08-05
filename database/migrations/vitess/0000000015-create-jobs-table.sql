CREATE TABLE IF NOT EXISTS `jobs` (
  `id` bigint PRIMARY KEY auto_increment,
  `queue` varchar(255) not null,
  `payload` varchar(255) not null,
  `attempts` integer,
  `available_at` integer,
  `reserved_at` integer,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
