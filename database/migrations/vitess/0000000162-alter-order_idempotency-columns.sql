ALTER TABLE `order_idempotency` ADD CONSTRAINT `order_idempotency_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`);
