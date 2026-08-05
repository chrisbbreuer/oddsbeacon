CREATE TABLE IF NOT EXISTS `payments` (
  `id` bigint PRIMARY KEY auto_increment,
  `amount` integer not null,
  `method` ENUM('cash', 'creditCard', 'debitCard', 'paypal', 'applePay', 'googlePay', 'bankTransfer', 'giftCard') not null,
  `status` ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'partiallyRefunded', 'succeeded') not null default 'pending',
  `currency` varchar(3) not null default 'USD',
  `reference_number` varchar(255),
  `card_last_four` varchar(4),
  `card_brand` varchar(255),
  `billing_email` varchar(255),
  `transaction_id` varchar(255),
  `payment_provider` varchar(255),
  `refund_amount` integer default 0,
  `notes` varchar(255),
  `order_id` bigint REFERENCES `orders`(`id`),
  `customer_id` bigint REFERENCES `customers`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `uuid` varchar(255)
);
CREATE UNIQUE INDEX `payments_transaction_id_unique` ON `payments` (`transaction_id`);
CREATE UNIQUE INDEX `payments_uuid_unique` ON `payments` (`uuid`);
