CREATE TABLE IF NOT EXISTS `order_idempotency` (
  `id` bigint PRIMARY KEY auto_increment,
  `idempotency_key` varchar(255) not null,
  `order_id` integer not null REFERENCES `orders`(`id`),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);
CREATE UNIQUE INDEX `order_idempotency_idempotency_key_unique` ON `order_idempotency` (`idempotency_key`);
