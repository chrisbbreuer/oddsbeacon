CREATE TABLE IF NOT EXISTS `waitlist_restaurants` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255) not null,
  `email` varchar(255) not null,
  `phone` varchar(100),
  `party_size` integer not null,
  `check_in_time` datetime not null,
  `table_preference` ENUM('indoor', 'bar', 'booth', 'no_preference') not null,
  `status` ENUM('waiting', 'seated', 'cancelled', 'no_show') not null default 'waiting',
  `quoted_wait_time` integer not null,
  `actual_wait_time` integer,
  `queue_position` integer,
  `seated_at` datetime,
  `no_show_at` datetime,
  `cancelled_at` datetime,
  `customer_id` bigint REFERENCES `customers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `waitlist_restaurants_uuid_unique` ON `waitlist_restaurants` (`uuid`);
