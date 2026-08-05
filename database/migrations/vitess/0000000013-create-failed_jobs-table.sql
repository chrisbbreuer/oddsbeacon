CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` bigint PRIMARY KEY auto_increment,
  `connection` varchar(100) not null,
  `queue` varchar(255) not null,
  `payload` varchar(255) not null,
  `exception` varchar(255) not null,
  `attempts` integer,
  `max_attempts` integer,
  `duration_ms` integer,
  `failed_at` date,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `failed_jobs_uuid_unique` ON `failed_jobs` (`uuid`);
