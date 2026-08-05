CREATE TABLE IF NOT EXISTS `gift_cards` (
  `id` bigint PRIMARY KEY auto_increment,
  `code` varchar(50) not null,
  `initial_balance` integer not null,
  `current_balance` integer not null,
  `currency` varchar(3) not null default 'USD',
  `status` ENUM('ACTIVE', 'USED', 'EXPIRED', 'DEACTIVATED') not null,
  `purchaser_id` varchar(255),
  `recipient_email` varchar(255),
  `recipient_name` varchar(255),
  `personal_message` varchar(255),
  `is_digital` tinyint(1) default 0,
  `is_reloadable` tinyint(1) default 0,
  `is_active` tinyint(1) default 1,
  `expiry_date` datetime,
  `last_used_date` datetime,
  `template_id` varchar(255),
  `customer_id` bigint REFERENCES `customers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `gift_cards_code_unique` ON `gift_cards` (`code`);
CREATE UNIQUE INDEX `gift_cards_uuid_unique` ON `gift_cards` (`uuid`);
