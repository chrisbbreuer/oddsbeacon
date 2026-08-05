CREATE TABLE IF NOT EXISTS `calibration_buckets` (
  `id` bigint PRIMARY KEY auto_increment,
  `scope` varchar(40) not null default 'overall',
  `scope_key` varchar(60) not null default '',
  `bucket_lower` decimal(10,2) not null default 0,
  `bucket_upper` decimal(10,2) not null default 0,
  `predicted_avg` decimal(10,2) default 0,
  `observed_rate` decimal(10,2) default 0,
  `sample_size` decimal(10,2) default 0,
  `brier_score` decimal(10,2) default 0,
  `log_loss` decimal(10,2) default 0,
  `avg_clv_pct` decimal(10,2) default 0,
  `computed_at` varchar(40) not null,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `calibration_buckets_scope_bucket` ON `calibration_buckets` (`scope`, `scope_key`, `bucket_lower`);
