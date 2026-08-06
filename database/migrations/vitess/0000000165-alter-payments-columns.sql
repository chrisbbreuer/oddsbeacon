ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`);
ALTER TABLE `payments` ADD CONSTRAINT `payments_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`);
